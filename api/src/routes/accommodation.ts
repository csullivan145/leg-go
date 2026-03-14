import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { accommodations, legs, routes } from '../db/schema';
import { upsertAccommodationSchema } from '@leg-go/shared';
import { generateId } from '../lib/utils';
import { requireTripAccess } from '../middleware/trip-access';
import type { Env } from '../env';
import type { AppDb } from '../middleware/db';
import type { AuthUser } from '../middleware/auth';
import type { TripRole } from '@leg-go/shared';
import type { trips } from '../db/schema';

const accommodationRoutes = new Hono<{
  Bindings: Env;
  Variables: { db: AppDb; user: AuthUser; trip: typeof trips.$inferSelect; tripRole: TripRole };
}>();

// POST /legs/:legId/accommodation — upsert accommodation (editor+)
accommodationRoutes.post('/legs/:legId/accommodation', requireTripAccess('editor'), async (c) => {
  const db = c.get('db');
  const trip = c.get('trip');
  const { legId } = c.req.param();
  const body = upsertAccommodationSchema.parse(await c.req.json());

  // Verify leg exists and belongs to this trip
  const leg = await db.select().from(legs).where(eq(legs.id, legId)).get();
  if (!leg) return c.json({ error: 'Leg not found' }, 404);
  if (leg.type !== 'location') return c.json({ error: 'Leg must be of type location' }, 400);

  const route = await db.select().from(routes)
    .where(and(eq(routes.id, leg.route_id), eq(routes.trip_id, trip.id)))
    .get();
  if (!route) return c.json({ error: 'Access denied' }, 403);

  // Check if accommodation already exists for this leg
  const existing = await db.select().from(accommodations)
    .where(eq(accommodations.leg_id, legId))
    .get();

  if (existing) {
    // Update existing
    await db.update(accommodations).set(body).where(eq(accommodations.id, existing.id));
    const updated = await db.select().from(accommodations)
      .where(eq(accommodations.id, existing.id))
      .get();
    return c.json({ accommodation: updated });
  } else {
    // Create new
    const accommodation = {
      id: generateId(),
      leg_id: legId,
      name: body.name ?? null,
      address: body.address ?? null,
      cost_per_night: body.cost_per_night ?? null,
      total_cost: body.total_cost ?? null,
      check_in_time: body.check_in_time ?? null,
      check_out_time: body.check_out_time ?? null,
      amenities: body.amenities ?? [],
      booking_link: body.booking_link ?? null,
      notes: body.notes ?? null,
    };
    await db.insert(accommodations).values(accommodation);
    return c.json({ accommodation }, 201);
  }
});

// PATCH /accommodation/:accommodationId — update accommodation (editor+)
accommodationRoutes.patch('/accommodation/:accommodationId', requireTripAccess('editor'), async (c) => {
  const db = c.get('db');
  const trip = c.get('trip');
  const { accommodationId } = c.req.param();
  const body = upsertAccommodationSchema.partial().parse(await c.req.json());

  const accommodation = await db.select().from(accommodations)
    .where(eq(accommodations.id, accommodationId))
    .get();
  if (!accommodation) return c.json({ error: 'Accommodation not found' }, 404);

  // Verify the accommodation's leg belongs to this trip
  const leg = await db.select().from(legs).where(eq(legs.id, accommodation.leg_id)).get();
  if (!leg) return c.json({ error: 'Leg not found' }, 404);

  const route = await db.select().from(routes)
    .where(and(eq(routes.id, leg.route_id), eq(routes.trip_id, trip.id)))
    .get();
  if (!route) return c.json({ error: 'Access denied' }, 403);

  await db.update(accommodations).set(body).where(eq(accommodations.id, accommodationId));
  const updated = await db.select().from(accommodations)
    .where(eq(accommodations.id, accommodationId))
    .get();
  return c.json({ accommodation: updated });
});

export default accommodationRoutes;
