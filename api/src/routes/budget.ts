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
        routes: [],
      },
    });
  }

  // Use selected route, winner, or first route
  const selectedRouteId = c.req.query('routeId');
  const winnerRoute = (selectedRouteId ? routeList.find((r) => r.id === selectedRouteId) : null)
    ?? routeList.find((r) => r.status === 'winner')
    ?? routeList[0];

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

  // First and last travel legs are "flights from home"
  const firstTravel = travelLegs.length > 0 ? travelLegs[0] : null;
  const lastTravel = travelLegs.length > 1 ? travelLegs[travelLegs.length - 1] : null;
  const homeFlights = [firstTravel, lastTravel].filter(Boolean) as typeof travelLegs;
  const homeFlightIds = new Set(homeFlights.map((l) => l.id));
  const flightCost = homeFlights.reduce((sum, l) => sum + (l.cost ?? 0), 0);

  // Everything else is in-region transport
  const inRegionLegs = travelLegs.filter((l) => !homeFlightIds.has(l.id));
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

    let nights = locationLeg.nights ?? 0;
    if (nights <= 0 && locationLeg.start_date && locationLeg.end_date) {
      const start = new Date(locationLeg.start_date);
      const end = new Date(locationLeg.end_date);
      const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      if (diff > 0) nights = diff;
    }

    const accomCost = accomList.reduce((sum, a) => {
      if (a.total_cost != null) return sum + a.total_cost;
      if (a.cost_per_night != null && nights > 0) return sum + a.cost_per_night * nights;
      return sum;
    }, 0);
    const carCost = carList.reduce((sum, cr) => sum + (cr.cost ?? 0), 0);
    const dayTripCost = dayTripList.reduce((sum, dt) => sum + (dt.cost ?? 0), 0);

    accommodationTotal += accomCost;
    carRentalTotal += carCost;
    activitiesTotal += dayTripCost;

    byLocation.push({
      legId: locationLeg.id,
      name: locationLeg.name,
      nights,
      accommodation: accomCost,
      carRental: carCost,
      activities: 0,
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
      routes: routeList.map((r) => ({ id: r.id, name: r.name, status: r.status })),
    },
  });
});

export default budgetRoutes;
