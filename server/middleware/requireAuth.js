/**
 * Middleware that requires a logged-in user.
 * If Google OAuth is not configured (dev/single-user mode),
 * all requests pass through with req.userId = null.
 * Routes must handle null userId gracefully.
 */
export default function requireAuth(req, res, next) {
  // If OAuth is not configured, allow through (single-user mode)
  if (!process.env.GOOGLE_CLIENT_ID) {
    req.userId = null;
    return next();
  }

  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  req.userId = req.user.id;
  next();
}
