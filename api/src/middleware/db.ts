import { createMiddleware } from 'hono/factory';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import * as relations from '../db/relations';
import type { Env } from '../env';

export type AppDb = ReturnType<typeof drizzle<typeof schema & typeof relations>>;

export const dbMiddleware = createMiddleware<{ Bindings: Env; Variables: { db: AppDb } }>(
  async (c, next) => {
    const db = drizzle(c.env.DB, { schema: { ...schema, ...relations } });
    c.set('db', db);
    await next();
  },
);
