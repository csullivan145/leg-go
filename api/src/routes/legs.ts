import { Hono } from 'hono';
import { eq, and, asc } from 'drizzle-orm';
import { legs, routes, accommodations, dayTrips, activities, carRentals } from '../db/schema';
import { createLegSchema, updateLegSchema } from '@leg-go/shared';
import { generateId } from '../lib/utils';
import { requireTripAccess } from '../middleware/trip-access';
import type { Env } from '../env';
import type { AppDb } from '../middleware/db';
import type { AuthUser } from '../middleware/auth';
import type { TripRole } from '@leg-go/shared';
import type { trips } from '../db/schema';

const legRoutes = new Hono<{
  Bindings: Env;
  Variables: { db: AppDb; user: AuthUser; trip: typeof trips.$inferSelect; tripRole: TripRole };
}>();

function calcNights(startDate: string | null, endDate: string | null): number | null {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : null;
}

// Helper: get route and verify it belongs to the current user's trip
async function getRouteWithTripAccess(db: AppDb, routeId: string, userId: string) {
  // Get the route
  const route = await db.select().from(routes).where(eq(routes.id, routeId)).get();
  if (!route) return null;
  return route;
}

// POST /routes/:routeId/legs — add leg (editor+)
legRoutes.post('/routes/:routeId/legs', requireTripAccess('editor'), async (c) => {
  const db = c.get('db');
  const trip = c.get('trip');
  const { routeId } = c.req.param();
  const body = createLegSchema.parse(await c.req.json());

  // Verify route belongs to this trip
  const route = await db.select().from(routes)
    .where(and(eq(routes.id, routeId), eq(routes.trip_id, trip.id)))
    .get();
  if (!route) return c.json({ error: 'Route not found' }, 404);

  // Get current legs and determine order
  const existingLegs = await db.select().from(legs).where(eq(legs.route_id, routeId));
  const maxOrder = existingLegs.reduce((max, l) => Math.max(max, l.order), -1);

  let insertOrder: number;
  if (body.order != null) {
    insertOrder = body.order;
    // Shift existing legs at or after this order up by 1
    const toShift = existingLegs.filter((l) => l.order >= insertOrder);
    await Promise.all(
      toShift.map((l) => db.update(legs).set({ order: l.order + 1 }).where(eq(legs.id, l.id))),
    );
  } else {
    insertOrder = maxOrder + 1;
  }

  const nights = body.type === 'location'
    ? calcNights(body.start_date ?? null, body.end_date ?? null)
    : null;

  const leg = {
    id: generateId(),
    route_id: routeId,
    order: insertOrder,
    nights,
    name: body.name ?? null,
    start_date: body.start_date ?? null,
    end_date: body.end_date ?? null,
    transport_type: body.transport_type ?? null,
    cost: body.cost ?? null,
    duration: body.duration ?? null,
    stops: body.stops ?? null,
    company: body.company ?? null,
    booking_id: body.booking_id ?? null,
    booking_link: body.booking_link ?? null,
    departure_time: body.departure_time ?? null,
    arrival_time: body.arrival_time ?? null,
    departure_location: body.departure_location ?? null,
    arrival_location: body.arrival_location ?? null,
    notes: body.notes ?? null,
    ...body,
  };

  await db.insert(legs).values(leg);
  const created = await db.select().from(legs).where(eq(legs.id, leg.id)).get();
  return c.json({ leg: created }, 201);
});

