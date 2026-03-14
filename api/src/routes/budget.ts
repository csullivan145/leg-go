import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { routes, legs, accommodations, dayTrips, activities, carRentals, tripOffsets } from '../db/schema';
import { requireTripAccess } from '../middleware/trip-access';
import type { Env } from '../env';
import type { AppDb } from '../middleware/db';
import type { AuthUser } from '../middleware/auth';
import type { TripRole } from '@leg-go/shared';
import type { trips } from '../db/schema';

const budgetRoutes = new Hono<{
  Bindings: Env;
  Variables: { db: AppDb; user: AuthUser; trip: typeof trips.$inferSelect; tripRole: TripRole };
}>();

// GET /:id/budget — calculated budget from winner route (viewer+)
budgetRoutes.get('/:id/budget', requireTripAccess('viewer'), async (c) => {
  const db = c.get('db');
  const trip = c.get('trip');

  // Get the winner route, or fall back to the first route
  const routeList = await db.select().from(routes)
    .where(eq(routes.trip_id, trip.id));

  if (routeList.length === 0) {
    return c.json({
      budget: {
        tripTotal: 0,
        offset: 0,
        outOfPocket: 0,
        byCategory: { flights: 0, inRegionTransport: 0, accommodation: 0, carRental: 0, activities: 0 },
        byLocation: [],
      },
    });
  }

  const winnerRoute = routeList.find((r) => r.status === 'winner') ?? routeList[0];

  // Get all legs for this route ordered
  const legList = await db.select().from(legs)
    .where(eq(legs.route_id, winnerRoute.id));
  legList.sort((a, b) => a.order - b.order);

  // Get all offsets
  const offsets = await db.select().from(tripOffsets)
    .where(eq(tripOffsets.trip_id, trip.id));
  const totalOffset = offsets.reduce((sum, o) => sum + o.amount, 0);

  // Categorize travel legs
  const travelLegs = legList.filter((l) => l.type === 'travel');
  const locationLegs = legList.filter((l) => l.type === 'location');

  // Flights = first and last travel leg (if flight type), otherwise all flight transport
  const flightLegs = travelLegs.filter((l) => l.transport_type === 'flight');
  const flightCost = flightLegs.reduce((sum, l) => sum + (l.cost ?? 0), 0);

  // In-region transport = non-flight travel legs
  const inRegionLegs = travelLegs.filter((l) => l.transport_type !== 'flight');
  const inRegionCost = inRegionLegs.reduce((sum, l) => sum + (l.cost ?? 0), 0);

  // Get sub-resources for all location legs
  const locationLegIds = locationLegs.map((l) => l.id);

  let accommodationTotal = 0;
  let carRentalTotal = 0;
  let activitiesTotal = 0;
  const byLocation: Array<{
    legId: string;
    name: string | null;
    accommodation: number;
    carRental: number;
    activities: number;
    dayTrips: number;
    total: number;
  }> = [];

  for (const locationLeg of locationLegs) {
    const [accomList, carList, dayTripList] = await Promise.all([
      db.select().from(accommodations).where(eq(accommodations.leg_id, locationLeg.id)),
      db.select().from(carRentals).where(eq(carRentals.leg_id, locationLeg.id)),
      db.select().from(dayTrips).where(eq(dayTrips.leg_id, locationLeg.id)),
    ]);

    const accomCost = accomList.reduce((sum, a) => sum + (a.total_cost ?? 0), 0);
    const carCost = carList.reduce((sum, cr) => sum + (cr.cost ?? 0), 0);
    const dayTripCost = dayTripList.reduce((sum, dt) => sum + (dt.cost ?? 0), 0);

    accommodationTotal += accomCost;
    carRentalTotal += carCost;
    activitiesTotal += dayTripCost;

    byLocation.push({
      legId: locationLeg.id,
      name: locationLeg.name,
      accommodation: accomCost,
      carRental: carCost,
      activities: 0, // activities table doesn't have cost, only dayTrips do
      dayTrips: dayTripCost,
      total: accomCost + carCost + dayTripCost,
    });
  }

  const tripTotal = flightCost + inRegionCost + accommodationTotal + carRentalTotal + activitiesTotal;
  const outOfPocket = Math.max(0, tripTotal - totalOffset);

  return c.json({
    budget: {
      tripTotal,
      offset: totalOffset,
      outOfPocket,
      byCategory: {
        flights: flightCost,
        inRegionTransport: inRegionCost,
        accommodation: accommodationTotal,
        carRental: carRentalTotal,
        activities: activitiesTotal,
      },
      byLocation,
      route: { id: winnerRoute.id, name: winnerRoute.name, status: winnerRoute.status },
    },
  });
});

export default budgetRoutes;
