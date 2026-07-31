import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { runWithTenant } from '../tenant-context';

/**
 * Runs every HTTP request handler inside the tenant (organization) context
 * extracted from the authenticated JWT. Public routes (no `req.user`) pass
 * through untouched — the tenant extension simply no-ops without a context.
 *
 * The handler is subscribed manually inside `runWithTenant` so that ALL
 * downstream async work (services, Prisma queries) executes within the
 * AsyncLocalStorage context, including after `await` boundaries.
 */
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user?: { organizationId?: string } }>();
    const tenantId = request.user?.organizationId;
    if (!tenantId) {
      return next.handle();
    }

    return new Observable((subscriber) => {
      runWithTenant(tenantId, () => {
        next.handle().subscribe({
          next: (value) => subscriber.next(value),
          error: (err) => subscriber.error(err),
          complete: () => subscriber.complete(),
        });
      });
    });
  }
}
