import { cors } from 'hono/cors';
import type { Env } from '../env';

export const corsMiddleware = cors({
  origin: (origin, c) => {
    const env = c.env as Env;
    return env.FRONTEND_URL || origin;
  },
  credentials: true,
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
});
