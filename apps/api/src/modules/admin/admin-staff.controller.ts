import {
  Controller,
  Get,
  Post,
  Patch,
  Query,
  Param,
  Body,
  UseGuards,
  BadRequestException,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  type AuthenticatedUserPayload,
} from '../../common/decorators/current-user.decorator';
import { AdminStaffService } from './admin-staff.service';
import {
  adminStaffQuerySchema,
  createStaffUserSchema,
  updateStaffStatusSchema,
} from '@repo/validation';
import { createSuccessResponse } from '@repo/api-contracts';

@Controller('admin/staff')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class AdminStaffController {
  constructor(
    @Inject(AdminStaffService)
    private readonly staffService: AdminStaffService,
  ) {}

  @Get()
  async listStaff(@Query() rawQuery: Record<string, string | undefined>) {
    const parseResult = adminStaffQuerySchema.safeParse({
      page: rawQuery['page'] ? parseInt(rawQuery['page'], 10) : undefined,
      limit: rawQuery['limit'] ? parseInt(rawQuery['limit'], 10) : undefined,
      search: rawQuery['search'],
      role: rawQuery['role'],
      status: rawQuery['status'],
    });

    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Invalid staff query parameters',
        details: parseResult.error.format(),
      });
    }

    const { items, meta } = await this.staffService.listStaff(parseResult.data);
    return createSuccessResponse({ items, ...meta });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createStaff(@CurrentUser() user: AuthenticatedUserPayload, @Body() rawBody: unknown) {
    const parseResult = createStaffUserSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Staff creation validation failed',
        details: parseResult.error.format(),
      });
    }

    const staffUser = await this.staffService.createStaff(user.id, parseResult.data);
    return createSuccessResponse(staffUser);
  }

  @Patch(':userId/status')
  async updateStaffStatus(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('userId') userId: string,
    @Body() rawBody: unknown,
  ) {
    const parseResult = updateStaffStatusSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Status update validation failed',
        details: parseResult.error.format(),
      });
    }

    const updated = await this.staffService.updateStaffStatus(user.id, userId, parseResult.data);
    return createSuccessResponse(updated);
  }
}
