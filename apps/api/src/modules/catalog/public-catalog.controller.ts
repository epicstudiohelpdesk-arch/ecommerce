import { Controller, Get, Query, Param, BadRequestException, Inject } from '@nestjs/common';
import { PublicCatalogService } from './public-catalog.service';
import { CategoriesService } from './categories.service';
import { createSuccessResponse } from '@repo/api-contracts';
import { listPublicCatalogQuerySchema } from '@repo/validation';

@Controller('catalog')
export class PublicCatalogController {
  constructor(
    @Inject(PublicCatalogService)
    private readonly publicCatalogService: PublicCatalogService,
    @Inject(CategoriesService)
    private readonly categoriesService: CategoriesService,
  ) {}

  @Get('categories')
  async listCategories() {
    const categories = await this.categoriesService.listCategories(true);
    return createSuccessResponse(categories);
  }

  @Get('products')
  async listProducts(@Query() rawQuery: Record<string, string | undefined>) {
    const parseResult = listPublicCatalogQuerySchema.safeParse({
      page: rawQuery['page'] ? parseInt(rawQuery['page'], 10) : undefined,
      limit: rawQuery['limit'] ? parseInt(rawQuery['limit'], 10) : undefined,
      categorySlug: rawQuery['categorySlug'],
      productType: rawQuery['productType'],
      minPriceMinor: rawQuery['minPriceMinor']
        ? parseInt(rawQuery['minPriceMinor'], 10)
        : undefined,
      maxPriceMinor: rawQuery['maxPriceMinor']
        ? parseInt(rawQuery['maxPriceMinor'], 10)
        : undefined,
      sort: rawQuery['sort'],
      search: rawQuery['search'],
    });

    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Invalid catalog query parameters',
        details: parseResult.error.format(),
      });
    }

    const { items, meta } = await this.publicCatalogService.listProducts(parseResult.data);
    return createSuccessResponse({ items, ...meta });
  }

  @Get('products/:slug')
  async getProductBySlug(@Param('slug') slug: string) {
    const product = await this.publicCatalogService.getProductBySlug(slug);
    return createSuccessResponse(product);
  }
}
