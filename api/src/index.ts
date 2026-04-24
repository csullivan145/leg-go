import { Hono } from 'hono';
import { ZodError } from 'zod';
import type { Env } from './env';
import { corsMiddleware } from './middleware/cors';
import { dbMiddleware } from './middleware/db';
import { authMiddleware } from './middleware/auth';
import authRoutes from './routes/auth';
import tripRoutes from './routes/trips';
import routeRoutes from './routes/routes';
import legRoutes from './routes/legs';
import accommodationRoutes from './routes/accommodation';
import dayTripRoutes from './routes/day-trips';
import activityRoutes from './routes/activities';
import carRentalRoutes from './routes/car-rentals';
import offsetRoutes from './routes/offsets';
import shareRoutes from './routes/shares';
import budgetRoutes from './routes/budget';
import calendarRoutes from './routes/calendar';
import compareRoutes from './routes/compare';
import parseRoutes from './routes/parse';
import paymentRoutes from './routes/payments';

const app = new Hono<{ Bindings: Env }>();

// Global middleware
app.use('*', corsMiddleware);
app.use('*', dbMiddleware);

// Global error handler for Zod validation errors
app.onError((err, c) => {
  if (err instanceof ZodError) {
    return c.json({ error: 'Validation failed', details: err.errors }, 400);
  }
  console.error(err);
  return c.json({ error: 'Internal server error' }, 500);
});

// Public routes
app.route('/auth', authRoutes);

// Protected routes
app.use('/api/*', authMiddleware);

// Client-exposable config (API keys safe for browser use, e.g. referrer-restricted)
app.get('/api/config', (c) => c.json({ googleMapsApiKey: c.env.GOOGLE_MAPS_API_KEY ?? null }));

// LLM-powered booking extraction
app.route('/api', parseRoutes);

// Payments (deposits / installments) attached to legs
app.route('/api', paymentRoutes);

app.route('/api/trips', tripRoutes);

// Route CRUD (nested under trips)
app.route('/api/trips/:id/routes', routeRoutes);

// Leg CRUD + reorder
app.route('/api', legRoutes);

// Sub-resources
app.route('/api', accommodationRoutes);
app.route('/api', dayTripRoutes);
app.route('/api', activityRoutes);
app.route('/api', carRentalRoutes);

// Offsets — nested GET/POST + flat PATCH/DELETE
app.route('/api/trips', offsetRoutes);
app.route('/api', offsetRoutes);

// Shares — nested GET/POST + flat PATCH/DELETE
app.route('/api/trips', shareRoutes);
app.route('/api', shareRoutes);

// Computed endpoints
app.route('/api/trips', budgetRoutes);
app.route('/api/trips', calendarRoutes);
app.route('/api/trips', compareRoutes);

// SPA fallback — MUST be last
app.all('*', (c) => {
  if (c.env.ASSETS) return c.env.ASSETS.fetch(c.req.raw);
  return c.json({ error: 'Not found' }, 404);
});

export default app;
