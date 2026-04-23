import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  avatar_url: text('avatar_url'),
  google_id: text('google_id').notNull().unique(),
  created_at: text('created_at').notNull(),
});

export const trips = sqliteTable('trips', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  start_date: text('start_date'),
  end_date: text('end_date'),
  status: text('status', { enum: ['planning', 'active', 'completed'] }).notNull().default('planning'),
  owner_id: text('owner_id').notNull().references(() => users.id),
  is_active: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});

export const tripOffsets = sqliteTable('trip_offsets', {
  id: text('id').primaryKey(),
  trip_id: text('trip_id').notNull().references(() => trips.id),
  amount: real('amount').notNull(),
  description: text('description').notNull(),
});

export const routes = sqliteTable('routes', {
  id: text('id').primaryKey(),
  trip_id: text('trip_id').notNull().references(() => trips.id),
  name: text('name').notNull(),
  status: text('status', { enum: ['draft', 'winner', 'rejected'] }).notNull().default('draft'),
  order: integer('order').notNull().default(0),
});

export const legs = sqliteTable('legs', {
  id: text('id').primaryKey(),
  route_id: text('route_id').notNull().references(() => routes.id, { onDelete: 'cascade' }),
  type: text('type', { enum: ['location', 'travel'] }).notNull(),
  order: integer('order').notNull(),
  name: text('name'),
  start_date: text('start_date'),
  end_date: text('end_date'),
  nights: integer('nights'),
  transport_type: text('transport_type', { enum: ['flight', 'train', 'ferry', 'car', 'bus'] }),
  cost: real('cost'),
  duration: text('duration'),
  stops: integer('stops'),
  company: text('company'),
  booking_id: text('booking_id'),
  booking_link: text('booking_link'),
  departure_time: text('departure_time'),
  arrival_time: text('arrival_time'),
  departure_location: text('departure_location'),
  arrival_location: text('arrival_location'),
  notes: text('notes'),
});

export const accommodations = sqliteTable('accommodations', {
  id: text('id').primaryKey(),
  leg_id: text('leg_id').notNull().references(() => legs.id, { onDelete: 'cascade' }).unique(),
  name: text('name'),
  address: text('address'),
  lat: real('lat'),
  lng: real('lng'),
  place_id: text('place_id'),
  cost_per_night: real('cost_per_night'),
  total_cost: real('total_cost'),
  check_in_time: text('check_in_time'),
  check_out_time: text('check_out_time'),
  amenities: text('amenities', { mode: 'json' }).$type<string[]>().notNull().default([]),
  booking_link: text('booking_link'),
  notes: text('notes'),
});

export const dayTrips = sqliteTable('day_trips', {
  id: text('id').primaryKey(),
  leg_id: text('leg_id').notNull().references(() => legs.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  destination_name: text('destination_name').notNull(),
  status: text('status', { enum: ['confirmed', 'idea'] }).notNull().default('idea'),
  transport_type: text('transport_type', { enum: ['flight', 'train', 'ferry', 'car', 'bus'] }),
  cost: real('cost'),
  notes: text('notes'),
});

export const activities = sqliteTable('activities', {
  id: text('id').primaryKey(),
  leg_id: text('leg_id').notNull().references(() => legs.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  name: text('name').notNull(),
  time: text('time'),
  booking_id: text('booking_id'),
  booking_link: text('booking_link'),
  notes: text('notes'),
});

export const carRentals = sqliteTable('car_rentals', {
  id: text('id').primaryKey(),
  leg_id: text('leg_id').notNull().references(() => legs.id, { onDelete: 'cascade' }),
  company: text('company'),
  cost: real('cost'),
  pickup_date: text('pickup_date'),
  return_date: text('return_date'),
  notes: text('notes'),
});

export const tripShares = sqliteTable('trip_shares', {
  id: text('id').primaryKey(),
  trip_id: text('trip_id').notNull().references(() => trips.id),
  user_id: text('user_id').notNull().references(() => users.id),
  role: text('role', { enum: ['viewer', 'editor'] }).notNull(),
});
