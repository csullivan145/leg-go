import { z } from 'zod';

export const createTripSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).nullable().optional(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
});

export const updateTripSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  status: z.enum(['planning', 'active', 'completed']).optional(),
});

export const createRouteSchema = z.object({
  name: z.string().min(1).max(200),
});

export const updateRouteSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  status: z.enum(['draft', 'winner', 'rejected']).optional(),
});

const transportTypeEnum = z.enum(['flight', 'train', 'ferry', 'car', 'bus']);

export const createLegSchema = z.object({
  type: z.enum(['location', 'travel']),
  name: z.string().max(200).nullable().optional(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  transport_type: transportTypeEnum.nullable().optional(),
  cost: z.number().nullable().optional(),
  duration: z.string().max(50).nullable().optional(),
  stops: z.number().int().min(0).nullable().optional(),
  company: z.string().max(200).nullable().optional(),
  booking_id: z.string().max(100).nullable().optional(),
  booking_link: z.string().url().max(500).nullable().optional(),
  departure_time: z.string().nullable().optional(),
  arrival_time: z.string().nullable().optional(),
  departure_location: z.string().max(200).nullable().optional(),
  arrival_location: z.string().max(200).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  order: z.number().int().min(0).optional(),
});

export const updateLegSchema = createLegSchema.partial().omit({ type: true });

export const upsertAccommodationSchema = z.object({
  name: z.string().max(200).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  place_id: z.string().max(200).nullable().optional(),
  cost_per_night: z.number().nullable().optional(),
  total_cost: z.number().nullable().optional(),
  check_in_time: z.string().nullable().optional(),
  check_out_time: z.string().nullable().optional(),
  amenities: z.array(z.string()).optional().default([]),
  booking_link: z.string().url().max(500).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const createDayTripSchema = z.object({
  date: z.string(),
  destination_name: z.string().min(1).max(200),
  status: z.enum(['confirmed', 'idea']).default('idea'),
  transport_type: transportTypeEnum.nullable().optional(),
  cost: z.number().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const updateDayTripSchema = createDayTripSchema.partial();

export const createActivitySchema = z.object({
  date: z.string(),
  name: z.string().min(1).max(200),
  time: z.string().nullable().optional(),
  booking_id: z.string().max(100).nullable().optional(),
  booking_link: z.string().url().max(500).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const updateActivitySchema = createActivitySchema.partial();

export const createCarRentalSchema = z.object({
  company: z.string().max(200).nullable().optional(),
  cost: z.number().nullable().optional(),
  pickup_date: z.string().nullable().optional(),
  return_date: z.string().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const updateCarRentalSchema = createCarRentalSchema.partial();

export const createOffsetSchema = z.object({
  amount: z.number(),
  description: z.string().min(1).max(200),
});

export const updateOffsetSchema = createOffsetSchema.partial();

export const createShareSchema = z.object({
  email: z.string().email(),
  role: z.enum(['viewer', 'editor']),
});

export const updateShareSchema = z.object({
  role: z.enum(['viewer', 'editor']),
});
