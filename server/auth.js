import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import db from './db.js';

export function setupAuth(app) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.log('[auth] Google OAuth not configured — running without authentication');
    app.use((req, res, next) => {
      req.user = null; // Routes handle null user gracefully
      next();
    });
    // In dev mode, /api/me returns null (no auth required)
    app.get('/api/me', (req, res) => res.json(null));
    return;
  }

  const callbackURL = process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback';

  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL,
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const googleId = profile.id;
      const email = profile.emails?.[0]?.value;
      const name = profile.displayName;
      const avatarUrl = profile.photos?.[0]?.value || null;

      if (!email) return done(new Error('No email found in Google profile'));

      // Upsert user
      const user = await db.queryRow(
        `INSERT INTO users (google_id, email, name, avatar_url)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (google_id) DO UPDATE SET
           email = EXCLUDED.email,
           name = EXCLUDED.name,
           avatar_url = EXCLUDED.avatar_url
         RETURNING *`,
        [googleId, email, name, avatarUrl]
      );

      done(null, user);
    } catch (err) {
      done(err);
    }
  }));

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await db.queryRow('SELECT * FROM users WHERE id = $1', [id]);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  app.use(passport.initialize());
  app.use(passport.session());

  // Auth routes
  app.get('/auth/google', (req, res, next) => {
    // Save returnTo so we can redirect after login (e.g. invite links)
    if (req.query.returnTo) {
      req.session.returnTo = req.query.returnTo;
    }
    next();
  }, passport.authenticate('google', {
    scope: ['profile', 'email'],
  }));

  app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    (req, res) => {
      const returnTo = req.session.returnTo || '/';
      delete req.session.returnTo;
      res.redirect(returnTo);
    }
  );

  app.get('/auth/logout', (req, res) => {
    req.logout((err) => {
      if (err) return res.status(500).json({ error: 'Logout failed' });
      res.redirect('/login');
    });
  });

  app.get('/api/me', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    res.json({
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      avatar_url: req.user.avatar_url,
    });
  });
}
