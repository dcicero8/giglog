-- GigLog PostgreSQL Schema

CREATE TABLE IF NOT EXISTS concerts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  artist TEXT NOT NULL,
  venue TEXT,
  city TEXT,
  date TEXT,
  price REAL,
  rating INTEGER,
  notes TEXT,
  last_minute INTEGER DEFAULT 0,
  setlist_fm_id TEXT,
  setlist_fm_url TEXT,
  ticket_art_svg TEXT,
  youtube_url TEXT,
  youtube_match TEXT,
  ticket_image TEXT,
  parent_concert_id INTEGER REFERENCES concerts(id) ON DELETE CASCADE,
  display_order INTEGER DEFAULT 0,
  tour_name TEXT,
  end_date TEXT,
  poster_image TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS upcoming (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  artist TEXT NOT NULL,
  venue TEXT,
  city TEXT,
  date TEXT,
  price REAL,
  section TEXT,
  last_minute INTEGER DEFAULT 0,
  notes TEXT,
  ticket_art_svg TEXT,
  ticket_image TEXT,
  poster_image TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wishlist (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  artist TEXT NOT NULL,
  priority TEXT DEFAULT 'want_to_see',
  max_price REAL,
  notes TEXT,
  url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS setlist_cache (
  cache_key TEXT PRIMARY KEY,
  response TEXT NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS seatgeek_cache (
  cache_key TEXT PRIMARY KEY,
  response TEXT NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS api_usage (
  date TEXT PRIMARY KEY,
  request_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS concert_photos (
  id SERIAL PRIMARY KEY,
  concert_id INTEGER NOT NULL REFERENCES concerts(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  original_name TEXT,
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS external_links (
  id SERIAL PRIMARY KEY,
  concert_id INTEGER NOT NULL REFERENCES concerts(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  url TEXT NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS geocode_cache (
  city TEXT PRIMARY KEY,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dismissed_artists (
  id SERIAL PRIMARY KEY,
  artist TEXT NOT NULL,
  user_id INTEGER,
  dismissed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(artist, user_id)
);

-- ══ Auth & Multi-User ══

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  google_id TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Session store for connect-pg-simple
CREATE TABLE IF NOT EXISTS "session" (
  "sid" VARCHAR NOT NULL COLLATE "default",
  "sess" JSON NOT NULL,
  "expire" TIMESTAMP(6) NOT NULL,
  PRIMARY KEY ("sid")
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

-- ══ Concert Buddies ══

CREATE TABLE IF NOT EXISTS buddy_invites (
  id SERIAL PRIMARY KEY,
  from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL,
  accepted_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS buddies (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  buddy_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, buddy_id)
);
