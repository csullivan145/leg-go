import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { routes, legs, accommodations, dayTrips, carRentals, tripOffsets } from '../db/schema';
import { requireTripAccess } from '../middleware/trip-access';
import type { Env } from '../env';
import type { AppDb } from '../middleware/db';
import type { AuthUser } from '../middleware/auth';
import type { TripRole } from '@leg-go/shared';
import type { trips } from '../db/schema';

function parseDurationToMinutes(duration: string | null): number {
  if (!duration) return 0;
  let total = 0;
  const hours = duration.match(/(\d+)\s*h/i);
  const mins = duration.match(/(\d+)\s*m/i);
  if (hours) total += parseInt(hours[1], 10) * 60;
  if (mins) total += parseInt(mins[1], 10);
  return total;
}

const compareRoutes = new Hono<{
  Bindings: Env;
  Variables: { db: AppDb; user: AuthUser; trip: typeof trips.$inferSelect; tripRole: TripRole };
}>();

// GET /:id/compare — compare all routes (viewer+)
compareRoutes.get('/:id/compare', requireTripAccess('viewer'), async (c) => {
  const db = c.get('db');
  const trip = c.get('trip');

  const routeList = await db.select().from(routes)
    .where(eq(routes.trip_id, trip.id));

  // Get total offset for the trip
  const offsets = await db.select().from(tripOffsets)
    .where(eq(tripOffsets.trip_id, trip.id));
  const totalOffset = offsets.reduce((sum, o) => sum + o.amount, 0);

  const comparison = await Promise.all(
    routeList.map(async (route) => {
      const legList = await db.select().from(legs)
        .where(eq(legs.route_id, route.id));
      legList.sort((a, b) => a.order - b.order);

      const travelLegs = legList.filter((l) => l.type === 'travel');
      const locationLegs = legList.filter((l) => l.type === 'location');

      // First and last travel legs are "flights from home"
      const firstTravel = travelLegs.length > 0 ? travelLegs[0] : null;
      const lastTravel = travelLegs.length > 1 ? travelLegs[travelLegs.length - 1] : null;
      const homeFlights = [firstTravel, lastTravel].filter(Boolean) as typeof travelLegs;
      const homeFlightIds = new Set(homeFlights.map((l) => l.id));
      const flightCost = homeFlights.reduce((sum, l) => sum + (l.cost ?? 0), 0);
      const flightCount = homeFlights.length;

      // Everything else is in-region transport
      const inRegionLegs = travelLegs.filter((l) => !homeFlightIds.has(l.id));

      // Ferry legs (in-region only)
      const ferryLegs = inRegionLegs.filter((l) => l.transport_type === 'ferry');
      const ferryCost = ferryLegs.reduce((sum, l) => sum + (l.cost ?? 0), 0);
      const ferryCount = ferryLegs.length;

      // Train legs (in-region only)
      const trainLegs = inRegionLegs.filter((l) => l.transport_type === 'train');
      const trainCost = trainLegs.reduce((sum, l) => sum + (l.cost ?? 0), 0);
      const trainCount = trainLegs.length;

      // Other in-region transport (flights between locations, car, bus, etc.)
      const otherTransportLegs = inRegionLegs.filter(
        (l) => !['ferry', 'train'].includes(l.transport_type ?? ''),
      );
      const otherTransportCost = otherTransportLegs.reduce((sum, l) => sum + (l.cost ?? 0), 0);

      // Accommodation, car rentals, day trips
      let accommodationCost = 0;
      let carRentalCost = 0;
      let dayTripCost = 0;

      for (const locationLeg of locationLegs) {
        const [accomList, carList, dayTripList] = await Promise.all([
          db.select().from(accommodations).where(eq(accommodations.leg_id, locationLeg.id)),
          db.select().from(carRentals).where(eq(carRentals.leg_id, locationLeg.id)),
          db.select().from(dayTrips).where(eq(dayTrips.leg_id, locationLeg.id)),
        ]);

        // Compute nights from dates if not stored
        let nights = locationLeg.nights ?? 0;
        if (nights <= 0 && locationLeg.start_date && locationLeg.end_date) {
          const start = new Date(locationLeg.start_date);
          const end = new Date(locationLeg.end_date);
          const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
          if (diff > 0) nights = diff;
        }

        accommodationCost += accomList.reduce((sum, a) => {
          if (a.total_cost != null) return sum + a.total_cost;
          if (a.cost_per_night != null && nights > 0) return sum + a.cost_per_night * nights;
          return sum;
        }, 0);
        carRentalCost += carList.reduce((sum, cr) => sum + (cr.cost ?? 0), 0);
        dayTripCost += dayTripList.reduce((sum, dt) => sum + (dt.cost ?? 0), 0);
      }

      const tripTotal = flightCost + ferryCost + trainCost + otherTransportCost + accommodationCost + carRentalCost + dayTripCost;

      return {
        route: { id: route.id, name: route.name, status: route.status, order: route.order },
        costs: {
          flights: flightCost,
          ferries: ferryCost,
          trains: trainCost,
          otherTransport: otherTransportCost,
          accommodation: accommodationCost,
          carRental: carRentalCost,
          activities: dayTripCost,
          total: tripTotal,
        },
        convenience: {
          flightCount,
          ferryCount,
          trainCount,
          totalTransportLegs: travelLegs.length,
          totalTravelMinutes: travelLegs.reduce((sum, l) => sum + parseDurationToMinutes(l.duration), 0),
          locationCount: locationLegs.length,
        },
      };
    }),
  );

  // Sort by route order
  comparison.sort((a, b) => a.route.order - b.route.order);

  return c.json({ comparison, totalOffset });
});

export default compareRoutes;
