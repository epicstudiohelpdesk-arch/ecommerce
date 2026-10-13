import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { eq, and, or, desc } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';

type DbTransaction = Parameters<Parameters<DatabaseService['db']['transaction']>[0]>[0];
import { AuditService } from '../audit/audit.service';
import { DelhiveryProvider } from './providers/delhivery.provider';
import { MockCourierProvider } from './providers/mock-courier.provider';
import type {
  IShippingProvider,
  ShippingProviderCode,
  AddressInfo,
} from './interfaces/shipping-provider.interface';
import type {
  BookShipmentInput,
  SchedulePickupInput,
  CancelShipmentInput,
  TrackingWebhookPayload,
} from '@repo/validation';
import type {
  ShipmentDto,
  BookShipmentResponseDto,
  ShippingLabelDto,
  SchedulePickupResponseDto,
  CancelShipmentResponseDto,
  CustomerTrackingResponseDto,
  OrderTrackingDto,
  ServiceabilityResponseDto,
  ShipmentStatus,
} from '@repo/api-contracts';

@Injectable()
export class ShippingService {
  private readonly logger = new Logger(ShippingService.name);

  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
    @Inject(AuditService)
    private readonly auditService: AuditService,
    @Inject(DelhiveryProvider)
    private readonly delhiveryProvider: DelhiveryProvider,
    @Inject(MockCourierProvider)
    private readonly mockCourierProvider: MockCourierProvider,
  ) {}

  private getProvider(code?: string): IShippingProvider {
    if (code === 'MOCK_COURIER') {
      return this.mockCourierProvider;
    }
    // Delhivery is default production provider for Indian artisans
    return this.delhiveryProvider;
  }

  private async getSellerByUserId(userId: string) {
    const [seller] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.sellerProfiles)
      .where(eq(this.databaseService.schema.sellerProfiles.userId, userId))
      .limit(1);

    if (!seller) {
      throw new NotFoundException(`No seller profile found for user ${userId}`);
    }

    return seller;
  }

  /**
   * Books a courier shipment for an artisan's sub-order.
   * Requirements:
   * 1. Sub-order must belong to the authenticated seller.
   * 2. Sub-order must be in READY_FOR_PICKUP state.
   * 3. Parent order must be PAID.
   * 4. Idempotency: cannot double-book an active shipment for the same sub-order.
   */
  async bookShipment(
    userId: string,
    subOrderId: string,
    input: BookShipmentInput,
  ): Promise<BookShipmentResponseDto> {
    const seller = await this.getSellerByUserId(userId);

    // 1. Fetch sub-order and parent order
    const [row] = await this.databaseService.db
      .select({
        subOrder: this.databaseService.schema.subOrders,
        parentOrder: this.databaseService.schema.customerOrders,
      })
      .from(this.databaseService.schema.subOrders)
      .innerJoin(
        this.databaseService.schema.customerOrders,
        eq(
          this.databaseService.schema.subOrders.parentOrderId,
          this.databaseService.schema.customerOrders.id,
        ),
      )
      .where(
        and(
          eq(this.databaseService.schema.subOrders.id, subOrderId),
          eq(this.databaseService.schema.subOrders.sellerId, seller.id),
        ),
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException(
        `Sub-order ${subOrderId} not found or not owned by authenticated seller`,
      );
    }

    const { subOrder, parentOrder } = row;

    // 2. Validate fulfilment eligibility
    if (parentOrder.paymentStatus !== 'PAID') {
      throw new BadRequestException(
        `Cannot book shipment for unpaid order. Current payment status: ${parentOrder.paymentStatus}`,
      );
    }

    if (subOrder.status !== 'READY_FOR_PICKUP') {
      throw new BadRequestException(
        `Sub-order must be in 'READY_FOR_PICKUP' state to book courier shipment. Current status: '${subOrder.status}'`,
      );
    }

    // 3. Idempotency check: check if shipment already exists
    const [existingShipment] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.shipments)
      .where(eq(this.databaseService.schema.shipments.subOrderId, subOrderId))
      .limit(1);

    if (existingShipment && existingShipment.status !== 'CANCELLED') {
      throw new ConflictException(
        `Shipment already booked for sub-order ${subOrder.subOrderNumber} with tracking number ${existingShipment.trackingNumber}`,
      );
    }

    // 4. Resolve Origin (Seller Pickup) Address
    const [pickupAddrRow] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.pickupAddresses)
      .where(eq(this.databaseService.schema.pickupAddresses.sellerId, seller.id))
      .orderBy(desc(this.databaseService.schema.pickupAddresses.isDefault))
      .limit(1);

    const originAddress: AddressInfo = pickupAddrRow
      ? {
          name: pickupAddrRow.contactName,
          phone: pickupAddrRow.phone,
          line1: pickupAddrRow.addressLine1,
          line2: pickupAddrRow.addressLine2,
          city: pickupAddrRow.city,
          state: pickupAddrRow.state,
          postalCode: pickupAddrRow.postalCode,
          country: pickupAddrRow.country || 'IN',
        }
      : {
          name: seller.legalName || 'Handcrafted Artisan',
          phone: '+91 98765 00000',
          line1: 'Artisan Workshop Studio',
          city: 'Jaipur',
          state: 'Rajasthan',
          postalCode: '302001',
          country: 'IN',
        };

    // 5. Resolve Destination (Customer Delivery) Address
    const rawDelivery = (parentOrder.shippingAddress as Record<string, string>) || {};
    const destinationAddress: AddressInfo = {
      name: rawDelivery['recipientName'] || 'Valued Customer',
      phone: rawDelivery['phone'] || '+91 99999 99999',
      line1: rawDelivery['line1'] || 'Main Road',
      line2: rawDelivery['line2'] || null,
      city: rawDelivery['city'] || 'New Delhi',
      state: rawDelivery['state'] || 'Delhi',
      postalCode: rawDelivery['postalCode'] || '110001',
      country: rawDelivery['country'] || 'IN',
    };

    // 6. Invoke Courier Provider
    const provider = this.getProvider(input.carrierCode);
    const providerResult = await provider.bookShipment({
      subOrderId: subOrder.id,
      subOrderNumber: subOrder.subOrderNumber,
      parentOrderNumber: parentOrder.orderNumber,
      originAddress,
      destinationAddress,
      weightGrams: input.packageWeightGrams,
      dimensionsMm: input.packageDimensionsMm,
      pickupDate: input.pickupDate,
      declaredValueMinor: subOrder.itemSubtotalMinor,
      currency: subOrder.currency,
      isCod: false,
      notes: input.notes,
    });

    const now = new Date();
    const pickupDateObj = new Date(input.pickupDate);
    const labelUrl =
      providerResult.labelUrl || `/api/v1/seller/orders/${subOrderId}/shipment/label`;

    let shipmentId = '';

    // 7. Atomic DB Transaction: Save shipment and initial milestone
    await this.databaseService.db.transaction(async (tx) => {
      if (existingShipment && existingShipment.status === 'CANCELLED') {
        // Reuse slot by updating cancelled record
        await tx
          .update(this.databaseService.schema.shipments)
          .set({
            courierCode: provider.providerCode,
            trackingNumber: providerResult.trackingNumber,
            waybillNumber: providerResult.waybillNumber,
            labelUrl,
            status: 'LABEL_CREATED',
            weightGrams: input.packageWeightGrams,
            lengthMm: input.packageDimensionsMm.length,
            widthMm: input.packageDimensionsMm.width,
            heightMm: input.packageDimensionsMm.height,
            pickupDate: pickupDateObj,
            cancellationReason: null,
            pickupAddressSnapshot: originAddress as unknown as Record<string, unknown>,
            deliveryAddressSnapshot: destinationAddress as unknown as Record<string, unknown>,
            carrierMetadata: providerResult.carrierMetadata || null,
            updatedAt: now,
          })
          .where(eq(this.databaseService.schema.shipments.id, existingShipment.id));
        shipmentId = existingShipment.id;
      } else {
        const [inserted] = await tx
          .insert(this.databaseService.schema.shipments)
          .values({
            subOrderId: subOrder.id,
            courierCode: provider.providerCode,
            trackingNumber: providerResult.trackingNumber,
            waybillNumber: providerResult.waybillNumber,
            labelUrl,
            status: 'LABEL_CREATED',
            weightGrams: input.packageWeightGrams,
            lengthMm: input.packageDimensionsMm.length,
            widthMm: input.packageDimensionsMm.width,
            heightMm: input.packageDimensionsMm.height,
            pickupDate: pickupDateObj,
            pickupAddressSnapshot: originAddress as unknown as Record<string, unknown>,
            deliveryAddressSnapshot: destinationAddress as unknown as Record<string, unknown>,
            carrierMetadata: providerResult.carrierMetadata || null,
            createdAt: now,
            updatedAt: now,
          })
          .returning({ id: this.databaseService.schema.shipments.id });
        shipmentId = inserted!.id;
      }

      // Record initial shipment milestone
      await tx.insert(this.databaseService.schema.shipmentMilestones).values({
        shipmentId,
        status: 'LABEL_CREATED',
        location: `${originAddress.city}, ${originAddress.state}`,
        description: `Shipment booked with ${provider.carrierName}. Waybill generated.`,
        eventTime: now,
        rawPayload: { provider: provider.providerCode, waybill: providerResult.waybillNumber },
      });

      // Record order timeline event
      await tx.insert(this.databaseService.schema.orderTimelineEvents).values({
        subOrderId: subOrder.id,
        fromStatus: subOrder.status,
        toStatus: subOrder.status,
        actorId: userId,
        notes: `Courier shipment booked via ${provider.carrierName}. AWB: ${providerResult.waybillNumber}`,
      });
    });

    // 8. Audit Logging
    await this.auditService.logEvent({
      actorId: userId,
      actorRole: 'APPROVED_SELLER',
      action: 'COURIER_SHIPMENT_BOOKED',
      resourceType: 'SHIPMENT',
      resourceId: shipmentId,
      metadata: {
        subOrderId,
        subOrderNumber: subOrder.subOrderNumber,
        carrierCode: provider.providerCode,
        waybillNumber: providerResult.waybillNumber,
        trackingNumber: providerResult.trackingNumber,
      },
    });

    this.logger.log(
      `Shipment booked for subOrder ${subOrder.subOrderNumber}: AWB ${providerResult.waybillNumber}`,
    );

    return {
      shipmentId,
      subOrderId,
      carrierCode: provider.providerCode as ShippingProviderCode,
      waybillNumber: providerResult.waybillNumber,
      trackingNumber: providerResult.trackingNumber,
      status: 'LABEL_CREATED',
      labelUrl,
      pickupDate: input.pickupDate,
    };
  }

  /**
   * Retrieves shipment details for a seller's sub-order.
   */
  async getSellerShipment(userId: string, subOrderId: string): Promise<ShipmentDto> {
    const seller = await this.getSellerByUserId(userId);

    const [row] = await this.databaseService.db
      .select({
        shipment: this.databaseService.schema.shipments,
        subOrder: this.databaseService.schema.subOrders,
        parentOrder: this.databaseService.schema.customerOrders,
      })
      .from(this.databaseService.schema.shipments)
      .innerJoin(
        this.databaseService.schema.subOrders,
        eq(
          this.databaseService.schema.shipments.subOrderId,
          this.databaseService.schema.subOrders.id,
        ),
      )
      .innerJoin(
        this.databaseService.schema.customerOrders,
        eq(
          this.databaseService.schema.subOrders.parentOrderId,
          this.databaseService.schema.customerOrders.id,
        ),
      )
      .where(
        and(
          eq(this.databaseService.schema.shipments.subOrderId, subOrderId),
          eq(this.databaseService.schema.subOrders.sellerId, seller.id),
        ),
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException(
        `Shipment not found for sub-order ${subOrderId} or not owned by authenticated seller`,
      );
    }

    const { shipment, parentOrder } = row;

    // Fetch milestones
    const milestones = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.shipmentMilestones)
      .where(eq(this.databaseService.schema.shipmentMilestones.shipmentId, shipment.id))
      .orderBy(this.databaseService.schema.shipmentMilestones.eventTime);

    return {
      id: shipment.id,
      subOrderId: shipment.subOrderId,
      orderNumber: parentOrder.orderNumber,
      carrierCode: shipment.courierCode as ShippingProviderCode,
      status: shipment.status as ShipmentStatus,
      waybillNumber: shipment.waybillNumber,
      trackingNumber: shipment.trackingNumber,
      packageWeightGrams: shipment.weightGrams,
      packageDimensionsMm: {
        length: shipment.lengthMm,
        width: shipment.widthMm,
        height: shipment.heightMm,
      },
      pickupDate: shipment.pickupDate?.toISOString() || null,
      labelUrl: shipment.labelUrl,
      cancellationReason: shipment.cancellationReason,
      carrierMetadata: shipment.carrierMetadata as Record<string, unknown> | null,
      pickupAddressSnapshot: shipment.pickupAddressSnapshot as Record<string, unknown> | null,
      deliveryAddressSnapshot: shipment.deliveryAddressSnapshot as Record<string, unknown> | null,
      milestones: milestones.map((m) => ({
        id: m.id,
        status: m.status,
        location: m.location,
        description: m.description,
        eventTime: m.eventTime.toISOString(),
      })),
      createdAt: shipment.createdAt.toISOString(),
      updatedAt: shipment.updatedAt.toISOString(),
    };
  }

  /**
   * Generates or retrieves the printable shipping label for an artisan.
   */
  async getShippingLabel(userId: string, subOrderId: string): Promise<ShippingLabelDto> {
    const seller = await this.getSellerByUserId(userId);

    const [row] = await this.databaseService.db
      .select({
        shipment: this.databaseService.schema.shipments,
        subOrder: this.databaseService.schema.subOrders,
        parentOrder: this.databaseService.schema.customerOrders,
      })
      .from(this.databaseService.schema.shipments)
      .innerJoin(
        this.databaseService.schema.subOrders,
        eq(
          this.databaseService.schema.shipments.subOrderId,
          this.databaseService.schema.subOrders.id,
        ),
      )
      .innerJoin(
        this.databaseService.schema.customerOrders,
        eq(
          this.databaseService.schema.subOrders.parentOrderId,
          this.databaseService.schema.customerOrders.id,
        ),
      )
      .where(
        and(
          eq(this.databaseService.schema.shipments.subOrderId, subOrderId),
          eq(this.databaseService.schema.subOrders.sellerId, seller.id),
        ),
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException(
        `Shipment not found for sub-order ${subOrderId} or not owned by authenticated seller`,
      );
    }

    const { shipment, subOrder, parentOrder } = row;
    const provider = this.getProvider(shipment.courierCode);

    const origin = (shipment.pickupAddressSnapshot as unknown as AddressInfo) || {
      name: seller.legalName,
      phone: '+91 98765 00000',
      line1: 'Artisan Workshop',
      city: 'Jaipur',
      state: 'Rajasthan',
      postalCode: '302001',
      country: 'IN',
    };

    const dest = (shipment.deliveryAddressSnapshot as unknown as AddressInfo) || {
      name: 'Customer',
      phone: '+91 99999 99999',
      line1: 'Delivery Address',
      city: 'New Delhi',
      state: 'Delhi',
      postalCode: '110001',
      country: 'IN',
    };

    const labelResult = await provider.generateShippingLabel({
      waybillNumber: shipment.waybillNumber || shipment.trackingNumber,
      trackingNumber: shipment.trackingNumber,
      subOrderNumber: subOrder.subOrderNumber,
      parentOrderNumber: parentOrder.orderNumber,
      originAddress: origin,
      destinationAddress: dest,
      weightGrams: shipment.weightGrams,
      dimensionsMm: {
        length: shipment.lengthMm,
        width: shipment.widthMm,
        height: shipment.heightMm,
      },
      carrierName: provider.carrierName,
      shippedAt: shipment.shippedAt || undefined,
    });

    return {
      shipmentId: shipment.id,
      waybillNumber: shipment.waybillNumber || shipment.trackingNumber,
      carrierCode: shipment.courierCode,
      labelUrl: shipment.labelUrl || labelResult.labelUrl,
      contentHtml: labelResult.contentHtml,
    };
  }

  /**
   * Schedules a courier pickup for a booked shipment.
   */
  async schedulePickup(
    userId: string,
    subOrderId: string,
    input: SchedulePickupInput,
  ): Promise<SchedulePickupResponseDto> {
    const seller = await this.getSellerByUserId(userId);

    const [shipment] = await this.databaseService.db
      .select({
        shipment: this.databaseService.schema.shipments,
        subOrder: this.databaseService.schema.subOrders,
      })
      .from(this.databaseService.schema.shipments)
      .innerJoin(
        this.databaseService.schema.subOrders,
        eq(
          this.databaseService.schema.shipments.subOrderId,
          this.databaseService.schema.subOrders.id,
        ),
      )
      .where(
        and(
          eq(this.databaseService.schema.shipments.subOrderId, subOrderId),
          eq(this.databaseService.schema.subOrders.sellerId, seller.id),
        ),
      )
      .limit(1);

    if (!shipment) {
      throw new NotFoundException(`Shipment not found for sub-order ${subOrderId}`);
    }

    if (
      shipment.shipment.status !== 'LABEL_CREATED' &&
      shipment.shipment.status !== 'PICKUP_SCHEDULED'
    ) {
      throw new BadRequestException(
        `Cannot schedule pickup for shipment in status '${shipment.shipment.status}'`,
      );
    }

    const provider = this.getProvider(shipment.shipment.courierCode);
    const origin = (shipment.shipment.pickupAddressSnapshot as unknown as AddressInfo) || {
      name: seller.legalName,
      phone: '+91 98765 00000',
      line1: 'Artisan Workshop',
      city: 'Jaipur',
      state: 'Rajasthan',
      postalCode: '302001',
      country: 'IN',
    };

    const providerResult = await provider.schedulePickup({
      waybillNumber: shipment.shipment.waybillNumber || shipment.shipment.trackingNumber,
      pickupAddress: origin,
      pickupDate: input.pickupDate,
      timeSlot: input.timeSlot,
      packageCount: 1,
      notes: input.notes,
    });

    const now = new Date();
    await this.databaseService.db.transaction(async (tx) => {
      await tx
        .update(this.databaseService.schema.shipments)
        .set({
          status: 'PICKUP_SCHEDULED',
          pickupDate: new Date(input.pickupDate),
          carrierMetadata: {
            ...((shipment.shipment.carrierMetadata as Record<string, unknown>) || {}),
            ...providerResult.carrierMetadata,
            pickupToken: providerResult.pickupToken,
          },
          updatedAt: now,
        })
        .where(eq(this.databaseService.schema.shipments.id, shipment.shipment.id));

      await tx.insert(this.databaseService.schema.shipmentMilestones).values({
        shipmentId: shipment.shipment.id,
        status: 'PICKUP_SCHEDULED',
        location: `${origin.city}, ${origin.state}`,
        description: `Pickup scheduled with ${provider.carrierName} for ${input.pickupDate}. Token: ${providerResult.pickupToken}`,
        eventTime: now,
      });

      await tx.insert(this.databaseService.schema.orderTimelineEvents).values({
        subOrderId: shipment.subOrder.id,
        fromStatus: shipment.subOrder.status,
        toStatus: shipment.subOrder.status,
        actorId: userId,
        notes: `Courier pickup scheduled for ${input.pickupDate} (Token: ${providerResult.pickupToken})`,
      });
    });

    await this.auditService.logEvent({
      actorId: userId,
      actorRole: 'APPROVED_SELLER',
      action: 'COURIER_PICKUP_SCHEDULED',
      resourceType: 'SHIPMENT',
      resourceId: shipment.shipment.id,
      metadata: {
        subOrderId,
        pickupDate: input.pickupDate,
        pickupToken: providerResult.pickupToken,
      },
    });

    return {
      shipmentId: shipment.shipment.id,
      pickupScheduled: true,
      pickupDate: input.pickupDate,
      pickupToken: providerResult.pickupToken,
      status: 'PICKUP_SCHEDULED',
    };
  }

  /**
   * Cancels a shipment before courier dispatch.
   */
  async cancelShipment(
    userId: string,
    subOrderId: string,
    input: CancelShipmentInput,
  ): Promise<CancelShipmentResponseDto> {
    const seller = await this.getSellerByUserId(userId);

    const [shipment] = await this.databaseService.db
      .select({
        shipment: this.databaseService.schema.shipments,
        subOrder: this.databaseService.schema.subOrders,
      })
      .from(this.databaseService.schema.shipments)
      .innerJoin(
        this.databaseService.schema.subOrders,
        eq(
          this.databaseService.schema.shipments.subOrderId,
          this.databaseService.schema.subOrders.id,
        ),
      )
      .where(
        and(
          eq(this.databaseService.schema.shipments.subOrderId, subOrderId),
          eq(this.databaseService.schema.subOrders.sellerId, seller.id),
        ),
      )
      .limit(1);

    if (!shipment) {
      throw new NotFoundException(`Shipment not found for sub-order ${subOrderId}`);
    }

    if (
      shipment.shipment.status === 'IN_TRANSIT' ||
      shipment.shipment.status === 'OUT_FOR_DELIVERY' ||
      shipment.shipment.status === 'DELIVERED'
    ) {
      throw new BadRequestException(
        `Cannot cancel shipment that has already been dispatched with courier (status: ${shipment.shipment.status})`,
      );
    }

    if (shipment.shipment.status === 'CANCELLED') {
      return {
        shipmentId: shipment.shipment.id,
        status: 'CANCELLED',
        cancelledAt: shipment.shipment.updatedAt.toISOString(),
        reason: shipment.shipment.cancellationReason || input.reason,
      };
    }

    const provider = this.getProvider(shipment.shipment.courierCode);
    await provider.cancelShipment(
      shipment.shipment.waybillNumber || shipment.shipment.trackingNumber,
      input.reason,
    );

    const now = new Date();
    await this.databaseService.db.transaction(async (tx) => {
      await tx
        .update(this.databaseService.schema.shipments)
        .set({
          status: 'CANCELLED',
          cancellationReason: input.reason,
          updatedAt: now,
        })
        .where(eq(this.databaseService.schema.shipments.id, shipment.shipment.id));

      await tx.insert(this.databaseService.schema.shipmentMilestones).values({
        shipmentId: shipment.shipment.id,
        status: 'CANCELLED',
        location: null,
        description: `Shipment cancelled: ${input.reason}`,
        eventTime: now,
      });

      await tx.insert(this.databaseService.schema.orderTimelineEvents).values({
        subOrderId: shipment.subOrder.id,
        fromStatus: shipment.subOrder.status,
        toStatus: shipment.subOrder.status,
        actorId: userId,
        notes: `Courier shipment cancelled: ${input.reason}`,
      });
    });

    await this.auditService.logEvent({
      actorId: userId,
      actorRole: 'APPROVED_SELLER',
      action: 'COURIER_SHIPMENT_CANCELLED',
      resourceType: 'SHIPMENT',
      resourceId: shipment.shipment.id,
      metadata: {
        subOrderId,
        reason: input.reason,
      },
    });

    return {
      shipmentId: shipment.shipment.id,
      status: 'CANCELLED',
      cancelledAt: now.toISOString(),
      reason: input.reason,
    };
  }

  /**
   * Processes an incoming tracking webhook from a logistics provider.
   * Performs cryptographic signature validation, monotonic milestone recording,
   * and synchronizes sub-order and parent-order state machines.
   */
  async processTrackingWebhook(
    providerCode: string,
    rawBody: string | Buffer,
    signature: string,
    payload: TrackingWebhookPayload,
  ) {
    const provider = this.getProvider(providerCode);

    // 1. Validate signature
    const isValid = provider.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      this.logger.warn(`Invalid courier webhook signature from provider: ${providerCode}`);
      throw new UnauthorizedException('Invalid courier webhook signature');
    }

    const searchNum = payload.waybillNumber || payload.trackingNumber;
    if (!searchNum) {
      throw new BadRequestException('Webhook payload missing waybill or tracking number');
    }

    // 2. Find shipment
    const [row] = await this.databaseService.db
      .select({
        shipment: this.databaseService.schema.shipments,
        subOrder: this.databaseService.schema.subOrders,
        parentOrder: this.databaseService.schema.customerOrders,
      })
      .from(this.databaseService.schema.shipments)
      .innerJoin(
        this.databaseService.schema.subOrders,
        eq(
          this.databaseService.schema.shipments.subOrderId,
          this.databaseService.schema.subOrders.id,
        ),
      )
      .innerJoin(
        this.databaseService.schema.customerOrders,
        eq(
          this.databaseService.schema.subOrders.parentOrderId,
          this.databaseService.schema.customerOrders.id,
        ),
      )
      .where(
        or(
          eq(this.databaseService.schema.shipments.waybillNumber, searchNum),
          eq(this.databaseService.schema.shipments.trackingNumber, searchNum),
        ),
      )
      .limit(1);

    if (!row) {
      this.logger.warn(`No shipment found matching courier identifier: ${searchNum}`);
      return { processed: false, reason: 'Shipment not found' };
    }

    const { shipment, subOrder, parentOrder } = row;
    const now = new Date();
    const eventTime = payload.eventTime ? new Date(payload.eventTime) : now;

    // 3. Map status to canonical ShipmentStatus
    const mappedStatus = this.mapCarrierStatus(payload.status);

    // 4. Ingest Milestone and Transition State
    await this.databaseService.db.transaction(async (tx) => {
      // Always record the tracking milestone
      await tx.insert(this.databaseService.schema.shipmentMilestones).values({
        shipmentId: shipment.id,
        status: mappedStatus,
        location: payload.location || null,
        description: payload.description,
        eventTime,
        rawPayload: payload.rawPayload || (payload as unknown as Record<string, unknown>),
      });

      // State machine logic: prevent regressing if already in a more advanced state
      const isAdvanceValid = this.canAdvanceShipmentStatus(
        shipment.status as ShipmentStatus,
        mappedStatus,
      );

      if (isAdvanceValid) {
        const updateData: Record<string, unknown> = {
          status: mappedStatus,
          updatedAt: now,
        };

        if (mappedStatus === 'IN_TRANSIT' && !shipment.shippedAt) {
          updateData['shippedAt'] = eventTime;
        }
        if (mappedStatus === 'DELIVERED') {
          updateData['deliveredAt'] = eventTime;
        }

        await tx
          .update(this.databaseService.schema.shipments)
          .set(updateData)
          .where(eq(this.databaseService.schema.shipments.id, shipment.id));

        // Synchronize Sub-Order state
        if (mappedStatus === 'IN_TRANSIT' && subOrder.status !== 'SHIPPED') {
          await tx
            .update(this.databaseService.schema.subOrders)
            .set({ status: 'SHIPPED', updatedAt: now })
            .where(eq(this.databaseService.schema.subOrders.id, subOrder.id));

          await tx.insert(this.databaseService.schema.orderTimelineEvents).values({
            subOrderId: subOrder.id,
            fromStatus: subOrder.status,
            toStatus: 'SHIPPED',
            notes: `Parcel scanned by ${provider.carrierName}: In transit to recipient. ${payload.description}`,
          });

          // Check and update parent order status
          await this.syncParentOrderStatus(tx, parentOrder.id);
        } else if (mappedStatus === 'DELIVERED' && subOrder.status !== 'DELIVERED') {
          await tx
            .update(this.databaseService.schema.subOrders)
            .set({ status: 'DELIVERED', completedAt: now, updatedAt: now })
            .where(eq(this.databaseService.schema.subOrders.id, subOrder.id));

          await tx.insert(this.databaseService.schema.orderTimelineEvents).values({
            subOrderId: subOrder.id,
            fromStatus: subOrder.status,
            toStatus: 'DELIVERED',
            notes: `Parcel delivered to recipient: ${payload.description}`,
          });

          // Check and update parent order status
          await this.syncParentOrderStatus(tx, parentOrder.id);
        }
      }
    });

    await this.auditService.logEvent({
      actorRole: 'LOGISTICS_WEBHOOK',
      action: 'COURIER_TRACKING_WEBHOOK_INGESTED',
      resourceType: 'SHIPMENT',
      resourceId: shipment.id,
      metadata: {
        provider: providerCode,
        waybillNumber: shipment.waybillNumber,
        status: mappedStatus,
        location: payload.location,
      },
    });

    return {
      processed: true,
      shipmentId: shipment.id,
      status: mappedStatus,
    };
  }

  /**
   * Helper to synchronize the parent customer order status based on all child sub-orders.
   */
  private async syncParentOrderStatus(tx: DbTransaction, parentOrderId: string) {
    const siblingSubOrders = await tx
      .select({ status: this.databaseService.schema.subOrders.status })
      .from(this.databaseService.schema.subOrders)
      .where(eq(this.databaseService.schema.subOrders.parentOrderId, parentOrderId));

    const allDelivered = siblingSubOrders.every(
      (s: { status: string }) => s.status === 'DELIVERED',
    );
    const anyShippedOrDelivered = siblingSubOrders.some(
      (s: { status: string }) => s.status === 'SHIPPED' || s.status === 'DELIVERED',
    );

    let targetParentStatus: 'COMPLETED' | 'PARTIALLY_SHIPPED' | null = null;

    if (allDelivered) {
      targetParentStatus = 'COMPLETED';
    } else if (anyShippedOrDelivered) {
      targetParentStatus = 'PARTIALLY_SHIPPED';
    }

    if (targetParentStatus) {
      await tx
        .update(this.databaseService.schema.customerOrders)
        .set({ orderStatus: targetParentStatus, updatedAt: new Date() })
        .where(eq(this.databaseService.schema.customerOrders.id, parentOrderId));
    }
  }

  private mapCarrierStatus(raw: string): ShipmentStatus {
    const s = raw.toUpperCase();
    if (s.includes('DELIVERED')) return 'DELIVERED';
    if (s.includes('OUT_FOR_DELIVERY') || s.includes('OFD')) return 'OUT_FOR_DELIVERY';
    if (
      s.includes('IN_TRANSIT') ||
      s.includes('TRANSIT') ||
      s.includes('PICKED_UP') ||
      s.includes('DISPATCH')
    )
      return 'IN_TRANSIT';
    if (s.includes('PICKUP_SCHEDULED') || s.includes('SCHEDULED')) return 'PICKUP_SCHEDULED';
    if (s.includes('RTO_DELIVERED')) return 'RTO_DELIVERED';
    if (s.includes('RTO')) return 'RTO_INITIATED';
    if (s.includes('FAIL') || s.includes('UNDELIVERED')) return 'DELIVERY_FAILED';
    if (s.includes('CANCEL')) return 'CANCELLED';
    return 'IN_TRANSIT';
  }

  private canAdvanceShipmentStatus(current: ShipmentStatus, target: ShipmentStatus): boolean {
    const hierarchy: Record<ShipmentStatus, number> = {
      LABEL_CREATED: 1,
      PICKUP_SCHEDULED: 2,
      IN_TRANSIT: 3,
      OUT_FOR_DELIVERY: 4,
      DELIVERY_FAILED: 4,
      DELIVERED: 5,
      RTO_INITIATED: 4,
      RTO_DELIVERED: 5,
      CANCELLED: 99,
    };

    if (current === 'DELIVERED') return false; // terminal
    if (current === 'CANCELLED') return false; // terminal
    if (target === 'CANCELLED') return hierarchy[current] <= 2;

    return hierarchy[target] >= hierarchy[current];
  }

  /**
   * Customer tracking query: returns timeline milestones across all shipments in the order.
   * Redacts sensitive internal details.
   */
  async getCustomerOrderTracking(orderNumber: string): Promise<CustomerTrackingResponseDto> {
    const [order] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.customerOrders)
      .where(eq(this.databaseService.schema.customerOrders.orderNumber, orderNumber))
      .limit(1);

    if (!order) {
      throw new NotFoundException(`Order ${orderNumber} not found`);
    }

    const subOrdersList = await this.databaseService.db
      .select({
        subOrder: this.databaseService.schema.subOrders,
        shop: this.databaseService.schema.shops,
      })
      .from(this.databaseService.schema.subOrders)
      .leftJoin(
        this.databaseService.schema.shops,
        eq(
          this.databaseService.schema.subOrders.sellerId,
          this.databaseService.schema.shops.sellerId,
        ),
      )
      .where(eq(this.databaseService.schema.subOrders.parentOrderId, order.id));

    const shipmentsOut: OrderTrackingDto[] = [];

    for (const item of subOrdersList) {
      const [shipment] = await this.databaseService.db
        .select()
        .from(this.databaseService.schema.shipments)
        .where(eq(this.databaseService.schema.shipments.subOrderId, item.subOrder.id))
        .limit(1);

      if (shipment) {
        const milestones = await this.databaseService.db
          .select()
          .from(this.databaseService.schema.shipmentMilestones)
          .where(eq(this.databaseService.schema.shipmentMilestones.shipmentId, shipment.id))
          .orderBy(this.databaseService.schema.shipmentMilestones.eventTime);

        const provider = this.getProvider(shipment.courierCode);

        shipmentsOut.push({
          orderNumber,
          subOrderId: item.subOrder.id,
          sellerShopName: item.shop?.name || 'Artisan Workshop',
          carrier: shipment.courierCode as ShippingProviderCode,
          carrierName: provider.carrierName,
          trackingNumber: shipment.trackingNumber,
          status: shipment.status as ShipmentStatus,
          estimatedDeliveryDate: shipment.pickupDate
            ? new Date(shipment.pickupDate.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString()
            : null,
          checkpoints: milestones.map((m) => ({
            status: m.status,
            location: m.location,
            description: m.description,
            timestamp: m.eventTime.toISOString(),
          })),
        });
      }
    }

    return {
      orderNumber,
      customerOrderState: order.orderStatus,
      shipments: shipmentsOut,
    };
  }

  /**
   * Public tracking by waybill or tracking number.
   */
  async getPublicTracking(trackingNumber: string) {
    const [row] = await this.databaseService.db
      .select({
        shipment: this.databaseService.schema.shipments,
        subOrder: this.databaseService.schema.subOrders,
      })
      .from(this.databaseService.schema.shipments)
      .innerJoin(
        this.databaseService.schema.subOrders,
        eq(
          this.databaseService.schema.shipments.subOrderId,
          this.databaseService.schema.subOrders.id,
        ),
      )
      .where(
        or(
          eq(this.databaseService.schema.shipments.trackingNumber, trackingNumber),
          eq(this.databaseService.schema.shipments.waybillNumber, trackingNumber),
        ),
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException(`Tracking identifier ${trackingNumber} not found`);
    }

    const { shipment } = row;
    const milestones = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.shipmentMilestones)
      .where(eq(this.databaseService.schema.shipmentMilestones.shipmentId, shipment.id))
      .orderBy(this.databaseService.schema.shipmentMilestones.eventTime);

    const provider = this.getProvider(shipment.courierCode);

    return {
      trackingNumber: shipment.trackingNumber,
      waybillNumber: shipment.waybillNumber,
      carrierCode: shipment.courierCode,
      carrierName: provider.carrierName,
      status: shipment.status,
      shippedAt: shipment.shippedAt?.toISOString() || null,
      deliveredAt: shipment.deliveredAt?.toISOString() || null,
      checkpoints: milestones.map((m) => ({
        status: m.status,
        location: m.location,
        description: m.description,
        timestamp: m.eventTime.toISOString(),
      })),
    };
  }

  /**
   * Checks delivery serviceability between PIN codes.
   */
  async checkServiceability(
    originPostalCode: string,
    destinationPostalCode: string,
    carrierCode?: string,
  ): Promise<ServiceabilityResponseDto> {
    const provider = this.getProvider(carrierCode);
    const result = await provider.checkServiceability(originPostalCode, destinationPostalCode);

    return {
      serviceable: result.serviceable,
      originPostalCode: result.originPostalCode,
      destinationPostalCode: result.destinationPostalCode,
      carrierCode: result.carrierCode as ShippingProviderCode,
      estimatedDeliveryDays: result.estimatedDeliveryDays,
      codAvailable: result.codAvailable,
    };
  }
}
