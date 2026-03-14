import { createMiddleware } from 'hono/factory';
import { getCookie } from 'hono/cookie';
import { verifyJwt } from '../lib/jwt';
import type { Env } from '../env';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export const authMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: { user: AuthUser };
}>(async (c, next) => {
  const token = getCookie(c, 'token');
  if (!token) return c.json({ error: 'Unauthorized' }, 401);
  const payload = await verifyJwt(token, c.env.JWT_SECRET);
  if (!payload) return c.json({ error: 'Unauthorized' }, 401);
  c.set('user', {
    id: payload.sub as string,
    email: payload.email as string,
    name: payload.name as string,
  });
  await next();
});
