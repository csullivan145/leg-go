import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { trips, tripShares, routes as routesTable } from '../db/schema';
import { createTripSchema, updateTripSchema } from '@leg-go/shared';
import { generateId, now } from '../lib/utils';
import { requireTripAccess } from '../middleware/trip-access';
import type { Env } from '../env';
import type { AppDb } from '../middleware/db';
import type { AuthUser } from '../middleware/auth';

const tripRoutes = new Hono<{
  Bindings: Env;
  Variables: { db: AppDb; user: AuthUser };
}>();

// List user's trips (owned + shared)
tripRoutes.get('/', async (c) => {
  const db = c.get('db');
  const user = c.get('user');

  const owned = await db.select().from(trips)
    .where(and(eq(trips.owner_id, user.id), eq(trips.is_active, true)));

  const shared = await db.select({ trip: trips, role: tripShares.role })
    .from(tripShares)
    .innerJoin(trips, eq(tripShares.trip_id, trips.id))
    .where(and(eq(tripShares.user_id, user.id), eq(trips.is_active, true)));

  const result = [
    ...owned.map((t) => ({ ...t, role: 'owner' as const })),
    ...shared.map((s) => ({ ...s.trip, role: s.role })),
  ];

  return c.json({ trips: result });
});

// Create trip
tripRoutes.post('/', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const body = createTripSchema.parse(await c.req.json());

  const trip = {
    id: generateId(),
    ...body,
    description: body.description ?? null,
    start_date: body.start_date ?? null,
    end_date: body.end_date ?? null,
    status: 'planning' as const,
    owner_id: user.id,
    is_active: true,
    created_at: now(),
    updated_at: now(),
  };
  await db.insert(trips).values(trip);

  return c.json({ trip }, 201);
});

// Get trip
tripRoutes.get('/:id', requireTripAccess('viewer'), async (c) => {
  const trip = c.get('trip');
  const db = c.get('db');
  const tripRoutesList = await db.select().from(routesTable)
    .where(eq(routesTable.trip_id, trip.id));
  return c.json({ trip, routes: tripRoutesList, role: c.get('tripRole') });
});

// Update trip
tripRoutes.patch('/:id', requireTripAccess('editor'), async (c) => {
  const db = c.get('db');
  const trip = c.get('trip');
  const body = updateTripSchema.parse(await c.req.json());
  await db.update(trips).set({ ...body, updated_at: now() }).where(eq(trips.id, trip.id));
  const updated = await db.select().from(trips).where(eq(trips.id, trip.id)).get();
  return c.json({ trip: updated });
});

// Soft delete trip (owner only)
tripRoutes.delete('/:id', requireTripAccess('owner'), async (c) => {
  const db = c.get('db');
  const trip = c.get('trip');
  await db.update(trips).set({ is_active: false, updated_at: now() }).where(eq(trips.id, trip.id));
  return c.json({ ok: true });
});

export default tripRoutes;
