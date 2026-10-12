import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  Res,
  UseGuards,
  BadRequestException,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { CartService } from './cart.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUserPayload } from '../../common/decorators/current-user.decorator';
import { createSuccessResponse } from '@repo/api-contracts';
import { addToCartSchema, updateCartItemQuantitySchema, mergeCartSchema } from '@repo/validation';

@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(
    @Inject(CartService)
    private readonly cartService: CartService,
  ) {}

  private resolveIdentifier(
    req: Request,
    res: Response,
    user?: AuthenticatedUserPayload | null,
  ): { customerId?: string; sessionId?: string } {
    if (user?.id) {
      return { customerId: user.id };
    }

    let sessionId = req.headers['x-cart-session-id'] as string;
    if (!sessionId && req.cookies && typeof req.cookies['cart_session_id'] === 'string') {
      sessionId = req.cookies['cart_session_id'];
    }

    if (!sessionId) {
      sessionId = randomUUID();
      res.cookie('cart_session_id', sessionId, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      res.setHeader('x-cart-session-id', sessionId);
    }

    return { sessionId };
  }

  @Public()
  @Get()
  async getCart(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user: AuthenticatedUserPayload | null,
  ) {
    const identifier = this.resolveIdentifier(req, res, user);
    const cart = await this.cartService.getCart(identifier);
    return createSuccessResponse(cart);
  }

  @Public()
  @Post('items')
  async addItem(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user: AuthenticatedUserPayload | null,
    @Body() rawBody: unknown,
  ) {
    const parseResult = addToCartSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException(parseResult.error.errors[0]?.message || 'Invalid item input');
    }

    const identifier = this.resolveIdentifier(req, res, user);
    const cart = await this.cartService.addItem(identifier, parseResult.data);
    return createSuccessResponse(cart);
  }

  @Public()
  @Patch('items/:itemId')
  async updateItemQuantity(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user: AuthenticatedUserPayload | null,
    @Param('itemId') itemId: string,
    @Body() rawBody: unknown,
  ) {
    const parseResult = updateCartItemQuantitySchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException(
        parseResult.error.errors[0]?.message || 'Invalid quantity update',
      );
    }

    const identifier = this.resolveIdentifier(req, res, user);
    const cart = await this.cartService.updateItemQuantity(identifier, itemId, parseResult.data);
    return createSuccessResponse(cart);
  }

  @Public()
  @Delete('items/:itemId')
  async removeItem(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user: AuthenticatedUserPayload | null,
    @Param('itemId') itemId: string,
  ) {
    const identifier = this.resolveIdentifier(req, res, user);
    const cart = await this.cartService.removeItem(identifier, itemId);
    return createSuccessResponse(cart);
  }

  @Public()
  @Post('clear')
  async clearCart(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user: AuthenticatedUserPayload | null,
  ) {
    const identifier = this.resolveIdentifier(req, res, user);
    const cart = await this.cartService.clearCart(identifier);
    return createSuccessResponse(cart);
  }

  @Post('merge')
  async mergeCart(@CurrentUser() user: AuthenticatedUserPayload | null, @Body() rawBody: unknown) {
    if (!user?.id) {
      throw new UnauthorizedException('Authentication required to merge cart');
    }

    const parseResult = mergeCartSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException(
        parseResult.error.errors[0]?.message || 'Invalid merge request',
      );
    }

    const cart = await this.cartService.mergeCart(user.id, parseResult.data.guestSessionId);
    return createSuccessResponse(cart);
  }
}
