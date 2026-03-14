import { relations } from 'drizzle-orm';
import {
  users, trips, tripOffsets, routes, legs,
  accommodations, dayTrips, activities, carRentals, tripShares,
} from './schema';

export const usersRelations = relations(users, ({ many }) => ({
  trips: many(trips),
  tripShares: many(tripShares),
}));

export const tripsRelations = relations(trips, ({ one, many }) => ({
  owner: one(users, { fields: [trips.owner_id], references: [users.id] }),
  routes: many(routes),
  offsets: many(tripOffsets),
  shares: many(tripShares),
}));

export const tripOffsetsRelations = relations(tripOffsets, ({ one }) => ({
  trip: one(trips, { fields: [tripOffsets.trip_id], references: [trips.id] }),
}));

export const routesRelations = relations(routes, ({ one, many }) => ({
  trip: one(trips, { fields: [routes.trip_id], references: [trips.id] }),
  legs: many(legs),
}));

export const legsRelations = relations(legs, ({ one, many }) => ({
  route: one(routes, { fields: [legs.route_id], references: [routes.id] }),
  accommodation: one(accommodations),
  dayTrips: many(dayTrips),
  activities: many(activities),
  carRentals: many(carRentals),
}));

export const accommodationsRelations = relations(accommodations, ({ one }) => ({
  leg: one(legs, { fields: [accommodations.leg_id], references: [legs.id] }),
}));

export const dayTripsRelations = relations(dayTrips, ({ one }) => ({
  leg: one(legs, { fields: [dayTrips.leg_id], references: [legs.id] }),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  leg: one(legs, { fields: [activities.leg_id], references: [legs.id] }),
}));

export const carRentalsRelations = relations(carRentals, ({ one }) => ({
  leg: one(legs, { fields: [carRentals.leg_id], references: [legs.id] }),
}));

export const tripSharesRelations = relations(tripShares, ({ one }) => ({
  trip: one(trips, { fields: [tripShares.trip_id], references: [trips.id] }),
  user: one(users, { fields: [tripShares.user_id], references: [users.id] }),
}));
