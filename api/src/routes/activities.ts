import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { activities, legs, routes } from '../db/schema';
import { createActivitySchema, updateActivitySchema } from '@leg-go/shared';
import { generateId } from '../lib/utils';
import { requireTripAccess } from '../middleware/trip-access';
import type { Env } from '../env';
import type { AppDb } from '../middleware/db';
import type { AuthUser } from '../middleware/auth';
import type { TripRole } from '@leg-go/shared';
import type { trips } from '../db/schema';

const activityRoutes = new Hono<{
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

// GET /legs/:legId/activities — list activities (viewer+)
activityRoutes.get('/legs/:legId/activities', requireTripAccess('viewer'), async (c) => {
  const db = c.get('db');
  const trip = c.get('trip');
  const { legId } = c.req.param();

  const leg = await verifyLegAccess(db, legId, trip.id);
  if (!leg) return c.json({ error: 'Leg not found' }, 404);

  const activityList = await db.select().from(activities).where(eq(activities.leg_id, legId));
  return c.json({ activities: activityList });
});

// POST /legs/:legId/activities — create activity (editor+)
activityRoutes.post('/legs/:legId/activities', requireTripAccess('editor'), async (c) => {
  const db = c.get('db');
  const trip = c.get('trip');
  const { legId } = c.req.param();
  const body = createActivitySchema.parse(await c.req.json());

  const leg = await verifyLegAccess(db, legId, trip.id);
  if (!leg) return c.json({ error: 'Leg not found' }, 404);
  if (leg.type !== 'location') return c.json({ error: 'Leg must be of type location' }, 400);

  const activity = {
    id: generateId(),
    leg_id: legId,
    date: body.date,
    name: body.name,
    time: body.time ?? null,
    booking_id: body.booking_id ?? null,
    booking_link: body.booking_link ?? null,
    notes: body.notes ?? null,
  };

  await db.insert(activities).values(activity);
  return c.json({ activity }, 201);
});

// PATCH /activities/:activityId — update activity (editor+)
activityRoutes.patch('/activities/:activityId', requireTripAccess('editor'), async (c) => {
  const db = c.get('db');
  const trip = c.get('trip');
  const { activityId } = c.req.param();
  const body = updateActivitySchema.parse(await c.req.json());

  const activity = await db.select().from(activities).where(eq(activities.id, activityId)).get();
  if (!activity) return c.json({ error: 'Activity not found' }, 404);

  const leg = await verifyLegAccess(db, activity.leg_id, trip.id);
  if (!leg) return c.json({ error: 'Access denied' }, 403);

  await db.update(activities).set(body).where(eq(activities.id, activityId));
  const updated = await db.select().from(activities).where(eq(activities.id, activityId)).get();
  return c.json({ activity: updated });
});

// DELETE /activities/:activityId — delete activity (editor+)
activityRoutes.delete('/activities/:activityId', requireTripAccess('editor'), async (c) => {
  const db = c.get('db');
  const trip = c.get('trip');
  const { activityId } = c.req.param();

  const activity = await db.select().from(activities).where(eq(activities.id, activityId)).get();
  if (!activity) return c.json({ error: 'Activity not found' }, 404);

  const leg = await verifyLegAccess(db, activity.leg_id, trip.id);
  if (!leg) return c.json({ error: 'Access denied' }, 403);

  await db.delete(activities).where(eq(activities.id, activityId));
  return c.json({ ok: true });
});

export default activityRoutes;
