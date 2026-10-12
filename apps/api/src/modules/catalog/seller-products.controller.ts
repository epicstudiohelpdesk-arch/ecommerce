import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Query,
  Param,
  UseGuards,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  type AuthenticatedUserPayload,
} from '../../common/decorators/current-user.decorator';
import { ProductManagementService } from './product-management.service';
import { ProductMediaService } from './product-media.service';
import { createSuccessResponse } from '@repo/api-contracts';
import {
  createProductDraftSchema,
  updateProductSchema,
  listSellerProductsQuerySchema,
  presignedProductMediaRequestSchema,
  attachProductMediaSchema,
  reorderProductMediaSchema,
} from '@repo/validation';

@Controller('seller/products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('APPROVED_SELLER', 'SUPER_ADMIN')
export class SellerProductsController {
  constructor(
    private readonly productService: ProductManagementService,
    private readonly mediaService: ProductMediaService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createDraft(@CurrentUser() user: AuthenticatedUserPayload, @Body() rawBody: unknown) {
    const parseResult = createProductDraftSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Product draft validation failed',
        details: parseResult.error.format(),
      });
    }

    const created = await this.productService.createDraft(user.id, parseResult.data);
    return createSuccessResponse(created);
  }

  @Get()
  async listSellerProducts(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Query() rawQuery: Record<string, string | undefined>,
  ) {
    const parseResult = listSellerProductsQuerySchema.safeParse({
      page: rawQuery['page'] ? parseInt(rawQuery['page'], 10) : undefined,
      limit: rawQuery['limit'] ? parseInt(rawQuery['limit'], 10) : undefined,
      status: rawQuery['status'],
      categoryId: rawQuery['categoryId'],
      search: rawQuery['search'],
    });

    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Invalid product query parameters',
        details: parseResult.error.format(),
      });
    }

    const { items, meta } = await this.productService.listSellerProducts(user.id, parseResult.data);
    return createSuccessResponse({ items, ...meta });
  }

  @Post('media/ticket')
  @HttpCode(HttpStatus.OK)
  async generateMediaTicket(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Body() rawBody: unknown,
  ) {
    const parseResult = presignedProductMediaRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Invalid media upload request',
        details: parseResult.error.format(),
      });
    }

    const { seller } = await this.productService.getSellerProfile(user.id);
    const ticket = this.mediaService.generateUploadTicket(seller.id, parseResult.data);
    return createSuccessResponse(ticket);
  }

  @Get(':id')
  async getSellerProduct(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('id') productId: string,
  ) {
    const product = await this.productService.getSellerProduct(user.id, productId);
    return createSuccessResponse(product);
  }

  @Put(':id')
  async updateProduct(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('id') productId: string,
    @Body() rawBody: unknown,
  ) {
    const parseResult = updateProductSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Product update validation failed',
        details: parseResult.error.format(),
      });
    }

    const updated = await this.productService.updateProduct(user.id, productId, parseResult.data);
    return createSuccessResponse(updated);
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  async submitForModeration(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('id') productId: string,
  ) {
    const submitted = await this.productService.submitForModeration(user.id, productId);
    return createSuccessResponse(submitted);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  async archiveProduct(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('id') productId: string,
  ) {
    const archived = await this.productService.archiveProduct(user.id, productId);
    return createSuccessResponse(archived);
  }

  @Post(':id/media')
  @HttpCode(HttpStatus.CREATED)
  async attachMedia(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('id') productId: string,
    @Body() rawBody: unknown,
  ) {
    const parseResult = attachProductMediaSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Invalid media attachment data',
        details: parseResult.error.format(),
      });
    }

    const attached = await this.productService.attachMedia(user.id, productId, parseResult.data);
    return createSuccessResponse(attached);
  }

  @Delete(':id/media/:mediaId')
  async removeMedia(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('id') productId: string,
    @Param('mediaId') mediaId: string,
  ) {
    const result = await this.productService.removeMedia(user.id, productId, mediaId);
    return createSuccessResponse(result);
  }

  @Put(':id/media/reorder')
  async reorderMedia(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('id') productId: string,
    @Body() rawBody: unknown,
  ) {
    const parseResult = reorderProductMediaSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Invalid media order payload',
        details: parseResult.error.format(),
      });
    }

    const result = await this.productService.reorderMedia(user.id, productId, parseResult.data);
    return createSuccessResponse(result);
  }
}
