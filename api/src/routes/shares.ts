import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { tripShares, users } from '../db/schema';
import { createShareSchema, updateShareSchema } from '@leg-go/shared';
import { generateId } from '../lib/utils';
import { requireTripAccess } from '../middleware/trip-access';
import type { Env } from '../env';
import type { AppDb } from '../middleware/db';
import type { AuthUser } from '../middleware/auth';
import type { TripRole } from '@leg-go/shared';
import type { trips } from '../db/schema';

const shareRoutes = new Hono<{
  Bindings: Env;
  Variables: { db: AppDb; user: AuthUser; trip: typeof trips.$inferSelect; tripRole: TripRole };
}>();

// GET /:id/shares — list shares with user info (viewer+)
shareRoutes.get('/:id/shares', requireTripAccess('viewer'), async (c) => {
  const db = c.get('db');
  const trip = c.get('trip');

  const shares = await db.select({
    id: tripShares.id,
    trip_id: tripShares.trip_id,
    user_id: tripShares.user_id,
    role: tripShares.role,
    user: {
      id: users.id,
      email: users.email,
      name: users.name,
      avatar_url: users.avatar_url,
    },
  })
    .from(tripShares)
    .innerJoin(users, eq(tripShares.user_id, users.id))
    .where(eq(tripShares.trip_id, trip.id));

  return c.json({ shares });
});

// POST /:id/shares — invite by email (owner only)
shareRoutes.post('/:id/shares', requireTripAccess('owner'), async (c) => {
  const db = c.get('db');
  const trip = c.get('trip');
  const body = createShareSchema.parse(await c.req.json());

  // Look up user by email
  const targetUser = await db.select().from(users)
    .where(eq(users.email, body.email))
    .get();
  if (!targetUser) return c.json({ error: 'User not found' }, 404);

  // Can't share with yourself
  if (targetUser.id === trip.owner_id) {
    return c.json({ error: 'Cannot share with trip owner' }, 400);
  }

  // Check not already shared
  const existing = await db.select().from(tripShares)
    .where(and(eq(tripShares.trip_id, trip.id), eq(tripShares.user_id, targetUser.id)))
    .get();
  if (existing) return c.json({ error: 'Already shared with this user' }, 409);

  const share = {
    id: generateId(),
    trip_id: trip.id,
    user_id: targetUser.id,
    role: body.role,
  };

  await db.insert(tripShares).values(share);
  return c.json({ share: { ...share, user: { id: targetUser.id, email: targetUser.email, name: targetUser.name, avatar_url: targetUser.avatar_url } } }, 201);
});

// PATCH /shares/:shareId — change role (owner only)
shareRoutes.patch('/shares/:shareId', requireTripAccess('owner'), async (c) => {
  const db = c.get('db');
  const trip = c.get('trip');
  const { shareId } = c.req.param();
  const body = updateShareSchema.parse(await c.req.json());

  const share = await db.select().from(tripShares)
    .where(eq(tripShares.id, shareId))
    .get();
  if (!share) return c.json({ error: 'Share not found' }, 404);
  if (share.trip_id !== trip.id) return c.json({ error: 'Access denied' }, 403);

  await db.update(tripShares).set({ role: body.role }).where(eq(tripShares.id, shareId));
  const updated = await db.select().from(tripShares).where(eq(tripShares.id, shareId)).get();
  return c.json({ share: updated });
});

// DELETE /shares/:shareId — remove share (owner only)
shareRoutes.delete('/shares/:shareId', requireTripAccess('owner'), async (c) => {
  const db = c.get('db');
  const trip = c.get('trip');
  const { shareId } = c.req.param();

  const share = await db.select().from(tripShares)
    .where(eq(tripShares.id, shareId))
    .get();
  if (!share) return c.json({ error: 'Share not found' }, 404);
  if (share.trip_id !== trip.id) return c.json({ error: 'Access denied' }, 403);

  await db.delete(tripShares).where(eq(tripShares.id, shareId));
  return c.json({ ok: true });
});

export default shareRoutes;
