import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

export interface TransformedResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, any>;
}

/**
 * Global interceptor that wraps all successful responses in a standardized envelope:
 *
 * ```json
 * {
 *   "success": true,
 *   "data": <response payload>,
 *   "meta": { ... }   // optional
 * }
 * ```
 *
 * If the controller returns an object with `data` and `meta` properties,
 * they will be extracted and placed into the envelope. Otherwise the
 * entire return value is placed under `data`.
 */
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, TransformedResponse<T>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<TransformedResponse<T>> {
    return next.handle().pipe(
      map((responseData) => {
        // If the handler explicitly returns our envelope structure,
        // extract data and meta from it.
        if (
          responseData !== null &&
          responseData !== undefined &&
          typeof responseData === 'object' &&
          'data' in responseData
        ) {
          const obj = responseData as Record<string, any>;
          return {
            success: true as const,
            data: obj.data as T,
            ...(obj.meta ? { meta: obj.meta } : {}),
          };
        }

        return {
          success: true as const,
          data: responseData,
        };
      }),
    );
  }
}
