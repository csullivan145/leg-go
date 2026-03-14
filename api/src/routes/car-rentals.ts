import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { carRentals, legs, routes } from '../db/schema';
import { createCarRentalSchema, updateCarRentalSchema } from '@leg-go/shared';
import { generateId } from '../lib/utils';
import { requireTripAccess } from '../middleware/trip-access';
import type { Env } from '../env';
import type { AppDb } from '../middleware/db';
import type { AuthUser } from '../middleware/auth';
import type { TripRole } from '@leg-go/shared';
import type { trips } from '../db/schema';

const carRentalRoutes = new Hono<{
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

// POST /legs/:legId/carrental — create car rental (editor+)
carRentalRoutes.post('/legs/:legId/carrental', requireTripAccess('editor'), async (c) => {
  const db = c.get('db');
  const trip = c.get('trip');
  const { legId } = c.req.param();
  const body = createCarRentalSchema.parse(await c.req.json());

  const leg = await verifyLegAccess(db, legId, trip.id);
  if (!leg) return c.json({ error: 'Leg not found' }, 404);
  if (leg.type !== 'location') return c.json({ error: 'Leg must be of type location' }, 400);

  const carRental = {
    id: generateId(),
    leg_id: legId,
    company: body.company ?? null,
    cost: body.cost ?? null,
    pickup_date: body.pickup_date ?? null,
    return_date: body.return_date ?? null,
    notes: body.notes ?? null,
  };

  await db.insert(carRentals).values(carRental);
  return c.json({ carRental }, 201);
});

// PATCH /carrental/:carRentalId — update car rental (editor+)
carRentalRoutes.patch('/carrental/:carRentalId', requireTripAccess('editor'), async (c) => {
  const db = c.get('db');
  const trip = c.get('trip');
  const { carRentalId } = c.req.param();
  const body = updateCarRentalSchema.parse(await c.req.json());

  const carRental = await db.select().from(carRentals)
    .where(eq(carRentals.id, carRentalId))
    .get();
  if (!carRental) return c.json({ error: 'Car rental not found' }, 404);

  const leg = await verifyLegAccess(db, carRental.leg_id, trip.id);
  if (!leg) return c.json({ error: 'Access denied' }, 403);

  await db.update(carRentals).set(body).where(eq(carRentals.id, carRentalId));
  const updated = await db.select().from(carRentals).where(eq(carRentals.id, carRentalId)).get();
  return c.json({ carRental: updated });
});

// DELETE /carrental/:carRentalId — delete car rental (editor+)
carRentalRoutes.delete('/carrental/:carRentalId', requireTripAccess('editor'), async (c) => {
  const db = c.get('db');
  const trip = c.get('trip');
  const { carRentalId } = c.req.param();

  const carRental = await db.select().from(carRentals)
    .where(eq(carRentals.id, carRentalId))
    .get();
  if (!carRental) return c.json({ error: 'Car rental not found' }, 404);

  const leg = await verifyLegAccess(db, carRental.leg_id, trip.id);
  if (!leg) return c.json({ error: 'Access denied' }, 403);

  await db.delete(carRentals).where(eq(carRentals.id, carRentalId));
  return c.json({ ok: true });
});

export default carRentalRoutes;
