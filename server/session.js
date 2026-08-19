import crypto from 'node:crypto';
import { config } from './config.js';

const COOKIE = 'bi_session';

function sign(email) {
  const hmac = crypto.createHmac('sha256', config.sessionSecret).update(email).digest('hex');
  return `${email}.${hmac}`;
}

function verify(token) {
  if (!token || !token.includes('.')) return null;
  const idx = token.lastIndexOf('.');
  const email = token.slice(0, idx);
  const hmac = token.slice(idx + 1);
  const expected = crypto.createHmac('sha256', config.sessionSecret).update(email).digest('hex');
  const a = Buffer.from(hmac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return email;
}

export function setSession(res, email) {
  res.cookie(COOKIE, sign(email), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 1000 * 60 * 60 * 24 * 14,
  });
}

export function clearSession(res) {
  res.clearCookie(COOKIE, { path: '/' });
}

export function sessionEmail(req) {
  return verify(req.cookies?.[COOKIE] || '');
}

export function requireUser(req, res, next) {
  const email = sessionEmail(req);
  if (!email) {
    res.status(401).json({ error: 'Sign in required' });
    return;
  }
  req.userEmail = email;
  next();
}
