import { Hono } from 'hono';
import { eq, and, asc } from 'drizzle-orm';
import { legs, routes } from '../db/schema';
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

  // Get current max order
  const existingLegs = await db.select().from(legs).where(eq(legs.route_id, routeId));
  const maxOrder = existingLegs.reduce((max, l) => Math.max(max, l.order), -1);

  const nights = body.type === 'location'
    ? calcNights(body.start_date ?? null, body.end_date ?? null)
    : null;

  const leg = {
    id: generateId(),
    route_id: routeId,
    order: maxOrder + 1,
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

export default legRoutes;
