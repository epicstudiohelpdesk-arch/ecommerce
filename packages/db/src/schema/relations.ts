import { relations } from 'drizzle-orm';
import {
  users,
  userSessions,
  roles,
  permissions,
  rolePermissions,
  userRoles,
  customerAddresses,
} from './identity.js';
import {
  sellerProfiles,
  shops,
  sellerDocuments,
  pickupAddresses,
  payoutAccounts,
} from './sellers.js';
import {
  categories,
  products,
  productVariants,
  productMedia,
  moderationRecords,
} from './catalog.js';
import { inventoryItems, inventoryReservations, stockAdjustments } from './inventory.js';
import { carts, cartItems } from './carts.js';
import { customerOrders, subOrders, orderItems, orderTimelineEvents } from './orders.js';
import { paymentAttempts, paymentAllocations, refundRequests } from './payments.js';
import {
  ledgerAccounts,
  ledgerEntries,
  sellerBalances,
  payoutBatches,
  payoutTransactions,
} from './ledger.js';
import { shipments, shipmentMilestones, returnRequests } from './shipping.js';
import { reviews, supportTickets, disputes } from './support.js';

// 1. Users Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  sessions: many(userSessions),
  sellerProfile: one(sellerProfiles, {
    fields: [users.id],
    references: [sellerProfiles.userId],
  }),
  userRoles: many(userRoles),
  orders: many(customerOrders),
  addresses: many(customerAddresses),
  reviews: many(reviews),
  supportTicketsCreated: many(supportTickets, { relationName: 'ticket_creator' }),
  disputes: many(disputes),
}));

export const customerAddressesRelations = relations(customerAddresses, ({ one }) => ({
  customer: one(users, {
    fields: [customerAddresses.customerId],
    references: [users.id],
  }),
}));

export const userSessionsRelations = relations(userSessions, ({ one }) => ({
  user: one(users, {
    fields: [userSessions.userId],
    references: [users.id],
  }),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  rolePermissions: many(rolePermissions),
  userRoles: many(userRoles),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, {
    fields: [rolePermissions.roleId],
    references: [roles.id],
  }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id],
  }),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, {
    fields: [userRoles.userId],
    references: [users.id],
  }),
  role: one(roles, {
    fields: [userRoles.roleId],
    references: [roles.id],
  }),
  sellerProfile: one(sellerProfiles, {
    fields: [userRoles.sellerId],
    references: [sellerProfiles.id],
  }),
}));

// 2. Seller Relations
export const sellerProfilesRelations = relations(sellerProfiles, ({ one, many }) => ({
  user: one(users, {
    fields: [sellerProfiles.userId],
    references: [users.id],
  }),
  shop: one(shops, {
    fields: [sellerProfiles.id],
    references: [shops.sellerId],
  }),
  documents: many(sellerDocuments),
  pickupAddresses: many(pickupAddresses),
  payoutAccounts: many(payoutAccounts),
  products: many(products),
  subOrders: many(subOrders),
  balance: one(sellerBalances, {
    fields: [sellerProfiles.id],
    references: [sellerBalances.sellerId],
  }),
}));

export const shopsRelations = relations(shops, ({ one, many }) => ({
  sellerProfile: one(sellerProfiles, {
    fields: [shops.sellerId],
    references: [sellerProfiles.id],
  }),
  subOrders: many(subOrders),
}));

export const sellerDocumentsRelations = relations(sellerDocuments, ({ one }) => ({
  sellerProfile: one(sellerProfiles, {
    fields: [sellerDocuments.sellerId],
    references: [sellerProfiles.id],
  }),
  reviewer: one(users, {
    fields: [sellerDocuments.reviewedBy],
    references: [users.id],
  }),
}));

// 3. Catalog Relations
export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: 'category_tree',
  }),
  children: many(categories, { relationName: 'category_tree' }),
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  seller: one(sellerProfiles, {
    fields: [products.sellerId],
    references: [sellerProfiles.id],
  }),
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  variants: many(productVariants),
  media: many(productMedia),
  moderationRecords: many(moderationRecords),
  reviews: many(reviews),
}));

export const productVariantsRelations = relations(productVariants, ({ one, many }) => ({
  product: one(products, {
    fields: [productVariants.productId],
    references: [products.id],
  }),
  inventoryItem: one(inventoryItems, {
    fields: [productVariants.id],
    references: [inventoryItems.variantId],
  }),
  reservations: many(inventoryReservations),
  adjustments: many(stockAdjustments),
  media: many(productMedia),
}));

// 4. Inventory Relations
export const inventoryItemsRelations = relations(inventoryItems, ({ one }) => ({
  variant: one(productVariants, {
    fields: [inventoryItems.variantId],
    references: [productVariants.id],
  }),
}));

// 5. Carts Relations
export const cartsRelations = relations(carts, ({ one, many }) => ({
  customer: one(users, {
    fields: [carts.customerId],
    references: [users.id],
  }),
  items: many(cartItems),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  cart: one(carts, {
    fields: [cartItems.cartId],
    references: [carts.id],
  }),
  variant: one(productVariants, {
    fields: [cartItems.variantId],
    references: [productVariants.id],
  }),
}));

// 6. Orders Relations
export const customerOrdersRelations = relations(customerOrders, ({ one, many }) => ({
  customer: one(users, {
    fields: [customerOrders.customerId],
    references: [users.id],
  }),
  subOrders: many(subOrders),
  paymentAttempts: many(paymentAttempts),
}));

