import { Router } from 'express';
import cryptoRandomString from 'crypto-random-string';
import db from '../db.js';

const router = Router();

// The app owner/admin: ADMIN_EMAIL if set, otherwise the first registered user.
async function isAdmin(userId) {
  if (!userId) return false;
  if (process.env.ADMIN_EMAIL) {
    const u = await db.queryRow('SELECT email FROM users WHERE id = $1', [userId]);
    return !!u && u.email?.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase();
  }
  const first = await db.queryRow('SELECT id FROM users ORDER BY id LIMIT 1');
  return !!first && first.id === userId;
}

// Whether the current user is the admin (so the client can show the directory)
router.get('/is-admin', async (req, res) => {
  res.json({ admin: await isAdmin(req.userId) });
});

// Admin: list every member, flagged with whether they're already a buddy
router.get('/all-users', async (req, res) => {
  if (!(await isAdmin(req.userId))) return res.status(403).json({ error: 'Admin only' });
  const users = await db.queryRows(
    `SELECT u.id, u.name, u.email, u.avatar_url,
       EXISTS(SELECT 1 FROM buddies b WHERE b.user_id = $1 AND b.buddy_id = u.id) AS is_buddy
     FROM users u
     WHERE u.id <> $1
     ORDER BY u.name ASC`,
    [req.userId]
  );
  res.json(users.map(u => ({ ...u, is_buddy: !!u.is_buddy })));
});

