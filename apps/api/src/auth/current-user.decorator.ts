import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { JwtPayload } from './jwt-auth.guard.js';
export const CurrentUser = createParamDecorator((_d: unknown, ctx: ExecutionContext): JwtPayload => {
  return ctx.switchToHttp().getRequest<{ user: JwtPayload }>().user;
});
