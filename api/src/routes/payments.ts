import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { legPayments, legs, routes } from '../db/schema';
import { createLegPaymentSchema } from '@leg-go/shared';
import { generateId, now } from '../lib/utils';
import { requireTripAccess } from '../middleware/trip-access';
import type { Env } from '../env';
import type { AppDb } from '../middleware/db';
import type { AuthUser } from '../middleware/auth';
import type { TripRole } from '@leg-go/shared';
import type { trips } from '../db/schema';

const paymentRoutes = new Hono<{
  Bindings: Env;
  Variables: { db: AppDb; user: AuthUser; trip: typeof trips.$inferSelect; tripRole: TripRole };
}>();

// POST /legs/:legId/payments — add a payment (editor+)
paymentRoutes.post('/legs/:legId/payments', requireTripAccess('editor'), async (c) => {
  const db = c.get('db');
  const trip = c.get('trip');
  const { legId } = c.req.param();
  const body = createLegPaymentSchema.parse(await c.req.json());

  const leg = await db.select().from(legs).where(eq(legs.id, legId)).get();
  if (!leg) return c.json({ error: 'Leg not found' }, 404);

  const route = await db.select().from(routes)
    .where(and(eq(routes.id, leg.route_id), eq(routes.trip_id, trip.id)))
    .get();
  if (!route) return c.json({ error: 'Access denied' }, 403);

  const payment = {
    id: generateId(),
    leg_id: legId,
    amount: body.amount,
    date: body.date,
    note: body.note ?? null,
    created_at: now(),
  };
  await db.insert(legPayments).values(payment);
  return c.json({ payment }, 201);
});

// DELETE /payments/:paymentId — delete a payment (editor+)
paymentRoutes.delete('/payments/:paymentId', requireTripAccess('editor'), async (c) => {
  const db = c.get('db');
  const trip = c.get('trip');
  const { paymentId } = c.req.param();

  const payment = await db.select().from(legPayments).where(eq(legPayments.id, paymentId)).get();
  if (!payment) return c.json({ error: 'Payment not found' }, 404);

  const leg = await db.select().from(legs).where(eq(legs.id, payment.leg_id)).get();
  if (!leg) return c.json({ error: 'Leg not found' }, 404);

  const route = await db.select().from(routes)
    .where(and(eq(routes.id, leg.route_id), eq(routes.trip_id, trip.id)))
    .get();
  if (!route) return c.json({ error: 'Access denied' }, 403);

  await db.delete(legPayments).where(eq(legPayments.id, paymentId));
  return c.json({ ok: true });
});

export default paymentRoutes;
