import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../audit/audit.service';
import type { StockAdjustmentInput } from '@repo/validation';
import type { StockAdjustmentResultDto, ProductVariantInventoryDto } from '@repo/api-contracts';

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
}
