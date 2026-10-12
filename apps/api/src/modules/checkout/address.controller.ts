import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { AddressService } from './address.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUserPayload } from '../../common/decorators/current-user.decorator';
import { createSuccessResponse } from '@repo/api-contracts';
import { deliveryAddressSchema } from '@repo/validation';

@Controller('customer/addresses')
@UseGuards(JwtAuthGuard)
export class AddressController {
  constructor(
    @Inject(AddressService)
    private readonly addressService: AddressService,
  ) {}

  @Get()
  async listAddresses(@CurrentUser() user: AuthenticatedUserPayload) {
    const addresses = await this.addressService.listAddresses(user.id);
    return createSuccessResponse(addresses);
  }

  @Post()
  async createAddress(@CurrentUser() user: AuthenticatedUserPayload, @Body() rawBody: unknown) {
    const parseResult = deliveryAddressSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException(
        parseResult.error.errors[0]?.message || 'Invalid delivery address',
      );
    }

    const created = await this.addressService.createAddress(user.id, parseResult.data);
    return createSuccessResponse(created);
  }

  @Put(':id')
  async updateAddress(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('id') addressId: string,
    @Body() rawBody: unknown,
  ) {
    const parseResult = deliveryAddressSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException(
        parseResult.error.errors[0]?.message || 'Invalid delivery address',
      );
    }

    const updated = await this.addressService.updateAddress(user.id, addressId, parseResult.data);
    return createSuccessResponse(updated);
  }

  @Delete(':id')
  async deleteAddress(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('id') addressId: string,
  ) {
    await this.addressService.deleteAddress(user.id, addressId);
    return createSuccessResponse({ deleted: true });
  }
}
