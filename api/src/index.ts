import { Hono } from 'hono';
import { ZodError } from 'zod';
import type { Env } from './env';
import { corsMiddleware } from './middleware/cors';
import { dbMiddleware } from './middleware/db';
import { authMiddleware } from './middleware/auth';
import authRoutes from './routes/auth';
import tripRoutes from './routes/trips';

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
app.route('/api/trips', tripRoutes);

// SPA fallback — MUST be last
app.all('*', (c) => {
  if (c.env.ASSETS) return c.env.ASSETS.fetch(c.req.raw);
  return c.json({ error: 'Not found' }, 404);
});

export default app;
