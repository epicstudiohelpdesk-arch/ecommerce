import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../audit/audit.service';
import type { StockAdjustmentInput } from '@repo/validation';
import type { StockAdjustmentResultDto, ProductVariantInventoryDto } from '@repo/api-contracts';

type DbTransaction = Parameters<Parameters<DatabaseService['db']['transaction']>[0]>[0];

@Injectable()
export class InventoryService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Authoritative, concurrency-safe inventory adjustment using transactional row-level locking.
   */
  async adjustStock(
    variantId: string,
    input: StockAdjustmentInput,
    actorId?: string,
    actorRole = 'APPROVED_SELLER',
  ): Promise<StockAdjustmentResultDto> {
    const adjustedAt = new Date();

    return await this.databaseService.db.transaction(async (tx) => {
      // 1. Fetch current inventory with row-level lock (FOR UPDATE)
      const [item] = await tx
        .select()
        .from(this.databaseService.schema.inventoryItems)
        .where(eq(this.databaseService.schema.inventoryItems.variantId, variantId))
        .for('update');

      if (!item) {
        throw new NotFoundException(`Inventory item for variant ${variantId} not found`);
      }

      const previousOnHand = item.quantityOnHand;
      const newOnHand = previousOnHand + input.quantityDelta;

      // 2. Invariant: Prevent negative stock on hand for limited inventory items
      if (!item.isUnlimited && newOnHand < 0) {
        throw new BadRequestException(
          `Insufficient stock on hand: current stock is ${previousOnHand}, adjustment of ${input.quantityDelta} would result in negative inventory (${newOnHand})`,
        );
      }

      // 3. Invariant: Prevent reducing stock below active customer reservations
      if (item.quantityReserved > newOnHand) {
        throw new BadRequestException(
          `Cannot reduce on-hand stock to ${newOnHand}; ${item.quantityReserved} unit(s) are currently locked under active customer reservations`,
        );
      }

      // 4. Update inventory row
      await tx
        .update(this.databaseService.schema.inventoryItems)
        .set({
          quantityOnHand: newOnHand,
          updatedAt: adjustedAt,
        })
        .where(eq(this.databaseService.schema.inventoryItems.id, item.id));

      // 5. Insert immutable adjustment audit record
      await tx.insert(this.databaseService.schema.stockAdjustments).values({
        variantId,
        quantityDelta: input.quantityDelta,
        reason: input.reason,
        actorId: actorId ?? null,
        notes: input.notes ?? null,
      });

      // 6. Record security / business audit event
      await this.auditService.logEvent({
        actorId: actorId ?? null,
        actorRole,
        action: 'INVENTORY_STOCK_ADJUSTED',
        resourceType: 'PRODUCT_VARIANT',
        resourceId: variantId,
        metadata: {
          previousOnHand,
          newOnHand,
          quantityDelta: input.quantityDelta,
          reason: input.reason,
          notes: input.notes ?? null,
        },
      });

      return {
        variantId,
        previousOnHand,
        newOnHand,
        quantityDelta: input.quantityDelta,
        reason: input.reason,
        notes: input.notes ?? null,
        adjustedAt: adjustedAt.toISOString(),
      };
    });
  }

  /**
   * Retrieves current stock metrics for a variant.
   */
  async getVariantStock(variantId: string): Promise<ProductVariantInventoryDto> {
    const [item] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.inventoryItems)
      .where(eq(this.databaseService.schema.inventoryItems.variantId, variantId))
      .limit(1);

    if (!item) {
      return {
        quantityOnHand: 0,
        quantityReserved: 0,
        availableQuantity: 0,
        isUnlimited: false,
        lowStockThreshold: 2,
      };
    }

    const availableQuantity = item.isUnlimited
      ? 999999
      : Math.max(0, item.quantityOnHand - item.quantityReserved);

    return {
      quantityOnHand: item.quantityOnHand,
      quantityReserved: item.quantityReserved,
      availableQuantity,
      isUnlimited: item.isUnlimited,
      lowStockThreshold: item.lowStockThreshold,
    };
  }

  /**
   * Concurrency-safe stock reservation with 15-minute TTL.
   * Locks variant rows in consistent order to prevent deadlocks.
   */
  async createReservations(
    items: { variantId: string; quantity: number }[],
    checkoutId: string,
    cartId?: string,
    ttlMinutes = 15,
    clientTx?: DbTransaction,
  ): Promise<string[]> {
    const run = async (tx: DbTransaction) => {
      // Sort items by variantId to prevent database deadlocks
      const sortedItems = [...items].sort((a, b) => a.variantId.localeCompare(b.variantId));
      const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
      const createdReservationIds: string[] = [];

      for (const item of sortedItems) {
        const [inventoryRow] = await tx
          .select()
          .from(this.databaseService.schema.inventoryItems)
          .where(eq(this.databaseService.schema.inventoryItems.variantId, item.variantId))
          .for('update');

        if (!inventoryRow) {
          throw new BadRequestException(`Inventory item not found for variant ${item.variantId}`);
        }

        const available = inventoryRow.isUnlimited
          ? 999999
          : inventoryRow.quantityOnHand - inventoryRow.quantityReserved;

        if (available < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for variant ${item.variantId}: requested ${item.quantity}, available ${available}`,
          );
        }

        // Increment reserved quantity if not unlimited
        if (!inventoryRow.isUnlimited) {
          await tx
            .update(this.databaseService.schema.inventoryItems)
            .set({
              quantityReserved: inventoryRow.quantityReserved + item.quantity,
              updatedAt: new Date(),
            })
            .where(eq(this.databaseService.schema.inventoryItems.id, inventoryRow.id));
        }

        const [res] = await tx
          .insert(this.databaseService.schema.inventoryReservations)
          .values({
            variantId: item.variantId,
            checkoutId,
            cartId: cartId ?? null,
            quantity: item.quantity,
            status: 'ACTIVE',
            expiresAt,
          })
          .returning();

        if (res) {
          createdReservationIds.push(res.id);
        }
      }

      return createdReservationIds;
    };

    if (clientTx) {
      return run(clientTx);
    }
    return this.databaseService.db.transaction(run);
  }

  /**
   * Release active stock reservations for a checkout session.
   */
  async releaseReservations(checkoutId: string, clientTx?: DbTransaction): Promise<void> {
    const run = async (tx: DbTransaction) => {
      const activeReservations = await tx
        .select()
        .from(this.databaseService.schema.inventoryReservations)
        .where(
          sql`${this.databaseService.schema.inventoryReservations.checkoutId} = ${checkoutId} AND ${this.databaseService.schema.inventoryReservations.status} = 'ACTIVE'`,
        );

      for (const res of activeReservations) {
        const [inventoryRow] = await tx
          .select()
          .from(this.databaseService.schema.inventoryItems)
          .where(eq(this.databaseService.schema.inventoryItems.variantId, res.variantId))
          .for('update');

        if (inventoryRow && !inventoryRow.isUnlimited) {
          const newReserved = Math.max(0, inventoryRow.quantityReserved - res.quantity);
          await tx
            .update(this.databaseService.schema.inventoryItems)
            .set({
              quantityReserved: newReserved,
              updatedAt: new Date(),
            })
            .where(eq(this.databaseService.schema.inventoryItems.id, inventoryRow.id));
        }

        await tx
          .update(this.databaseService.schema.inventoryReservations)
          .set({
            status: 'RELEASED',
            releasedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(this.databaseService.schema.inventoryReservations.id, res.id));
      }
    };

    if (clientTx) {
      return run(clientTx);
    }
    return this.databaseService.db.transaction(run);
  }

  /**
   * Commit active stock reservations on successful checkout confirmation.
   * Decrements on-hand and reserved quantity, records stock adjustment.
   */
  async commitReservations(checkoutId: string, clientTx?: DbTransaction): Promise<void> {
    const run = async (tx: DbTransaction) => {
      const activeReservations = await tx
        .select()
        .from(this.databaseService.schema.inventoryReservations)
        .where(
          sql`${this.databaseService.schema.inventoryReservations.checkoutId} = ${checkoutId} AND ${this.databaseService.schema.inventoryReservations.status} = 'ACTIVE'`,
        );

      for (const res of activeReservations) {
        const [inventoryRow] = await tx
          .select()
          .from(this.databaseService.schema.inventoryItems)
          .where(eq(this.databaseService.schema.inventoryItems.variantId, res.variantId))
          .for('update');

        if (inventoryRow) {
          if (!inventoryRow.isUnlimited) {
            const newOnHand = Math.max(0, inventoryRow.quantityOnHand - res.quantity);
            const newReserved = Math.max(0, inventoryRow.quantityReserved - res.quantity);
            await tx
              .update(this.databaseService.schema.inventoryItems)
              .set({
                quantityOnHand: newOnHand,
                quantityReserved: newReserved,
                updatedAt: new Date(),
              })
              .where(eq(this.databaseService.schema.inventoryItems.id, inventoryRow.id));
          }

          // Insert stock adjustment audit record
          await tx.insert(this.databaseService.schema.stockAdjustments).values({
            variantId: res.variantId,
            quantityDelta: -res.quantity,
            reason: 'SALE_COMMITTED',
            notes: `Checkout committed: ${checkoutId}`,
          });
        }

        await tx
          .update(this.databaseService.schema.inventoryReservations)
          .set({
            status: 'COMMITTED',
            committedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(this.databaseService.schema.inventoryReservations.id, res.id));
      }
    };

    if (clientTx) {
      return run(clientTx);
    }
    return this.databaseService.db.transaction(run);
  }

  /**
   * Expire stale active reservations whose TTL has elapsed.
   */
  async expireStaleReservations(): Promise<number> {
    const now = new Date();
    return this.databaseService.db.transaction(async (tx) => {
      const staleReservations = await tx
        .select()
        .from(this.databaseService.schema.inventoryReservations)
        .where(
          sql`${this.databaseService.schema.inventoryReservations.status} = 'ACTIVE' AND ${this.databaseService.schema.inventoryReservations.expiresAt} < ${now}`,
        );

      for (const res of staleReservations) {
        const [inventoryRow] = await tx
          .select()
          .from(this.databaseService.schema.inventoryItems)
          .where(eq(this.databaseService.schema.inventoryItems.variantId, res.variantId))
          .for('update');

        if (inventoryRow && !inventoryRow.isUnlimited) {
          const newReserved = Math.max(0, inventoryRow.quantityReserved - res.quantity);
          await tx
            .update(this.databaseService.schema.inventoryItems)
            .set({
              quantityReserved: newReserved,
              updatedAt: new Date(),
            })
            .where(eq(this.databaseService.schema.inventoryItems.id, inventoryRow.id));
        }

        await tx
          .update(this.databaseService.schema.inventoryReservations)
          .set({
            status: 'EXPIRED',
            updatedAt: new Date(),
          })
          .where(eq(this.databaseService.schema.inventoryReservations.id, res.id));
      }

      return staleReservations.length;
    });
  }
}
