import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { JwtTokenPayload } from '@repo/api-contracts';

export interface AuthenticatedUserPayload extends JwtTokenPayload {
  id: string;
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUserPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUserPayload;
    if (!user) return null;
    return data ? user[data] : user;
  },
);
