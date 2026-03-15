import { createMiddleware } from 'hono/factory';
import { eq, and } from 'drizzle-orm';
import { trips, tripShares, routes, legs, accommodations, dayTrips, activities, carRentals, tripOffsets } from '../db/schema';
import type { TripRole } from '@leg-go/shared';
import type { AppDb } from './db';
import type { AuthUser } from './auth';
import type { Env } from '../env';

const roleHierarchy: Record<TripRole, number> = { viewer: 1, editor: 2, owner: 3 };

async function resolveTripFromLeg(db: AppDb, legId: string): Promise<string | null> {
  const leg = await db.select({ route_id: legs.route_id }).from(legs).where(eq(legs.id, legId)).get();
  if (!leg) return null;
  const route = await db.select({ trip_id: routes.trip_id }).from(routes).where(eq(routes.id, leg.route_id)).get();
  return route?.trip_id ?? null;
}

async function resolveTripId(c: { req: { param: (k: string) => string | undefined }; get: (k: 'db') => AppDb }): Promise<string | null> {
  // Direct trip ID from URL
  const tripId = c.req.param('tripId') || c.req.param('id');
  if (tripId) return tripId;

  const db = c.get('db');

  // Resolve from routeId
  const routeId = c.req.param('routeId');
  if (routeId) {
    const route = await db.select({ trip_id: routes.trip_id }).from(routes).where(eq(routes.id, routeId)).get();
    return route?.trip_id ?? null;
  }

  // Resolve from legId
  const legId = c.req.param('legId');
  if (legId) return resolveTripFromLeg(db, legId);

  // Resolve from accommodationId
  const accommodationId = c.req.param('accommodationId');
  if (accommodationId) {
    const accom = await db.select({ leg_id: accommodations.leg_id }).from(accommodations).where(eq(accommodations.id, accommodationId)).get();
    if (!accom) return null;
    return resolveTripFromLeg(db, accom.leg_id);
  }

  // Resolve from activityId
  const activityId = c.req.param('activityId');
  if (activityId) {
    const activity = await db.select({ leg_id: activities.leg_id }).from(activities).where(eq(activities.id, activityId)).get();
    if (!activity) return null;
    return resolveTripFromLeg(db, activity.leg_id);
  }

  // Resolve from dayTripId
  const dayTripId = c.req.param('dayTripId');
  if (dayTripId) {
    const dt = await db.select({ leg_id: dayTrips.leg_id }).from(dayTrips).where(eq(dayTrips.id, dayTripId)).get();
    if (!dt) return null;
    return resolveTripFromLeg(db, dt.leg_id);
  }

  // Resolve from carRentalId
  const carRentalId = c.req.param('carRentalId');
  if (carRentalId) {
    const cr = await db.select({ leg_id: carRentals.leg_id }).from(carRentals).where(eq(carRentals.id, carRentalId)).get();
    if (!cr) return null;
    return resolveTripFromLeg(db, cr.leg_id);
  }

  // Resolve from offsetId
  const offsetId = c.req.param('offsetId');
  if (offsetId) {
    const offset = await db.select({ trip_id: tripOffsets.trip_id }).from(tripOffsets).where(eq(tripOffsets.id, offsetId)).get();
    return offset?.trip_id ?? null;
  }

  // Resolve from shareId
  const shareId = c.req.param('shareId');
  if (shareId) {
    const share = await db.select({ trip_id: tripShares.trip_id }).from(tripShares).where(eq(tripShares.id, shareId)).get();
    return share?.trip_id ?? null;
  }

  return null;
}

export function requireTripAccess(minRole: TripRole) {
  return createMiddleware<{
    Bindings: Env;
    Variables: { db: AppDb; user: AuthUser; trip: typeof trips.$inferSelect; tripRole: TripRole };
  }>(async (c, next) => {
    const db = c.get('db');
    const user = c.get('user');
    const tripId = await resolveTripId(c);
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
