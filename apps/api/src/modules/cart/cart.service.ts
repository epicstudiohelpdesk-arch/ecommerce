import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../audit/audit.service';
import type { CartDto, CartItemDto, CartSellerGroupDto } from '@repo/api-contracts';
import type { AddToCartInput, UpdateCartItemQuantityInput } from '@repo/validation';

export interface CartIdentifier {
  customerId?: string | null;
  sessionId?: string | null;
}

@Injectable()
export class CartService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Resolves or provisions an active cart for an authenticated customer or guest session.
   */
  async getOrCreateCart(identifier: CartIdentifier): Promise<{ id: string; isNew: boolean }> {
    const { customerId, sessionId } = identifier;

    if (!customerId && !sessionId) {
      throw new BadRequestException(
        'Either customerId or sessionId must be provided to access the cart',
      );
    }

    const now = new Date();

    if (customerId) {
      // Find latest non-expired cart for customer
      const [existingCart] = await this.databaseService.db
        .select()
        .from(this.databaseService.schema.carts)
        .where(eq(this.databaseService.schema.carts.customerId, customerId))
        .orderBy(desc(this.databaseService.schema.carts.updatedAt))
        .limit(1);

      if (existingCart && existingCart.expiresAt > now) {
        return { id: existingCart.id, isNew: false };
      }

      // Provision 30-day customer cart
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const [newCart] = await this.databaseService.db
        .insert(this.databaseService.schema.carts)
        .values({
          customerId,
          sessionId: sessionId ?? null,
          currency: 'INR',
          expiresAt,
        })
        .returning();

      if (!newCart) {
        throw new BadRequestException('Failed to provision customer cart');
      }

      return { id: newCart.id, isNew: true };
    }

    // Guest cart with sessionId
    const [existingGuestCart] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.carts)
      .where(
        and(
          eq(this.databaseService.schema.carts.sessionId, sessionId!),
          isNull(this.databaseService.schema.carts.customerId),
        ),
      )
      .orderBy(desc(this.databaseService.schema.carts.updatedAt))
      .limit(1);

    if (existingGuestCart && existingGuestCart.expiresAt > now) {
      return { id: existingGuestCart.id, isNew: false };
    }

    // Provision 7-day guest cart
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const [newGuestCart] = await this.databaseService.db
      .insert(this.databaseService.schema.carts)
      .values({
        customerId: null,
        sessionId: sessionId!,
        currency: 'INR',
        expiresAt,
      })
      .returning();

    if (!newGuestCart) {
      throw new BadRequestException('Failed to provision guest cart');
    }

    return { id: newGuestCart.id, isNew: true };
  }

  /**
   * Retrieves complete cart details, computes authoritative prices, validates stock,
   * and aggregates line items by artisan seller.
   */
  async getCart(identifier: CartIdentifier): Promise<CartDto> {
    const { id: cartId } = await this.getOrCreateCart(identifier);
    return this.getCartById(cartId);
  }

  /**
   * Retrieves and calculates authoritative CartDto by cart UUID.
   */
  async getCartById(cartId: string): Promise<CartDto> {
    const [cart] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.carts)
      .where(eq(this.databaseService.schema.carts.id, cartId))
      .limit(1);

    if (!cart) {
      throw new NotFoundException(`Cart ${cartId} not found`);
    }

    // Fetch items with variant, product, seller and shop details
    const rawItems = await this.databaseService.db
      .select({
        cartItem: this.databaseService.schema.cartItems,
        variant: this.databaseService.schema.productVariants,
        product: this.databaseService.schema.products,
        seller: this.databaseService.schema.sellerProfiles,
        shop: this.databaseService.schema.shops,
        inventory: this.databaseService.schema.inventoryItems,
      })
      .from(this.databaseService.schema.cartItems)
      .innerJoin(
        this.databaseService.schema.productVariants,
        eq(
          this.databaseService.schema.cartItems.variantId,
          this.databaseService.schema.productVariants.id,
        ),
      )
      .innerJoin(
        this.databaseService.schema.products,
        eq(
          this.databaseService.schema.productVariants.productId,
          this.databaseService.schema.products.id,
        ),
      )
      .innerJoin(
        this.databaseService.schema.sellerProfiles,
        eq(
          this.databaseService.schema.products.sellerId,
          this.databaseService.schema.sellerProfiles.id,
        ),
      )
      .innerJoin(
        this.databaseService.schema.shops,
        eq(
          this.databaseService.schema.sellerProfiles.id,
          this.databaseService.schema.shops.sellerId,
        ),
      )
      .leftJoin(
        this.databaseService.schema.inventoryItems,
        eq(
          this.databaseService.schema.productVariants.id,
          this.databaseService.schema.inventoryItems.variantId,
        ),
      )
      .where(eq(this.databaseService.schema.cartItems.cartId, cartId));

    // Also fetch primary images for products
    const productIds = Array.from(new Set(rawItems.map((r) => r.product.id)));
    const primaryImages: Record<string, string> = {};

    if (productIds.length > 0) {
      const mediaList = await this.databaseService.db
        .select()
        .from(this.databaseService.schema.productMedia)
        .where(eq(this.databaseService.schema.productMedia.isPrimary, true));

      for (const m of mediaList) {
        primaryImages[m.productId] = m.url;
      }
    }

    let hasUnavailableItems = false;
    let hasPriceChanges = false;

    // Build CartItemDto array
    const cartItemsDto: CartItemDto[] = rawItems.map((r) => {
      const availableStock = r.inventory
        ? r.inventory.isUnlimited
          ? 999999
          : Math.max(0, r.inventory.quantityOnHand - r.inventory.quantityReserved)
        : 0;

      const isAvailable =
        (r.product.moderationStatus === 'PUBLISHED' || r.product.moderationStatus === 'APPROVED') &&
        r.seller.verificationStatus === 'VERIFIED' &&
        r.variant.isActive &&
        availableStock >= r.cartItem.quantity;

      if (!isAvailable) {
        hasUnavailableItems = true;
      }

      const unitPriceMinor = r.variant.priceMinor;
      const priceChanged = unitPriceMinor !== r.cartItem.priceSnapshotMinor;
      if (priceChanged) {
        hasPriceChanges = true;
      }

      const lineTotalMinor = unitPriceMinor * r.cartItem.quantity;

      return {
        id: r.cartItem.id,
        variantId: r.variant.id,
        productId: r.product.id,
        productTitle: r.product.title,
        productSlug: r.product.slug,
        variantTitle: r.variant.title,
        sku: r.variant.sku,
        primaryImageUrl: primaryImages[r.product.id] ?? null,
        unitPriceMinor,
        quantity: r.cartItem.quantity,
        lineTotalMinor,
        customizationText: r.cartItem.customizationText ?? null,
        availableStock,
        isAvailable,
        priceChanged,
        originalPriceMinor: r.cartItem.priceSnapshotMinor,
        sellerId: r.seller.id,
        shopName: r.shop.name,
        shopSlug: r.shop.slug,
      };
    });

    // Group items by artisan seller
    const sellerGroupMap = new Map<
      string,
      {
        sellerId: string;
        shopName: string;
        shopSlug: string;
        items: CartItemDto[];
        subtotalMinor: number;
      }
    >();

    for (const item of cartItemsDto) {
      let group = sellerGroupMap.get(item.sellerId);
      if (!group) {
        group = {
          sellerId: item.sellerId,
          shopName: item.shopName,
          shopSlug: item.shopSlug,
          items: [],
          subtotalMinor: 0,
        };
        sellerGroupMap.set(item.sellerId, group);
      }
      group.items.push(item);
      group.subtotalMinor += item.lineTotalMinor;
    }

    // Handcrafted marketplace shipping rule: ₹50 (5000 paise) flat shipping per seller group; free if seller subtotal >= ₹1000 (100000 paise)
    const sellerGroups: CartSellerGroupDto[] = Array.from(sellerGroupMap.values()).map((g) => {
      const shippingFeeMinor = g.subtotalMinor >= 100000 || g.subtotalMinor === 0 ? 0 : 5000;
      return {
        sellerId: g.sellerId,
        shopName: g.shopName,
        shopSlug: g.shopSlug,
        items: g.items,
        subtotalMinor: g.subtotalMinor,
        shippingFeeMinor,
      };
    });

    const subtotalMinor = sellerGroups.reduce((sum, g) => sum + g.subtotalMinor, 0);
    const estimatedShippingMinor = sellerGroups.reduce((sum, g) => sum + g.shippingFeeMinor, 0);
    const totalEstimatedMinor = subtotalMinor + estimatedShippingMinor;
    const itemsCount = cartItemsDto.reduce((sum, i) => sum + i.quantity, 0);

    return {
      id: cart.id,
      customerId: cart.customerId,
      sessionId: cart.sessionId,
      currency: cart.currency,
      itemsCount,
      subtotalMinor,
      estimatedShippingMinor,
      totalEstimatedMinor,
      sellerGroups,
      hasUnavailableItems,
      hasPriceChanges,
      expiresAt: cart.expiresAt.toISOString(),
      updatedAt: cart.updatedAt.toISOString(),
    };
  }

  /**
   * Adds an item to the cart or increments quantity with strict inventory check.
   */
  async addItem(identifier: CartIdentifier, input: AddToCartInput): Promise<CartDto> {
    const { id: cartId } = await this.getOrCreateCart(identifier);

    // Verify variant and publication status
    const [variant] = await this.databaseService.db
      .select({
        variant: this.databaseService.schema.productVariants,
        product: this.databaseService.schema.products,
        seller: this.databaseService.schema.sellerProfiles,
        inventory: this.databaseService.schema.inventoryItems,
      })
      .from(this.databaseService.schema.productVariants)
      .innerJoin(
        this.databaseService.schema.products,
        eq(
          this.databaseService.schema.productVariants.productId,
          this.databaseService.schema.products.id,
        ),
      )
      .innerJoin(
        this.databaseService.schema.sellerProfiles,
        eq(
          this.databaseService.schema.products.sellerId,
          this.databaseService.schema.sellerProfiles.id,
        ),
      )
      .leftJoin(
        this.databaseService.schema.inventoryItems,
        eq(
          this.databaseService.schema.productVariants.id,
          this.databaseService.schema.inventoryItems.variantId,
        ),
      )
      .where(eq(this.databaseService.schema.productVariants.id, input.variantId))
      .limit(1);

    if (!variant) {
      throw new NotFoundException(`Product variant ${input.variantId} not found`);
    }

    if (
      (variant.product.moderationStatus !== 'PUBLISHED' &&
        variant.product.moderationStatus !== 'APPROVED') ||
      variant.seller.verificationStatus !== 'VERIFIED' ||
      !variant.variant.isActive
    ) {
      throw new BadRequestException('This product listing is currently not available for purchase');
    }

    const availableStock = variant.inventory
      ? variant.inventory.isUnlimited
        ? 999999
        : variant.inventory.quantityOnHand - variant.inventory.quantityReserved
      : 0;

    // Check existing item in cart
    const [existingItem] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.cartItems)
      .where(
        and(
          eq(this.databaseService.schema.cartItems.cartId, cartId),
          eq(this.databaseService.schema.cartItems.variantId, input.variantId),
        ),
      )
      .limit(1);

    const targetQuantity = (existingItem?.quantity ?? 0) + input.quantity;

    if (targetQuantity > 50) {
      throw new BadRequestException(
        `Maximum quantity per cart item is 50. Current total would be ${targetQuantity}`,
      );
    }

    if (availableStock < targetQuantity) {
      throw new BadRequestException(
        `Insufficient stock for this item. Only ${availableStock} unit(s) available, requested total ${targetQuantity}`,
      );
    }

    const now = new Date();

    if (existingItem) {
      await this.databaseService.db
        .update(this.databaseService.schema.cartItems)
        .set({
          quantity: targetQuantity,
          customizationText: input.customizationText ?? existingItem.customizationText,
          priceSnapshotMinor: variant.variant.priceMinor,
          updatedAt: now,
        })
        .where(eq(this.databaseService.schema.cartItems.id, existingItem.id));
    } else {
      await this.databaseService.db.insert(this.databaseService.schema.cartItems).values({
        cartId,
        variantId: input.variantId,
        quantity: input.quantity,
        customizationText: input.customizationText ?? null,
        priceSnapshotMinor: variant.variant.priceMinor,
      });
    }

    await this.databaseService.db
      .update(this.databaseService.schema.carts)
      .set({ updatedAt: now })
      .where(eq(this.databaseService.schema.carts.id, cartId));

    return this.getCartById(cartId);
  }

  /**
   * Updates quantity of an existing cart item.
   */
  async updateItemQuantity(
    identifier: CartIdentifier,
    itemId: string,
    input: UpdateCartItemQuantityInput,
  ): Promise<CartDto> {
    const { id: cartId } = await this.getOrCreateCart(identifier);

    const [item] = await this.databaseService.db
      .select({
        cartItem: this.databaseService.schema.cartItems,
        inventory: this.databaseService.schema.inventoryItems,
      })
      .from(this.databaseService.schema.cartItems)
      .leftJoin(
        this.databaseService.schema.inventoryItems,
        eq(
          this.databaseService.schema.cartItems.variantId,
          this.databaseService.schema.inventoryItems.variantId,
        ),
      )
      .where(
        and(
          eq(this.databaseService.schema.cartItems.id, itemId),
          eq(this.databaseService.schema.cartItems.cartId, cartId),
        ),
      )
      .limit(1);

    if (!item) {
      throw new NotFoundException(`Cart item ${itemId} not found in current cart`);
    }

    if (input.quantity <= 0) {
      return this.removeItem(identifier, itemId);
    }

    const availableStock = item.inventory
      ? item.inventory.isUnlimited
        ? 999999
        : item.inventory.quantityOnHand - item.inventory.quantityReserved
      : 0;

    if (availableStock < input.quantity) {
      throw new BadRequestException(
        `Insufficient stock: only ${availableStock} unit(s) available, requested ${input.quantity}`,
      );
    }

    const now = new Date();
    await this.databaseService.db
      .update(this.databaseService.schema.cartItems)
      .set({
        quantity: input.quantity,
        updatedAt: now,
      })
      .where(eq(this.databaseService.schema.cartItems.id, itemId));

    await this.databaseService.db
      .update(this.databaseService.schema.carts)
      .set({ updatedAt: now })
      .where(eq(this.databaseService.schema.carts.id, cartId));

    return this.getCartById(cartId);
  }

  /**
   * Removes an item from the cart.
   */
  async removeItem(identifier: CartIdentifier, itemId: string): Promise<CartDto> {
    const { id: cartId } = await this.getOrCreateCart(identifier);

    await this.databaseService.db
      .delete(this.databaseService.schema.cartItems)
      .where(
        and(
          eq(this.databaseService.schema.cartItems.id, itemId),
          eq(this.databaseService.schema.cartItems.cartId, cartId),
        ),
      );

    await this.databaseService.db
      .update(this.databaseService.schema.carts)
      .set({ updatedAt: new Date() })
      .where(eq(this.databaseService.schema.carts.id, cartId));

    return this.getCartById(cartId);
  }

  /**
   * Clears all items from the cart.
   */
  async clearCart(identifier: CartIdentifier): Promise<CartDto> {
    const { id: cartId } = await this.getOrCreateCart(identifier);

    await this.databaseService.db
      .delete(this.databaseService.schema.cartItems)
      .where(eq(this.databaseService.schema.cartItems.cartId, cartId));

    await this.databaseService.db
      .update(this.databaseService.schema.carts)
      .set({ updatedAt: new Date() })
      .where(eq(this.databaseService.schema.carts.id, cartId));

    return this.getCartById(cartId);
  }

  /**
   * Merges guest cart items into authenticated user cart upon login.
   * Deduplicates by variantId and sums quantities (clamped to 50).
   */
  async mergeCart(customerId: string, guestSessionId: string): Promise<CartDto> {
    const [guestCart] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.carts)
      .where(
        and(
          eq(this.databaseService.schema.carts.sessionId, guestSessionId),
          isNull(this.databaseService.schema.carts.customerId),
        ),
      )
      .orderBy(desc(this.databaseService.schema.carts.updatedAt))
      .limit(1);

    const { id: customerCartId } = await this.getOrCreateCart({ customerId });

    if (!guestCart || guestCart.id === customerCartId) {
      return this.getCartById(customerCartId);
    }

    const guestItems = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.cartItems)
      .where(eq(this.databaseService.schema.cartItems.cartId, guestCart.id));

    if (guestItems.length > 0) {
      await this.databaseService.db.transaction(async (tx) => {
        for (const gItem of guestItems) {
          const [existingCustItem] = await tx
            .select()
            .from(this.databaseService.schema.cartItems)
            .where(
              and(
                eq(this.databaseService.schema.cartItems.cartId, customerCartId),
                eq(this.databaseService.schema.cartItems.variantId, gItem.variantId),
              ),
            )
            .limit(1);

          if (existingCustItem) {
            const combinedQty = Math.min(50, existingCustItem.quantity + gItem.quantity);
            await tx
              .update(this.databaseService.schema.cartItems)
              .set({
                quantity: combinedQty,
                updatedAt: new Date(),
              })
              .where(eq(this.databaseService.schema.cartItems.id, existingCustItem.id));
          } else {
            await tx.insert(this.databaseService.schema.cartItems).values({
              cartId: customerCartId,
              variantId: gItem.variantId,
              quantity: gItem.quantity,
              customizationText: gItem.customizationText,
              priceSnapshotMinor: gItem.priceSnapshotMinor,
            });
          }
        }

        // Delete guest cart items and guest cart
        await tx
          .delete(this.databaseService.schema.cartItems)
          .where(eq(this.databaseService.schema.cartItems.cartId, guestCart.id));
        await tx
          .delete(this.databaseService.schema.carts)
          .where(eq(this.databaseService.schema.carts.id, guestCart.id));
      });
    }

    return this.getCartById(customerCartId);
  }
}
