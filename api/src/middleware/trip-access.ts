import { createMiddleware } from 'hono/factory';
import { eq, and } from 'drizzle-orm';
import { trips, tripShares } from '../db/schema';
import type { TripRole } from '@leg-go/shared';
import type { AppDb } from './db';
import type { AuthUser } from './auth';
import type { Env } from '../env';

const roleHierarchy: Record<TripRole, number> = { viewer: 1, editor: 2, owner: 3 };

export function requireTripAccess(minRole: TripRole) {
  return createMiddleware<{
    Bindings: Env;
    Variables: { db: AppDb; user: AuthUser; trip: typeof trips.$inferSelect; tripRole: TripRole };
  }>(async (c, next) => {
    const db = c.get('db');
    const user = c.get('user');
    const tripId = c.req.param('tripId') || c.req.param('id');
    if (!tripId) return c.json({ error: 'Trip ID required' }, 400);

    const trip = await db.select().from(trips).where(
      and(eq(trips.id, tripId), eq(trips.is_active, true))
    ).get();
    if (!trip) return c.json({ error: 'Trip not found' }, 404);

    let role: TripRole;
    if (trip.owner_id === user.id) {
      role = 'owner';
    } else {
      const share = await db.select().from(tripShares).where(
        and(eq(tripShares.trip_id, tripId), eq(tripShares.user_id, user.id))
      ).get();
      if (!share) return c.json({ error: 'Access denied' }, 403);
      role = share.role;
    }

    if (roleHierarchy[role] < roleHierarchy[minRole]) {
      return c.json({ error: 'Insufficient permissions' }, 403);
    }

    c.set('trip', trip);
    c.set('tripRole', role);
    await next();
  });
}
