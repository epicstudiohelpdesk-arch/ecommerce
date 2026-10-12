import { Injectable, NotFoundException } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import type { customerAddresses } from '@repo/db';
import type { DeliveryAddressInput } from '@repo/validation';
import type { CustomerAddressDto } from '@repo/api-contracts';

@Injectable()
export class AddressService {
  constructor(private readonly databaseService: DatabaseService) {}

  async listAddresses(customerId: string): Promise<CustomerAddressDto[]> {
    const rows = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.customerAddresses)
      .where(eq(this.databaseService.schema.customerAddresses.customerId, customerId))
      .orderBy(
        desc(this.databaseService.schema.customerAddresses.isDefault),
        desc(this.databaseService.schema.customerAddresses.createdAt),
      );

    return rows.map((r) => this.mapToDto(r));
  }

  async getAddressById(customerId: string, addressId: string): Promise<CustomerAddressDto> {
    const [row] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.customerAddresses)
      .where(
        and(
          eq(this.databaseService.schema.customerAddresses.id, addressId),
          eq(this.databaseService.schema.customerAddresses.customerId, customerId),
        ),
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException(`Customer address ${addressId} not found`);
    }

    return this.mapToDto(row);
  }

  async createAddress(
    customerId: string,
    input: DeliveryAddressInput,
  ): Promise<CustomerAddressDto> {
    return this.databaseService.db.transaction(async (tx) => {
      // If marked default, unset default on other addresses
      if (input.isDefault) {
        await tx
          .update(this.databaseService.schema.customerAddresses)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(eq(this.databaseService.schema.customerAddresses.customerId, customerId));
      }

      const [created] = await tx
        .insert(this.databaseService.schema.customerAddresses)
        .values({
          customerId,
          recipientName: input.recipientName,
          phone: input.phone,
          addressLine1: input.addressLine1,
          addressLine2: input.addressLine2 ?? null,
          locality: input.locality ?? null,
          city: input.city,
          state: input.state,
          postalCode: input.postalCode,
          country: input.country ?? 'IN',
          deliveryInstructions: input.deliveryInstructions ?? null,
          isDefault: input.isDefault ?? false,
        })
        .returning();

      if (!created) {
        throw new NotFoundException('Failed to create customer address');
      }

      return this.mapToDto(created);
    });
  }

  async updateAddress(
    customerId: string,
    addressId: string,
    input: DeliveryAddressInput,
  ): Promise<CustomerAddressDto> {
    await this.getAddressById(customerId, addressId);

    return this.databaseService.db.transaction(async (tx) => {
      if (input.isDefault) {
        await tx
          .update(this.databaseService.schema.customerAddresses)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(eq(this.databaseService.schema.customerAddresses.customerId, customerId));
      }

      const [updated] = await tx
        .update(this.databaseService.schema.customerAddresses)
        .set({
          recipientName: input.recipientName,
          phone: input.phone,
          addressLine1: input.addressLine1,
          addressLine2: input.addressLine2 ?? null,
          locality: input.locality ?? null,
          city: input.city,
          state: input.state,
          postalCode: input.postalCode,
          country: input.country ?? 'IN',
          deliveryInstructions: input.deliveryInstructions ?? null,
          isDefault: input.isDefault ?? false,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(this.databaseService.schema.customerAddresses.id, addressId),
            eq(this.databaseService.schema.customerAddresses.customerId, customerId),
          ),
        )
        .returning();

      if (!updated) {
        throw new NotFoundException('Failed to update customer address');
      }

      return this.mapToDto(updated);
    });
  }

  async deleteAddress(customerId: string, addressId: string): Promise<void> {
    await this.getAddressById(customerId, addressId);

    await this.databaseService.db
      .delete(this.databaseService.schema.customerAddresses)
      .where(
        and(
          eq(this.databaseService.schema.customerAddresses.id, addressId),
          eq(this.databaseService.schema.customerAddresses.customerId, customerId),
        ),
      );
  }

  private mapToDto(row: typeof customerAddresses.$inferSelect): CustomerAddressDto {
    return {
      id: row.id,
      customerId: row.customerId,
      recipientName: row.recipientName,
      phone: row.phone,
      addressLine1: row.addressLine1,
      addressLine2: row.addressLine2 ?? null,
      locality: row.locality ?? null,
      city: row.city,
      state: row.state,
      postalCode: row.postalCode,
      country: row.country,
      deliveryInstructions: row.deliveryInstructions ?? null,
      isDefault: row.isDefault,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
