import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { eq, and, sql } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../audit/audit.service';
import { CartService } from '../cart/cart.service';
import { InventoryService } from '../catalog/inventory.service';
import { PricingService } from './pricing.service';
import { AddressService } from './address.service';
import type {
  CheckoutQuoteQueryInput,
  CreateCheckoutSessionInput,
  ConfirmCheckoutInput,
} from '@repo/validation';
import type {
  PricingBreakdownDto,
  CheckoutSessionDto,
  CheckoutOrderConfirmationDto,
  CustomerAddressDto,
  SubOrderSummaryDto,
} from '@repo/api-contracts';

@Injectable()
export class CheckoutService {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
    @Inject(AuditService)
    private readonly auditService: AuditService,
    @Inject(CartService)
    private readonly cartService: CartService,
    @Inject(InventoryService)
    private readonly inventoryService: InventoryService,
    @Inject(PricingService)
    private readonly pricingService: PricingService,
    @Inject(AddressService)
    private readonly addressService: AddressService,
  ) {}

  /**
   * Generates authoritative quote and price breakdown for current cart and selected delivery address.
   */
  async getQuote(
    identifier: { customerId?: string; sessionId?: string },
    input: CheckoutQuoteQueryInput,
  ): Promise<{ pricing: PricingBreakdownDto; deliveryAddress?: CustomerAddressDto | null }> {
    const cart = await this.cartService.getCart(identifier);

    if (cart.itemsCount === 0) {
      throw new BadRequestException('Shopping cart is empty');
    }

    if (cart.hasUnavailableItems) {
      throw new BadRequestException('Shopping cart contains unavailable or out-of-stock items');
    }

    let deliveryAddress: CustomerAddressDto | null = null;
    if (input.shippingAddressId && identifier.customerId) {
      deliveryAddress = await this.addressService.getAddressById(
        identifier.customerId,
        input.shippingAddressId,
      );
    } else if (input.addressInput) {
      deliveryAddress = {
        id: 'transient',
        customerId: identifier.customerId ?? 'guest',
        recipientName: input.addressInput.recipientName,
        phone: input.addressInput.phone,
        addressLine1: input.addressInput.addressLine1,
        addressLine2: input.addressInput.addressLine2 ?? null,
        locality: input.addressInput.locality ?? null,
        city: input.addressInput.city,
        state: input.addressInput.state,
        postalCode: input.addressInput.postalCode,
        country: input.addressInput.country ?? 'IN',
        deliveryInstructions: input.addressInput.deliveryInstructions ?? null,
        isDefault: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    const pricing = await this.pricingService.calculateCartPricing(cart, input.couponCode);

    return { pricing, deliveryAddress };
  }

  /**
   * Creates a checkout session, locking inventory rows and creating a 15-minute stock reservation.
   */
  async createCheckoutSession(
    identifier: { customerId?: string; sessionId?: string },
    input: CreateCheckoutSessionInput,
  ): Promise<CheckoutSessionDto> {
    const cart = await this.cartService.getCart(identifier);

    if (cart.itemsCount === 0) {
      throw new BadRequestException('Shopping cart is empty');
    }

    if (cart.hasUnavailableItems) {
      throw new BadRequestException(
        'Some items in your cart are no longer available. Please review your cart before proceeding',
      );
    }

    let deliveryAddress: CustomerAddressDto | null = null;
    if (input.shippingAddressId && identifier.customerId) {
      deliveryAddress = await this.addressService.getAddressById(
        identifier.customerId,
        input.shippingAddressId,
      );
    } else if (input.addressInput) {
      if (identifier.customerId) {
        deliveryAddress = await this.addressService.createAddress(
          identifier.customerId,
          input.addressInput,
        );
      } else {
        deliveryAddress = {
          id: 'transient',
          customerId: 'guest',
          recipientName: input.addressInput.recipientName,
          phone: input.addressInput.phone,
          addressLine1: input.addressInput.addressLine1,
          addressLine2: input.addressInput.addressLine2 ?? null,
          locality: input.addressInput.locality ?? null,
          city: input.addressInput.city,
          state: input.addressInput.state,
          postalCode: input.addressInput.postalCode,
          country: input.addressInput.country ?? 'IN',
          deliveryInstructions: input.addressInput.deliveryInstructions ?? null,
          isDefault: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }
    }

    const pricing = await this.pricingService.calculateCartPricing(cart, input.couponCode);
    const checkoutId = `chk_${Date.now()}_${randomBytes(4).toString('hex')}`;

    // Flatten cart items to reserve stock
    const reservationItems = cart.sellerGroups.flatMap((group) =>
      group.items.map((item) => ({
        variantId: item.variantId,
        quantity: item.quantity,
      })),
    );

    // Atomically reserve inventory
    const reservationIds = await this.inventoryService.createReservations(
      reservationItems,
      checkoutId,
      cart.id,
      15, // 15-minute TTL
    );

    // Persist pricing snapshot with delivery address metadata
    await this.pricingService.recordPricingSnapshot(checkoutId, {
      ...pricing,
      sellers: pricing.sellers,
    });

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    return {
      checkoutId,
      cartId: cart.id,
      customerId: cart.customerId,
      expiresAt,
      pricing,
      deliveryAddress,
      reservationIds,
    };
  }

  /**
   * Confirms checkout, transactionalizing parent customer order, artisan sub-orders,
   * order line items, reservation commit, and stock decrement.
   *
   * Invariant: paymentStatus remains strictly 'PENDING' and orderStatus 'PLACED' (Gate G08 scope).
   */
  async confirmCheckout(
    customerId: string,
    input: ConfirmCheckoutInput,
    idempotencyKey?: string,
  ): Promise<CheckoutOrderConfirmationDto> {
    const { checkoutSessionId, customerNote } = input;

    // 1. Verify pricing snapshot exists
    const [snapshot] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.pricingSnapshots)
      .where(eq(this.databaseService.schema.pricingSnapshots.checkoutId, checkoutSessionId))
      .limit(1);

    if (!snapshot) {
      throw new NotFoundException(`Checkout session ${checkoutSessionId} not found`);
    }

    const pricing = snapshot.breakdownJson as PricingBreakdownDto;

    // 2. Check active stock reservations
    const reservations = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.inventoryReservations)
      .where(
        and(
          eq(this.databaseService.schema.inventoryReservations.checkoutId, checkoutSessionId),
          eq(this.databaseService.schema.inventoryReservations.status, 'ACTIVE'),
        ),
      );

    if (reservations.length === 0) {
      throw new BadRequestException(
        'Checkout session has expired or reservations were released. Please initiate checkout again',
      );
    }

    // 3. Resolve customer default or latest delivery address
    const addresses = await this.addressService.listAddresses(customerId);
    const shippingAddress = addresses[0];

    if (!shippingAddress) {
      throw new BadRequestException(
        'A valid delivery address is required before confirming the order',
      );
    }

    // 4. Retrieve current customer cart items to build order snapshots
    const cart = await this.cartService.getCart({ customerId });

    if (cart.itemsCount === 0) {
      throw new BadRequestException('Shopping cart is empty');
    }

    // 5. Execute atomic database transaction
    return this.databaseService.db.transaction(async (tx) => {
      // Check idempotency: if an order with this checkout session was already created
      const existingTimelineEvent = await tx
        .select()
        .from(this.databaseService.schema.orderTimelineEvents)
        .where(
          sql`${this.databaseService.schema.orderTimelineEvents.notes} LIKE ${`%${checkoutSessionId}%`}`,
        )
        .limit(1);

      if (existingTimelineEvent.length > 0) {
        throw new ConflictException('This checkout attempt has already been processed');
      }

      const orderNumber = `ORD-${Date.now().toString().slice(-6)}-${randomBytes(2).toString('hex').toUpperCase()}`;

      // Insert parent customer order
      const [parentOrder] = await tx
        .insert(this.databaseService.schema.customerOrders)
        .values({
          orderNumber,
          customerId,
          totalAmountMinor: pricing.grandTotalMinor,
          currency: 'INR',
          paymentStatus: 'PENDING',
          orderStatus: 'PLACED',
          shippingAddress: shippingAddress,
          billingAddress: shippingAddress,
          customerNote: customerNote ?? null,
        })
        .returning();

      if (!parentOrder) {
        throw new BadRequestException('Failed to create customer order');
      }

      const subOrdersSummary: SubOrderSummaryDto[] = [];

      // For each artisan seller in pricing breakdown
      for (let idx = 0; idx < pricing.sellers.length; idx++) {
        const sellerPricing = pricing.sellers[idx]!;
        const subOrderNumber = `${orderNumber}-S${idx + 1}`;

        // Lookup shop ID for this seller
        const [shop] = await tx
          .select({
            id: this.databaseService.schema.shops.id,
            name: this.databaseService.schema.shops.name,
          })
          .from(this.databaseService.schema.shops)
          .where(eq(this.databaseService.schema.shops.sellerId, sellerPricing.sellerId))
          .limit(1);

        if (!shop) {
          throw new BadRequestException(`Shop not found for seller ${sellerPricing.sellerId}`);
        }

        // Query seller commission rate
        const [sellerProfile] = await tx
          .select({
            commissionRateBps: this.databaseService.schema.sellerProfiles.commissionRateBps,
          })
          .from(this.databaseService.schema.sellerProfiles)
          .where(eq(this.databaseService.schema.sellerProfiles.id, sellerPricing.sellerId))
          .limit(1);

        const commissionRateBps = sellerProfile?.commissionRateBps ?? 1000;

        // Insert artisan sub-order
        const [subOrder] = await tx
          .insert(this.databaseService.schema.subOrders)
          .values({
            subOrderNumber,
            parentOrderId: parentOrder.id,
            sellerId: sellerPricing.sellerId,
            shopId: shop.id,
            status: 'CONFIRMED',
            itemSubtotalMinor: sellerPricing.itemSubtotalMinor,
            shippingFeeMinor: sellerPricing.shippingFeeMinor,
            commissionRateBps,
            commissionFeeMinor: sellerPricing.commissionFeeMinor,
            taxMinor: sellerPricing.taxMinor,
            netSellerPayableMinor: sellerPricing.netSellerPayableMinor,
            currency: 'INR',
          })
          .returning();

        if (!subOrder) {
          throw new BadRequestException(
            `Failed to create sub-order for seller ${sellerPricing.sellerId}`,
          );
        }

        // Find items belonging to this seller in the cart
        const sellerCartGroup = cart.sellerGroups.find(
          (g) => g.sellerId === sellerPricing.sellerId,
        );
        const groupItems = sellerCartGroup ? sellerCartGroup.items : [];

        for (const item of groupItems) {
          await tx.insert(this.databaseService.schema.orderItems).values({
            subOrderId: subOrder.id,
            sellerId: sellerPricing.sellerId,
            variantId: item.variantId,
            titleSnapshot: `${item.productTitle} (${item.variantTitle})`,
            skuSnapshot: item.sku,
            unitPriceMinor: item.unitPriceMinor,
            quantity: item.quantity,
            totalPriceMinor: item.lineTotalMinor,
            customizationInput: item.customizationText ?? null,
          });
        }

        // Insert lifecycle timeline event
        await tx.insert(this.databaseService.schema.orderTimelineEvents).values({
          subOrderId: subOrder.id,
          fromStatus: 'PLACED',
          toStatus: 'CONFIRMED',
          actorId: customerId,
          notes: `Checkout session ${checkoutSessionId} confirmed. Order created awaiting payment`,
        });

        subOrdersSummary.push({
          id: subOrder.id,
          subOrderNumber: subOrder.subOrderNumber,
          sellerId: subOrder.sellerId,
          shopName: shop.name,
          status: subOrder.status,
          itemSubtotalMinor: subOrder.itemSubtotalMinor,
          shippingFeeMinor: subOrder.shippingFeeMinor,
          taxMinor: subOrder.taxMinor,
          itemCount: groupItems.length,
        });
      }

      // 6. Commit reservations within the transaction
      await this.inventoryService.commitReservations(checkoutSessionId, tx);

      // 7. Clear customer cart within the transaction
      await tx
        .delete(this.databaseService.schema.cartItems)
        .where(eq(this.databaseService.schema.cartItems.cartId, cart.id));

      // 8. Record audit log
      await this.auditService.logEvent({
        actorId: customerId,
        actorRole: 'CUSTOMER',
        action: 'ORDER_PLACED',
        resourceType: 'CUSTOMER_ORDER',
        resourceId: parentOrder.id,
        metadata: {
          orderNumber: parentOrder.orderNumber,
          totalAmountMinor: parentOrder.totalAmountMinor,
          subOrdersCount: subOrdersSummary.length,
          checkoutSessionId,
          idempotencyKey: idempotencyKey ?? null,
        },
      });

      return {
        orderId: parentOrder.id,
        orderNumber: parentOrder.orderNumber,
        customerId,
        totalAmountMinor: parentOrder.totalAmountMinor,
        currency: parentOrder.currency,
        paymentStatus: 'PENDING',
        orderStatus: 'PLACED',
        placedAt: parentOrder.placedAt.toISOString(),
        shippingAddress,
        subOrders: subOrdersSummary,
        notice: 'Order placed successfully. Awaiting payment authorization (Gate G09 integration).',
      };
    });
  }

  /**
   * Retrieves full order details by order number for an authorized customer.
   */
  async getOrderByNumber(
    customerId: string,
    orderNumber: string,
  ): Promise<CheckoutOrderConfirmationDto> {
    const [order] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.customerOrders)
      .where(
        and(
          eq(this.databaseService.schema.customerOrders.orderNumber, orderNumber),
          eq(this.databaseService.schema.customerOrders.customerId, customerId),
        ),
      )
      .limit(1);

    if (!order) {
      throw new NotFoundException(`Order ${orderNumber} not found`);
    }

    const subOrderRows = await this.databaseService.db
      .select({
        subOrder: this.databaseService.schema.subOrders,
        shop: this.databaseService.schema.shops,
      })
      .from(this.databaseService.schema.subOrders)
      .innerJoin(
        this.databaseService.schema.shops,
        eq(this.databaseService.schema.subOrders.shopId, this.databaseService.schema.shops.id),
      )
      .where(eq(this.databaseService.schema.subOrders.parentOrderId, order.id));

    const subOrders: SubOrderSummaryDto[] = [];

    for (const row of subOrderRows) {
      const items = await this.databaseService.db
        .select()
        .from(this.databaseService.schema.orderItems)
        .where(eq(this.databaseService.schema.orderItems.subOrderId, row.subOrder.id));

      subOrders.push({
        id: row.subOrder.id,
        subOrderNumber: row.subOrder.subOrderNumber,
        sellerId: row.subOrder.sellerId,
        shopName: row.shop.name,
        status: row.subOrder.status,
        itemSubtotalMinor: row.subOrder.itemSubtotalMinor,
        shippingFeeMinor: row.subOrder.shippingFeeMinor,
        taxMinor: row.subOrder.taxMinor,
        itemCount: items.length,
      });
    }

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      totalAmountMinor: order.totalAmountMinor,
      currency: order.currency,
      paymentStatus: 'PENDING',
      orderStatus: 'PLACED',
      placedAt: order.placedAt.toISOString(),
      shippingAddress: order.shippingAddress as CustomerAddressDto,
      subOrders,
      notice: 'Order placed successfully. Awaiting payment authorization (Gate G09 integration).',
    };
  }
}
