import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { routes, legs, accommodations, dayTrips, activities, carRentals } from '../db/schema';
import { createRouteSchema, updateRouteSchema } from '@leg-go/shared';
import { generateId } from '../lib/utils';
import { requireTripAccess } from '../middleware/trip-access';
import type { Env } from '../env';
import type { AppDb } from '../middleware/db';
import type { AuthUser } from '../middleware/auth';
import type { TripRole } from '@leg-go/shared';
import type { trips } from '../db/schema';

const routeRoutes = new Hono<{
  Bindings: Env;
  Variables: { db: AppDb; user: AuthUser; trip: typeof trips.$inferSelect; tripRole: TripRole };
}>();

// All routes require at least viewer access
routeRoutes.use('*', requireTripAccess('viewer'));

// List routes with legs (viewer+)
routeRoutes.get('/', async (c) => {
  const db = c.get('db');
  const trip = c.get('trip');

  const routeList = await db.select().from(routes).where(eq(routes.trip_id, trip.id));

  const routesWithLegs = await Promise.all(
    routeList.map(async (route) => {
      const legList = await db.select().from(legs).where(eq(legs.route_id, route.id));
      return { ...route, legs: legList };
    }),
  );

  return c.json({ routes: routesWithLegs });
});

// Create route (editor+)
routeRoutes.post('/', requireTripAccess('editor'), async (c) => {
  const db = c.get('db');
  const trip = c.get('trip');
  const body = createRouteSchema.parse(await c.req.json());

  const existingRoutes = await db.select().from(routes).where(eq(routes.trip_id, trip.id));
  const maxOrder = existingRoutes.reduce((max, r) => Math.max(max, r.order), -1);

  const route = {
    id: generateId(),
    trip_id: trip.id,
    name: body.name,
    status: 'draft' as const,
    order: maxOrder + 1,
  };

  await db.insert(routes).values(route);
  return c.json({ route }, 201);
});

// Get route with legs (viewer+)
routeRoutes.get('/:routeId', async (c) => {
  const db = c.get('db');
  const trip = c.get('trip');
  const { routeId } = c.req.param();

  const route = await db.select().from(routes)
    .where(and(eq(routes.id, routeId), eq(routes.trip_id, trip.id)))
    .get();

  if (!route) return c.json({ error: 'Route not found' }, 404);

  const legList = await db.select().from(legs).where(eq(legs.route_id, route.id));
  legList.sort((a, b) => a.order - b.order);

  const legsWithDetails = await Promise.all(
    legList.map(async (leg) => {
      if (leg.type !== 'location') return leg;
      const [accom, dayTripList, activityList, carRentalList] = await Promise.all([
        db.select().from(accommodations).where(eq(accommodations.leg_id, leg.id)).get(),
        db.select().from(dayTrips).where(eq(dayTrips.leg_id, leg.id)),
        db.select().from(activities).where(eq(activities.leg_id, leg.id)),
        db.select().from(carRentals).where(eq(carRentals.leg_id, leg.id)),
      ]);
      return {
        ...leg,
        accommodation: accom ?? null,
        day_trips: dayTripList,
        activities: activityList,
        car_rentals: carRentalList,
      };
    }),
  );

  return c.json({ route: { ...route, legs: legsWithDetails } });
});

// Update route, handle winner promotion (editor+)
routeRoutes.patch('/:routeId', requireTripAccess('editor'), async (c) => {
  const db = c.get('db');
  const trip = c.get('trip');
  const { routeId } = c.req.param();
  const body = updateRouteSchema.parse(await c.req.json());

  const route = await db.select().from(routes)
    .where(and(eq(routes.id, routeId), eq(routes.trip_id, trip.id)))
    .get();

  if (!route) return c.json({ error: 'Route not found' }, 404);

  // When promoting to winner, reset any previous winner to draft
  if (body.status === 'winner') {
    await db.update(routes)
      .set({ status: 'draft' })
      .where(and(eq(routes.trip_id, trip.id), eq(routes.status, 'winner')));
  }

  await db.update(routes).set(body).where(eq(routes.id, routeId));
  const updated = await db.select().from(routes).where(eq(routes.id, routeId)).get();

  return c.json({ route: updated });
});

// Delete route (editor+)
routeRoutes.delete('/:routeId', requireTripAccess('editor'), async (c) => {
  const db = c.get('db');
  const trip = c.get('trip');
  const { routeId } = c.req.param();

  const route = await db.select().from(routes)
    .where(and(eq(routes.id, routeId), eq(routes.trip_id, trip.id)))
    .get();

  if (!route) return c.json({ error: 'Route not found' }, 404);

  await db.delete(routes).where(eq(routes.id, routeId));
  return c.json({ ok: true });
});

export default routeRoutes;