// Admin: add a member as a buddy directly (bidirectional, no invite needed)
router.post('/add', async (req, res) => {
  if (!(await isAdmin(req.userId))) return res.status(403).json({ error: 'Admin only' });
  const buddyId = parseInt(req.body.userId);
  if (!buddyId || buddyId === req.userId) return res.status(400).json({ error: 'Invalid user' });
  const target = await db.queryRow('SELECT id, name, email, avatar_url FROM users WHERE id = $1', [buddyId]);
  if (!target) return res.status(404).json({ error: 'User not found' });

  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    await client.query('INSERT INTO buddies (user_id, buddy_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.userId, buddyId]);
    await client.query('INSERT INTO buddies (user_id, buddy_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [buddyId, req.userId]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  res.json({ success: true, buddy: target });
});

// List my buddies
router.get('/', async (req, res) => {
  const buddies = await db.queryRows(
    `SELECT b.id, b.created_at, u.id as user_id, u.name, u.email, u.avatar_url
     FROM buddies b
     JOIN users u ON u.id = b.buddy_id
     WHERE b.user_id = $1
     ORDER BY u.name ASC`,
    [req.userId]
  );
  res.json(buddies);
});

// Generate invite link
router.post('/invite', async (req, res) => {
  const code = cryptoRandomString({ length: 20, type: 'url-safe' });
  const invite = await db.queryRow(
    'INSERT INTO buddy_invites (from_user_id, code) VALUES ($1, $2) RETURNING *',
    [req.userId, code]
  );
  res.json({ code: invite.code, url: `/buddies/accept/${invite.code}` });
});

// List my pending invites
router.get('/invites', async (req, res) => {
  const invites = await db.queryRows(
    `SELECT id, code, created_at, accepted_by, accepted_at,
       (SELECT name FROM users WHERE id = accepted_by) as accepted_by_name
     FROM buddy_invites
     WHERE from_user_id = $1
     ORDER BY created_at DESC`,
    [req.userId]
  );
  res.json(invites);
});

// Delete an invite
router.delete('/invites/:id', async (req, res) => {
  const invite = await db.queryRow(
    'SELECT * FROM buddy_invites WHERE id = $1 AND from_user_id = $2',
    [req.params.id, req.userId]
  );
  if (!invite) return res.status(404).json({ error: 'Invite not found' });

  await db.query('DELETE FROM buddy_invites WHERE id = $1', [invite.id]);
  res.json({ success: true });
});

// Accept invite
router.post('/accept/:code', async (req, res) => {
  console.log(`[buddies] Accept invite attempt: code=${req.params.code}, userId=${req.userId}`);

  if (!req.userId) {
    console.log('[buddies] Accept failed: user not authenticated');
    return res.status(401).json({ error: 'You must be logged in to accept an invite' });
  }

  const invite = await db.queryRow(
    'SELECT * FROM buddy_invites WHERE code = $1',
    [req.params.code]
  );

  if (!invite) return res.status(404).json({ error: 'Invite not found' });
  if (invite.accepted_by) return res.status(400).json({ error: 'Invite already used' });
  if (invite.from_user_id === req.userId) return res.status(400).json({ error: 'Cannot accept your own invite' });

  // Check if already buddies
  const existing = await db.queryRow(
    'SELECT id FROM buddies WHERE user_id = $1 AND buddy_id = $2',
    [req.userId, invite.from_user_id]
  );
  if (existing) return res.status(400).json({ error: 'Already buddies' });

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Mark invite as accepted
    await client.query(
      'UPDATE buddy_invites SET accepted_by = $1, accepted_at = NOW() WHERE id = $2',
      [req.userId, invite.id]
    );

    // Create bidirectional buddy relationship
    await client.query(
      'INSERT INTO buddies (user_id, buddy_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.userId, invite.from_user_id]
    );
    await client.query(
      'INSERT INTO buddies (user_id, buddy_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [invite.from_user_id, req.userId]
    );

    await client.query('COMMIT');
    console.log(`[buddies] Buddy relationship created: user ${req.userId} <-> user ${invite.from_user_id}`);

    const inviter = await db.queryRow('SELECT name, avatar_url FROM users WHERE id = $1', [invite.from_user_id]);
    res.json({ success: true, buddy: inviter });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[buddies] Accept invite error:', err);
    throw err;
  } finally {
    client.release();
  }
});

// Remove buddy
router.delete('/:id', async (req, res) => {
  const buddy = await db.queryRow(
    'SELECT * FROM buddies WHERE id = $1 AND user_id = $2',
    [req.params.id, req.userId]
  );
  if (!buddy) return res.status(404).json({ error: 'Buddy not found' });

  // Remove bidirectional relationship
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM buddies WHERE user_id = $1 AND buddy_id = $2', [req.userId, buddy.buddy_id]);
    await client.query('DELETE FROM buddies WHERE user_id = $1 AND buddy_id = $2', [buddy.buddy_id, req.userId]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  res.json({ success: true });
});

// View buddy's profile (read-only)
router.get('/:buddyUserId/profile', async (req, res) => {
  const buddyId = parseInt(req.params.buddyUserId);

  // Verify buddy relationship
  const isBuddy = await db.queryRow(
    'SELECT id FROM buddies WHERE user_id = $1 AND buddy_id = $2',
    [req.userId, buddyId]
  );
  if (!isBuddy) return res.status(403).json({ error: 'Not your buddy' });

  const buddy = await db.queryRow('SELECT id, name, email, avatar_url, created_at FROM users WHERE id = $1', [buddyId]);
  if (!buddy) return res.status(404).json({ error: 'User not found' });

  // Fetch buddy's data
  const concerts = await db.queryRows(
    'SELECT id, artist, venue, city, date, price, rating, last_minute, ticket_art_svg, ticket_image, poster_image, parent_concert_id, tour_name FROM concerts WHERE user_id = $1 AND parent_concert_id IS NULL ORDER BY date DESC',
    [buddyId]
  );

  // Attach children to festival parents
  for (const concert of concerts) {
    const children = await db.queryRows(
      'SELECT id, artist, venue, city, date, rating, setlist_fm_id FROM concerts WHERE parent_concert_id = $1 ORDER BY display_order ASC',
      [concert.id]
    );
    if (children.length > 0) concert.children = children;
  }

  const upcoming = await db.queryRows(
    'SELECT id, artist, venue, city, date, price FROM upcoming WHERE user_id = $1 ORDER BY date ASC',
    [buddyId]
  );

  const wishlist = await db.queryRows(
    'SELECT id, artist, priority FROM wishlist WHERE user_id = $1',
    [buddyId]
  );

  // Stats
  const childCount = (await db.queryRow('SELECT COUNT(*) as count FROM concerts WHERE user_id = $1 AND parent_concert_id IS NOT NULL', [buddyId])).count;
  const soloCount = (await db.queryRow('SELECT COUNT(*) as count FROM concerts WHERE user_id = $1 AND parent_concert_id IS NULL AND id NOT IN (SELECT DISTINCT parent_concert_id FROM concerts WHERE parent_concert_id IS NOT NULL AND user_id = $1)', [buddyId])).count;
  const totalSpent = (await db.queryRow('SELECT COALESCE(SUM(price), 0) as total FROM concerts WHERE user_id = $1', [buddyId])).total;
  const upcomingSpent = (await db.queryRow('SELECT COALESCE(SUM(price), 0) as total FROM upcoming WHERE user_id = $1', [buddyId])).total;

  const stats = {
    concertCount: parseInt(soloCount) + parseInt(childCount),
    upcomingCount: upcoming.length,
    wishlistCount: wishlist.length,
    totalSpent: parseFloat(totalSpent) + parseFloat(upcomingSpent),
  };

  res.json({ buddy, stats, concerts, upcoming, wishlist });
});

export default router;
