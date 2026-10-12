import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { SessionService } from './session.service';
import { MfaService } from './mfa.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SellerActiveGuard } from '../../common/guards/seller-active.guard';
import { ResourceOwnerGuard } from '../../common/guards/resource-owner.guard';

@Module({
  imports: [
    JwtModule.register({
      secret:
        process.env['JWT_SECRET'] ||
        'dev-insecure-secret-handcrafted-marketplace-change-in-production-1234567890',
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    SessionService,
    MfaService,
    JwtAuthGuard,
    RolesGuard,
    SellerActiveGuard,
    ResourceOwnerGuard,
  ],
  exports: [
    AuthService,
    TokenService,
    SessionService,
    MfaService,
    JwtAuthGuard,
    RolesGuard,
    SellerActiveGuard,
    ResourceOwnerGuard,
  ],
})
export class AuthModule {}