// PATCH /legs/:legId — update leg (editor+)
legRoutes.patch('/legs/:legId', requireTripAccess('editor'), async (c) => {
  const db = c.get('db');
  const trip = c.get('trip');
  const { legId } = c.req.param();
  const body = updateLegSchema.parse(await c.req.json());

  // Verify the leg belongs to a route in this trip
  const leg = await db.select().from(legs).where(eq(legs.id, legId)).get();
  if (!leg) return c.json({ error: 'Leg not found' }, 404);

  const route = await db.select().from(routes)
    .where(and(eq(routes.id, leg.route_id), eq(routes.trip_id, trip.id)))
    .get();
  if (!route) return c.json({ error: 'Access denied' }, 403);

  // Recalculate nights if dates change
  const updatedStartDate = body.start_date !== undefined ? body.start_date : leg.start_date;
  const updatedEndDate = body.end_date !== undefined ? body.end_date : leg.end_date;
  const nights = leg.type === 'location'
    ? calcNights(updatedStartDate ?? null, updatedEndDate ?? null)
    : leg.nights;

  await db.update(legs).set({ ...body, nights }).where(eq(legs.id, legId));

  // Auto-reorder: if any leg's start_date changed (location or travel),
  // resort all legs chronologically by start_date. Stable for ties and for
  // legs with no date (they keep their relative position).
  if (body.start_date !== undefined) {
    const allLegs = await db
      .select()
      .from(legs)
      .where(eq(legs.route_id, leg.route_id));
    // Seed with stable relative order
    allLegs.sort((a, b) => a.order - b.order);

    const indexed = allLegs.map((l, idx) => ({ leg: l, originalIdx: idx }));
    indexed.sort((a, b) => {
      const as = a.leg.start_date;
      const bs = b.leg.start_date;
      if (!as && !bs) return a.originalIdx - b.originalIdx;
      if (!as) return 1;
      if (!bs) return -1;
      if (as === bs) return a.originalIdx - b.originalIdx;
      return as.localeCompare(bs);
    });

    for (let i = 0; i < indexed.length; i++) {
      const l = indexed[i].leg;
      if (l.order !== i) {
        await db.update(legs).set({ order: i }).where(eq(legs.id, l.id));
      }
    }
  }

  const updated = await db.select().from(legs).where(eq(legs.id, legId)).get();
  return c.json({ leg: updated });
});

// DELETE /legs/:legId — delete leg (editor+)
legRoutes.delete('/legs/:legId', requireTripAccess('editor'), async (c) => {
  const db = c.get('db');
  const trip = c.get('trip');
  const { legId } = c.req.param();

  const leg = await db.select().from(legs).where(eq(legs.id, legId)).get();
  if (!leg) return c.json({ error: 'Leg not found' }, 404);

  const route = await db.select().from(routes)
    .where(and(eq(routes.id, leg.route_id), eq(routes.trip_id, trip.id)))
    .get();
  if (!route) return c.json({ error: 'Access denied' }, 403);

  await db.delete(legs).where(eq(legs.id, legId));
  return c.json({ ok: true });
});

// POST /legs/:legId/reorder — reorder legs within route (editor+)
legRoutes.post('/legs/:legId/reorder', requireTripAccess('editor'), async (c) => {
  const db = c.get('db');
  const trip = c.get('trip');
  const { legId } = c.req.param();
  const body = await c.req.json<{ order: number }>();

  const leg = await db.select().from(legs).where(eq(legs.id, legId)).get();
  if (!leg) return c.json({ error: 'Leg not found' }, 404);

  const route = await db.select().from(routes)
    .where(and(eq(routes.id, leg.route_id), eq(routes.trip_id, trip.id)))
    .get();
  if (!route) return c.json({ error: 'Access denied' }, 403);

  const allLegs = await db.select().from(legs)
    .where(eq(legs.route_id, leg.route_id))
    .orderBy(asc(legs.order));

  // Remove the leg from current position
  const filtered = allLegs.filter((l) => l.id !== legId);
  // Insert at new position
  const newOrder = Math.max(0, Math.min(body.order, filtered.length));
  filtered.splice(newOrder, 0, leg);

  // Update all leg orders
  await Promise.all(
    filtered.map((l, idx) =>
      db.update(legs).set({ order: idx }).where(eq(legs.id, l.id))
    ),
  );

  const updatedLegs = await db.select().from(legs)
    .where(eq(legs.route_id, leg.route_id))
    .orderBy(asc(legs.order));

  return c.json({ legs: updatedLegs });
});

