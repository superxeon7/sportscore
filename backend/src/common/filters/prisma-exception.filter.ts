import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

interface PrismaExceptionResponseBody {
  success: false;
  statusCode: number;
  message: string;
  error: string;
  timestamp: string;
  path: string;
}

/**
 * Exception filter that catches Prisma client known-request errors
 * and maps them to appropriate HTTP responses.
 *
 * Handled error codes:
 * - P2002: Unique constraint violation  -> 409 Conflict
 * - P2025: Record not found             -> 404 Not Found
 * - P2003: Foreign key constraint failed -> 400 Bad Request
 * - P2014: Relation violation            -> 400 Bad Request
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    let statusCode: number;
    let message: string;
    let error: string;

    switch (exception.code) {
      case 'P2002': {
        statusCode = HttpStatus.CONFLICT;
        error = 'Conflict';
        const target = (exception.meta?.target as string[])?.join(', ') || 'unknown field';
        message = `A record with the same value already exists for: ${target}`;
        break;
      }

      case 'P2025': {
        statusCode = HttpStatus.NOT_FOUND;
        error = 'Not Found';
        const cause = (exception.meta?.cause as string) || 'Record not found';
        message = cause;
        break;
      }

      case 'P2003': {
        statusCode = HttpStatus.BAD_REQUEST;
        error = 'Bad Request';
        const field = (exception.meta?.field_name as string) || 'unknown field';
        message = `Foreign key constraint failed on field: ${field}`;
        break;
      }

      case 'P2014': {
        statusCode = HttpStatus.BAD_REQUEST;
        error = 'Bad Request';
        message = 'The change you are trying to make would violate a required relation';
        break;
      }

      default: {
        statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
        error = 'Internal Server Error';
        message = 'An unexpected database error occurred';
        this.logger.error(
          `Unhandled Prisma error code ${exception.code}: ${exception.message}`,
          exception.stack,
        );
        break;
      }
    }

    const responseBody: PrismaExceptionResponseBody = {
      success: false,
      statusCode,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    this.logger.warn(
      `${request.method} ${request.url} ${statusCode} - Prisma ${exception.code}: ${message}`,
    );

    response.status(statusCode).json(responseBody);
  }
}
