import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { routes, legs, accommodations, dayTrips, activities } from '../db/schema';
import { requireTripAccess } from '../middleware/trip-access';
import type { Env } from '../env';
import type { AppDb } from '../middleware/db';
import type { AuthUser } from '../middleware/auth';
import type { TripRole } from '@leg-go/shared';
import type { trips } from '../db/schema';

const calendarRoutes = new Hono<{
  Bindings: Env;
  Variables: { db: AppDb; user: AuthUser; trip: typeof trips.$inferSelect; tripRole: TripRole };
}>();

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

function eachDay(startStr: string, endStr: string): string[] {
  const days: string[] = [];
  let current = startStr;
  while (current <= endStr) {
    days.push(current);
    current = addDays(current, 1);
  }
  return days;
}

// GET /:id/calendar — day-by-day calendar data (viewer+)
calendarRoutes.get('/:id/calendar', requireTripAccess('viewer'), async (c) => {
  const db = c.get('db');
  const trip = c.get('trip');

  // Get winner route or first route
  const routeList = await db.select().from(routes)
    .where(eq(routes.trip_id, trip.id));

  if (routeList.length === 0) {
    return c.json({ calendar: [] });
  }

  const winnerRoute = routeList.find((r) => r.status === 'winner') ?? routeList[0];

  const legList = await db.select().from(legs)
    .where(eq(legs.route_id, winnerRoute.id));
  legList.sort((a, b) => a.order - b.order);

  // Build a map of dates to calendar entries
  const calendarMap = new Map<string, {
    date: string;
    location: string | null;
    isArrival: boolean;
    isDeparture: boolean;
    travel: Array<{ type: string; transport_type: string | null; from: string | null; to: string | null; departure_time: string | null; arrival_time: string | null; company: string | null; cost: number | null }>;
    accommodation: { name: string | null; check_in_time: string | null; check_out_time: string | null } | null;
    dayTrips: Array<{ destination_name: string; status: string; transport_type: string | null; cost: number | null }>;
    activities: Array<{ name: string; time: string | null; booking_id: string | null }>;
  }>();

  const getOrCreate = (date: string, location: string | null = null) => {
    if (!calendarMap.has(date)) {
      calendarMap.set(date, {
        date,
        location,
        isArrival: false,
        isDeparture: false,
        travel: [],
        accommodation: null,
        dayTrips: [],
        activities: [],
      });
    }
    return calendarMap.get(date)!;
  };

  for (const leg of legList) {
    if (leg.type === 'travel') {
      // Travel appears on departure date (or start_date)
      const travelDate = leg.start_date ?? leg.departure_time?.split('T')[0] ?? null;
      if (travelDate) {
        const entry = getOrCreate(travelDate);
        entry.travel.push({
          type: 'travel',
          transport_type: leg.transport_type,
          from: leg.departure_location,
          to: leg.arrival_location,
          departure_time: leg.departure_time,
          arrival_time: leg.arrival_time,
          company: leg.company,
          cost: leg.cost,
        });
      }
    } else if (leg.type === 'location') {
      // Location spans from start_date to end_date
      if (!leg.start_date) continue;
      const endDate = leg.end_date ?? leg.start_date;

      const days = eachDay(leg.start_date, endDate);
      for (const day of days) {
        const entry = getOrCreate(day, leg.name);
        if (!entry.location) entry.location = leg.name;
        if (day === leg.start_date) entry.isArrival = true;
        if (day === endDate) entry.isDeparture = true;
      }

      // Get accommodation for this location leg
      const accom = await db.select().from(accommodations)
        .where(eq(accommodations.leg_id, leg.id))
        .get();

      if (accom) {
        for (const day of days) {
          const entry = getOrCreate(day, leg.name);
          if (!entry.accommodation) {
            entry.accommodation = {
              name: accom.name,
              check_in_time: accom.check_in_time,
              check_out_time: accom.check_out_time,
            };
          }
        }
      }

      // Get day trips for this location leg
      const dayTripList = await db.select().from(dayTrips)
        .where(eq(dayTrips.leg_id, leg.id));

      for (const dt of dayTripList) {
        const entry = getOrCreate(dt.date, leg.name);
        entry.dayTrips.push({
          destination_name: dt.destination_name,
          status: dt.status,
          transport_type: dt.transport_type,
          cost: dt.cost,
        });
      }

      // Get activities for this location leg
      const activityList = await db.select().from(activities)
        .where(eq(activities.leg_id, leg.id));

      for (const activity of activityList) {
        const entry = getOrCreate(activity.date, leg.name);
        entry.activities.push({
          name: activity.name,
          time: activity.time,
          booking_id: activity.booking_id,
        });
      }
    }
  }

  // Sort calendar entries by date
  const calendar = Array.from(calendarMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  return c.json({ calendar, route: { id: winnerRoute.id, name: winnerRoute.name, status: winnerRoute.status } });
});

export default calendarRoutes;