// POST /legs/:legId/copy — copy leg to another route (editor+)
legRoutes.post('/legs/:legId/copy', requireTripAccess('editor'), async (c) => {
  const db = c.get('db');
  const trip = c.get('trip');
  const { legId } = c.req.param();
  const { targetRouteIds } = await c.req.json<{ targetRouteIds: string[] }>();

  const leg = await db.select().from(legs).where(eq(legs.id, legId)).get();
  if (!leg) return c.json({ error: 'Leg not found' }, 404);

  const sourceRoute = await db.select().from(routes)
    .where(and(eq(routes.id, leg.route_id), eq(routes.trip_id, trip.id)))
    .get();
  if (!sourceRoute) return c.json({ error: 'Access denied' }, 403);

  // Get sub-resources for this leg
  const [accomList, dayTripList, activityList, carRentalList] = await Promise.all([
    db.select().from(accommodations).where(eq(accommodations.leg_id, legId)),
    db.select().from(dayTrips).where(eq(dayTrips.leg_id, legId)),
    db.select().from(activities).where(eq(activities.leg_id, legId)),
    db.select().from(carRentals).where(eq(carRentals.leg_id, legId)),
  ]);

  const copied: string[] = [];

  for (const targetRouteId of targetRouteIds) {
    // Verify target route belongs to same trip
    const targetRoute = await db.select().from(routes)
      .where(and(eq(routes.id, targetRouteId), eq(routes.trip_id, trip.id)))
      .get();
    if (!targetRoute) continue;

    // Get target legs sorted by order
    const targetLegs = await db.select().from(legs).where(eq(legs.route_id, targetRouteId));
    targetLegs.sort((a, b) => a.order - b.order);

    // Determine insertion position based on dates
    let insertOrder: number;
    if (leg.start_date) {
      // Find the right position: after the location whose end_date <= travel start_date
      const insertIdx = targetLegs.findIndex((tl) => {
        if (tl.type !== 'location') return false;
        if (!tl.start_date) return false;
        return tl.start_date > leg.start_date!;
      });
      if (insertIdx === -1) {
        insertOrder = (targetLegs.length > 0 ? targetLegs[targetLegs.length - 1].order + 1 : 0);
      } else {
        insertOrder = targetLegs[insertIdx].order;
      }
    } else {
      insertOrder = (targetLegs.length > 0 ? targetLegs[targetLegs.length - 1].order + 1 : 0);
    }

    // Shift legs at or after insert position
    const toShift = targetLegs.filter((l) => l.order >= insertOrder);
    await Promise.all(
      toShift.map((l) => db.update(legs).set({ order: l.order + 1 }).where(eq(legs.id, l.id))),
    );

    const newLegId = generateId();
    const { id: _id, route_id: _rid, order: _ord, ...legData } = leg;
    await db.insert(legs).values({
      ...legData,
      id: newLegId,
      route_id: targetRouteId,
      order: insertOrder,
    });

    // Copy sub-resources
    for (const a of accomList) {
      const { id: _aid, leg_id: _alid, ...aData } = a;
      await db.insert(accommodations).values({ ...aData, id: generateId(), leg_id: newLegId });
    }
    for (const dt of dayTripList) {
      const { id: _did, leg_id: _dlid, ...dtData } = dt;
      await db.insert(dayTrips).values({ ...dtData, id: generateId(), leg_id: newLegId });
    }
    for (const act of activityList) {
      const { id: _actid, leg_id: _alid, ...actData } = act;
      await db.insert(activities).values({ ...actData, id: generateId(), leg_id: newLegId });
    }
    for (const cr of carRentalList) {
      const { id: _crid, leg_id: _clid, ...crData } = cr;
      await db.insert(carRentals).values({ ...crData, id: generateId(), leg_id: newLegId });
    }

    copied.push(targetRouteId);
  }

  return c.json({ ok: true, copiedTo: copied });
});

export default legRoutes;
