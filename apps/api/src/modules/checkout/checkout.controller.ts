import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Headers,
  Req,
  Res,
  UseGuards,
  BadRequestException,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { CheckoutService } from './checkout.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUserPayload } from '../../common/decorators/current-user.decorator';
import { createSuccessResponse } from '@repo/api-contracts';
import {
  checkoutQuoteQuerySchema,
  createCheckoutSessionSchema,
  confirmCheckoutSchema,
} from '@repo/validation';

@Controller()
@UseGuards(JwtAuthGuard)
export class CheckoutController {
  constructor(
    @Inject(CheckoutService)
    private readonly checkoutService: CheckoutService,
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
  @Post('checkout/quote')
  async getQuote(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user: AuthenticatedUserPayload | null,
    @Body() rawBody: unknown,
  ) {
    const parseResult = checkoutQuoteQuerySchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException(
        parseResult.error.errors[0]?.message || 'Invalid quote request',
      );
    }

    const identifier = this.resolveIdentifier(req, res, user);
    const result = await this.checkoutService.getQuote(identifier, parseResult.data);
    return createSuccessResponse(result);
  }

  @Public()
  @Post('checkout/session')
  async createCheckoutSession(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user: AuthenticatedUserPayload | null,
    @Body() rawBody: unknown,
  ) {
    const parseResult = createCheckoutSessionSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException(
        parseResult.error.errors[0]?.message || 'Invalid checkout session request',
      );
    }

    const identifier = this.resolveIdentifier(req, res, user);
    const session = await this.checkoutService.createCheckoutSession(identifier, parseResult.data);
    return createSuccessResponse(session);
  }

  @Post('checkout/confirm')
  async confirmCheckout(
    @CurrentUser() user: AuthenticatedUserPayload | null,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() rawBody: unknown,
  ) {
    if (!user?.id) {
      throw new UnauthorizedException('Authentication required to confirm checkout');
    }

    const parseResult = confirmCheckoutSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException(
        parseResult.error.errors[0]?.message || 'Invalid checkout confirmation input',
      );
    }

    const confirmation = await this.checkoutService.confirmCheckout(
      user.id,
      parseResult.data,
      idempotencyKey,
    );
    return createSuccessResponse(confirmation);
  }

  @Get('orders/:orderNumber')
  async getOrderByNumber(
    @CurrentUser() user: AuthenticatedUserPayload | null,
    @Param('orderNumber') orderNumber: string,
  ) {
    if (!user?.id) {
      throw new UnauthorizedException('Authentication required to view order details');
    }

    const order = await this.checkoutService.getOrderByNumber(user.id, orderNumber);
    return createSuccessResponse(order);
  }
}
