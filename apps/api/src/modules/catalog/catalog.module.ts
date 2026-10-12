import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { SellersModule } from '../sellers/sellers.module';

import { CategoriesService } from './categories.service';
import { ProductMediaService } from './product-media.service';
import { InventoryService } from './inventory.service';
import { ProductManagementService } from './product-management.service';
import { PublicCatalogService } from './public-catalog.service';
import { ProductModerationService } from './product-moderation.service';

import { SellerProductsController } from './seller-products.controller';
import { SellerInventoryController } from './seller-inventory.controller';
import { PublicCatalogController } from './public-catalog.controller';
import { AdminProductModerationController } from './admin-product-moderation.controller';

@Module({
  imports: [DatabaseModule, AuditModule, SellersModule],
  controllers: [
    SellerProductsController,
    SellerInventoryController,
    PublicCatalogController,
    AdminProductModerationController,
  ],
  providers: [
    CategoriesService,
    ProductMediaService,
    InventoryService,
    ProductManagementService,
    PublicCatalogService,
    ProductModerationService,
  ],
  exports: [
    CategoriesService,
    InventoryService,
    PublicCatalogService,
    ProductManagementService,
    ProductModerationService,
  ],
})
export class CatalogModule {}
