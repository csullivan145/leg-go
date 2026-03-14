import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { tripOffsets } from '../db/schema';
import { createOffsetSchema, updateOffsetSchema } from '@leg-go/shared';
import { generateId } from '../lib/utils';
import { requireTripAccess } from '../middleware/trip-access';
import type { Env } from '../env';
import type { AppDb } from '../middleware/db';
import type { AuthUser } from '../middleware/auth';
import type { TripRole } from '@leg-go/shared';
import type { trips } from '../db/schema';

const offsetRoutes = new Hono<{
  Bindings: Env;
  Variables: { db: AppDb; user: AuthUser; trip: typeof trips.$inferSelect; tripRole: TripRole };
}>();

// GET /:id/offsets — list offsets (viewer+)
offsetRoutes.get('/:id/offsets', requireTripAccess('viewer'), async (c) => {
  const db = c.get('db');
  const trip = c.get('trip');

  const offsets = await db.select().from(tripOffsets)
    .where(eq(tripOffsets.trip_id, trip.id));

  return c.json({ offsets });
});

// POST /:id/offsets — create offset (editor+)
offsetRoutes.post('/:id/offsets', requireTripAccess('editor'), async (c) => {
  const db = c.get('db');
  const trip = c.get('trip');
  const body = createOffsetSchema.parse(await c.req.json());

  const offset = {
    id: generateId(),
    trip_id: trip.id,
    amount: body.amount,
    description: body.description,
  };

  await db.insert(tripOffsets).values(offset);
  return c.json({ offset }, 201);
});

// PATCH /offsets/:offsetId — update offset (editor+)
offsetRoutes.patch('/offsets/:offsetId', requireTripAccess('editor'), async (c) => {
  const db = c.get('db');
  const trip = c.get('trip');
  const { offsetId } = c.req.param();
  const body = updateOffsetSchema.parse(await c.req.json());

  const offset = await db.select().from(tripOffsets)
    .where(eq(tripOffsets.id, offsetId))
    .get();
  if (!offset) return c.json({ error: 'Offset not found' }, 404);
  if (offset.trip_id !== trip.id) return c.json({ error: 'Access denied' }, 403);

  await db.update(tripOffsets).set(body).where(eq(tripOffsets.id, offsetId));
  const updated = await db.select().from(tripOffsets).where(eq(tripOffsets.id, offsetId)).get();
  return c.json({ offset: updated });
});

// DELETE /offsets/:offsetId — delete offset (editor+)
offsetRoutes.delete('/offsets/:offsetId', requireTripAccess('editor'), async (c) => {
  const db = c.get('db');
  const trip = c.get('trip');
  const { offsetId } = c.req.param();

  const offset = await db.select().from(tripOffsets)
    .where(eq(tripOffsets.id, offsetId))
    .get();
  if (!offset) return c.json({ error: 'Offset not found' }, 404);
  if (offset.trip_id !== trip.id) return c.json({ error: 'Access denied' }, 403);

  await db.delete(tripOffsets).where(eq(tripOffsets.id, offsetId));
  return c.json({ ok: true });
});

export default offsetRoutes;