export const subOrdersRelations = relations(subOrders, ({ one, many }) => ({
  parentOrder: one(customerOrders, {
    fields: [subOrders.parentOrderId],
    references: [customerOrders.id],
  }),
  seller: one(sellerProfiles, {
    fields: [subOrders.sellerId],
    references: [sellerProfiles.id],
  }),
  shop: one(shops, {
    fields: [subOrders.shopId],
    references: [shops.id],
  }),
  items: many(orderItems),
  shipment: one(shipments, {
    fields: [subOrders.id],
    references: [shipments.subOrderId],
  }),
  paymentAllocations: many(paymentAllocations),
  refundRequests: many(refundRequests),
  returnRequests: many(returnRequests),
  timelineEvents: many(orderTimelineEvents),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  subOrder: one(subOrders, {
    fields: [orderItems.subOrderId],
    references: [subOrders.id],
  }),
  variant: one(productVariants, {
    fields: [orderItems.variantId],
    references: [productVariants.id],
  }),
  review: one(reviews, {
    fields: [orderItems.id],
    references: [reviews.orderItemId],
  }),
}));

// 7. Payments Relations
export const paymentAttemptsRelations = relations(paymentAttempts, ({ one, many }) => ({
  parentOrder: one(customerOrders, {
    fields: [paymentAttempts.parentOrderId],
    references: [customerOrders.id],
  }),
  allocations: many(paymentAllocations),
  refundRequests: many(refundRequests),
}));

export const paymentAllocationsRelations = relations(paymentAllocations, ({ one }) => ({
  paymentAttempt: one(paymentAttempts, {
    fields: [paymentAllocations.paymentAttemptId],
    references: [paymentAttempts.id],
  }),
  subOrder: one(subOrders, {
    fields: [paymentAllocations.subOrderId],
    references: [subOrders.id],
  }),
}));

// 8. Ledger Relations
export const ledgerAccountsRelations = relations(ledgerAccounts, ({ many }) => ({
  entries: many(ledgerEntries),
}));

export const ledgerEntriesRelations = relations(ledgerEntries, ({ one }) => ({
  account: one(ledgerAccounts, {
    fields: [ledgerEntries.accountId],
    references: [ledgerAccounts.id],
  }),
  seller: one(sellerProfiles, {
    fields: [ledgerEntries.sellerId],
    references: [sellerProfiles.id],
  }),
  subOrder: one(subOrders, {
    fields: [ledgerEntries.subOrderId],
    references: [subOrders.id],
  }),
}));

export const sellerBalancesRelations = relations(sellerBalances, ({ one }) => ({
  seller: one(sellerProfiles, {
    fields: [sellerBalances.sellerId],
    references: [sellerProfiles.id],
  }),
}));

export const payoutBatchesRelations = relations(payoutBatches, ({ one, many }) => ({
  initiator: one(users, {
    fields: [payoutBatches.initiatedBy],
    references: [users.id],
  }),
  authorizer: one(users, {
    fields: [payoutBatches.authorizedBy],
    references: [users.id],
  }),
  transactions: many(payoutTransactions),
}));

export const payoutTransactionsRelations = relations(payoutTransactions, ({ one }) => ({
  batch: one(payoutBatches, {
    fields: [payoutTransactions.batchId],
    references: [payoutBatches.id],
  }),
  seller: one(sellerProfiles, {
    fields: [payoutTransactions.sellerId],
    references: [sellerProfiles.id],
  }),
  payoutAccount: one(payoutAccounts, {
    fields: [payoutTransactions.payoutAccountId],
    references: [payoutAccounts.id],
  }),
}));

// 9. Shipping Relations
export const shipmentsRelations = relations(shipments, ({ one, many }) => ({
  subOrder: one(subOrders, {
    fields: [shipments.subOrderId],
    references: [subOrders.id],
  }),
  milestones: many(shipmentMilestones),
}));

export const shipmentMilestonesRelations = relations(shipmentMilestones, ({ one }) => ({
  shipment: one(shipments, {
    fields: [shipmentMilestones.shipmentId],
    references: [shipments.id],
  }),
}));

export const returnRequestsRelations = relations(returnRequests, ({ one }) => ({
  subOrder: one(subOrders, {
    fields: [returnRequests.subOrderId],
    references: [subOrders.id],
  }),
  customer: one(users, {
    fields: [returnRequests.customerId],
    references: [users.id],
  }),
}));

// 10. Support Relations
export const reviewsRelations = relations(reviews, ({ one }) => ({
  customer: one(users, {
    fields: [reviews.customerId],
    references: [users.id],
  }),
  product: one(products, {
    fields: [reviews.productId],
    references: [products.id],
  }),
  orderItem: one(orderItems, {
    fields: [reviews.orderItemId],
    references: [orderItems.id],
  }),
}));

export const supportTicketsRelations = relations(supportTickets, ({ one }) => ({
  creator: one(users, {
    fields: [supportTickets.creatorId],
    references: [users.id],
  }),
  assignedAgent: one(users, {
    fields: [supportTickets.assignedAgentId],
    references: [users.id],
  }),
}));

export const disputesRelations = relations(disputes, ({ one }) => ({
  subOrder: one(subOrders, {
    fields: [disputes.subOrderId],
    references: [subOrders.id],
  }),
  customer: one(users, {
    fields: [disputes.customerId],
    references: [users.id],
  }),
  seller: one(sellerProfiles, {
    fields: [disputes.sellerId],
    references: [sellerProfiles.id],
  }),
  resolver: one(users, {
    fields: [disputes.resolvedBy],
    references: [users.id],
  }),
}));
