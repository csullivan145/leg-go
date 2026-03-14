import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { dayTrips, legs, routes } from '../db/schema';
import { createDayTripSchema, updateDayTripSchema } from '@leg-go/shared';
import { generateId } from '../lib/utils';
import { requireTripAccess } from '../middleware/trip-access';
import type { Env } from '../env';
import type { AppDb } from '../middleware/db';
import type { AuthUser } from '../middleware/auth';
import type { TripRole } from '@leg-go/shared';
import type { trips } from '../db/schema';

const dayTripRoutes = new Hono<{
  Bindings: Env;
  Variables: { db: AppDb; user: AuthUser; trip: typeof trips.$inferSelect; tripRole: TripRole };
}>();

// Helper: verify leg belongs to trip
async function verifyLegAccess(db: AppDb, legId: string, tripId: string) {
  const leg = await db.select().from(legs).where(eq(legs.id, legId)).get();
  if (!leg) return null;
  const route = await db.select().from(routes)
    .where(and(eq(routes.id, leg.route_id), eq(routes.trip_id, tripId)))
    .get();
  if (!route) return null;
  return leg;
}

// GET /legs/:legId/daytrips — list day trips (viewer+)
dayTripRoutes.get('/legs/:legId/daytrips', requireTripAccess('viewer'), async (c) => {
  const db = c.get('db');
  const trip = c.get('trip');
  const { legId } = c.req.param();

  const leg = await verifyLegAccess(db, legId, trip.id);
  if (!leg) return c.json({ error: 'Leg not found' }, 404);

  const dayTripList = await db.select().from(dayTrips).where(eq(dayTrips.leg_id, legId));
  return c.json({ dayTrips: dayTripList });
});

// POST /legs/:legId/daytrips — create day trip (editor+)
dayTripRoutes.post('/legs/:legId/daytrips', requireTripAccess('editor'), async (c) => {
  const db = c.get('db');
  const trip = c.get('trip');
  const { legId } = c.req.param();
  const body = createDayTripSchema.parse(await c.req.json());

  const leg = await verifyLegAccess(db, legId, trip.id);
  if (!leg) return c.json({ error: 'Leg not found' }, 404);
  if (leg.type !== 'location') return c.json({ error: 'Leg must be of type location' }, 400);

  const dayTrip = {
    id: generateId(),
    leg_id: legId,
    date: body.date,
    destination_name: body.destination_name,
    status: body.status ?? ('idea' as const),
    transport_type: body.transport_type ?? null,
    cost: body.cost ?? null,
    notes: body.notes ?? null,
  };

  await db.insert(dayTrips).values(dayTrip);
  return c.json({ dayTrip }, 201);
});

// PATCH /daytrips/:dayTripId — update day trip (editor+)
dayTripRoutes.patch('/daytrips/:dayTripId', requireTripAccess('editor'), async (c) => {
  const db = c.get('db');
  const trip = c.get('trip');
  const { dayTripId } = c.req.param();
  const body = updateDayTripSchema.parse(await c.req.json());

  const dayTrip = await db.select().from(dayTrips).where(eq(dayTrips.id, dayTripId)).get();
  if (!dayTrip) return c.json({ error: 'Day trip not found' }, 404);

  const leg = await verifyLegAccess(db, dayTrip.leg_id, trip.id);
  if (!leg) return c.json({ error: 'Access denied' }, 403);

  await db.update(dayTrips).set(body).where(eq(dayTrips.id, dayTripId));
  const updated = await db.select().from(dayTrips).where(eq(dayTrips.id, dayTripId)).get();
  return c.json({ dayTrip: updated });
});

// DELETE /daytrips/:dayTripId — delete day trip (editor+)
dayTripRoutes.delete('/daytrips/:dayTripId', requireTripAccess('editor'), async (c) => {
  const db = c.get('db');
  const trip = c.get('trip');
  const { dayTripId } = c.req.param();

  const dayTrip = await db.select().from(dayTrips).where(eq(dayTrips.id, dayTripId)).get();
  if (!dayTrip) return c.json({ error: 'Day trip not found' }, 404);

  const leg = await verifyLegAccess(db, dayTrip.leg_id, trip.id);
  if (!leg) return c.json({ error: 'Access denied' }, 403);

  await db.delete(dayTrips).where(eq(dayTrips.id, dayTripId));
  return c.json({ ok: true });
});

export default dayTripRoutes;
