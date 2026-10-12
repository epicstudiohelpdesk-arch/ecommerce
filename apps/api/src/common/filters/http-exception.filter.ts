import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { createErrorResponse } from '@repo/api-contracts';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected error occurred';
    let details: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const obj = res as Record<string, unknown>;
        message = (obj['message'] as string) || exception.message;
        code = (obj['error'] as string) || exception.name.replace(/Exception$/, '').toUpperCase();
        details = obj['details'];
      }
    } else if (exception instanceof Error) {
      this.logger.error(`Unhandled server error: ${exception.message}`, exception.stack);
      message = exception.message;
    }

    const correlationId = (request.headers['x-correlation-id'] as string) || undefined;
    const errorResponse = createErrorResponse(code, message, details, correlationId);

    response.status(status).json(errorResponse);
  }
}
