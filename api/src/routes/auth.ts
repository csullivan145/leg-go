import { Hono } from 'hono';
import { setCookie, getCookie, deleteCookie } from 'hono/cookie';
import { eq } from 'drizzle-orm';
import { signJwt, verifyJwt } from '../lib/jwt';
import { generateId, now } from '../lib/utils';
import { users } from '../db/schema';
import type { Env } from '../env';
import type { AppDb } from '../middleware/db';

const auth = new Hono<{ Bindings: Env; Variables: { db: AppDb } }>();

auth.get('/login', (c) => {
  const params = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID,
    redirect_uri: c.env.GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
  });
  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

auth.get('/callback', async (c) => {
  const code = c.req.query('code');
  if (!code) return c.json({ error: 'Missing code' }, 400);

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: c.env.GOOGLE_CLIENT_ID,
      client_secret: c.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: c.env.GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });
  const tokens = await tokenRes.json<{ access_token: string }>();

  const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = await profileRes.json<{
    id: string; email: string; name: string; picture: string;
  }>();

  const db = c.get('db');

  let user = await db.select().from(users).where(eq(users.google_id, profile.id)).get();
  if (!user) {
    user = {
      id: generateId(),
      email: profile.email,
      name: profile.name,
      avatar_url: profile.picture,
      google_id: profile.id,
      created_at: now(),
    };
    await db.insert(users).values(user);
  } else {
    await db.update(users).set({
      name: profile.name,
      avatar_url: profile.picture,
      email: profile.email,
    }).where(eq(users.id, user.id));
  }

  const jwt = await signJwt(
    { sub: user.id, email: user.email, name: user.name, exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60 },
    c.env.JWT_SECRET,
  );

  setCookie(c, 'token', jwt, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });

  return c.redirect(c.env.FRONTEND_URL || '/');
});

auth.get('/me', async (c) => {
  const token = getCookie(c, 'token');
  if (!token) return c.json({ error: 'Not authenticated' }, 401);
  const payload = await verifyJwt(token, c.env.JWT_SECRET);
  if (!payload) return c.json({ error: 'Invalid token' }, 401);
  const db = c.get('db');
  const user = await db.select().from(users).where(eq(users.id, payload.sub as string)).get();
  if (!user) return c.json({ error: 'User not found' }, 404);
  return c.json({ user });
});

auth.post('/logout', (c) => {
  deleteCookie(c, 'token', { path: '/' });
  return c.json({ ok: true });
});

export default auth;
