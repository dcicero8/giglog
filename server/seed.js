import db from './db.js';

const seedData = db.transaction(() => {
  // Clear existing data
  db.prepare('DELETE FROM upcoming').run();
  db.prepare('DELETE FROM wishlist').run();

  // Upcoming shows from spec
  const insertUpcoming = db.prepare(
    'INSERT INTO upcoming (artist, venue, city, date, price, section, last_minute, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );

  insertUpcoming.run(
    'The Afghan Whigs (w/ Mercury Rev)',
    "Pappy & Harriet's",
    'Pioneertown, CA',
    '2026-05-24',
    60.00,
    'Outdoor Stage · GA',
    0,
    'folkYEAH! Presents · 40th Anniversary Tour · Doors 5:00PM, Show 6:30PM'
  );

  insertUpcoming.run(
    'BeachLife Festival — Sunday',
    'Redondo Beach',
    'Redondo Beach, CA',
    '2026-05-03',
    185.95,
    'GA',
    0,
    "James Taylor & His All-Star Band, My Morning Jacket, Sheryl Crow, Peach Pit, Poolside + more · Gates 11:30 AM · Ends 9:15 PM · 239 N Harbor Dr"
  );

  insertUpcoming.run(
    'SUGAR - Love You Even Still 2026 World Tour',
    'Hollywood Palladium',
    'Hollywood, CA',
    '2026-09-30',
    150.00,
    'Sec HRBALC, Row A, Seat 15',
    0,
    'Doors 7:00 PM'
  );

  // Wishlist from spec
  const insertWishlist = db.prepare(
    'INSERT INTO wishlist (artist, priority, max_price, notes) VALUES (?, ?, ?, ?)'
  );

  insertWishlist.run('Bruce Springsteen', 'must_see', null, '');
  insertWishlist.run('Sturgill Simpson', 'must_see', null, '');

  console.log('Seed data inserted:');
  console.log('  - 3 upcoming shows');
  console.log('  - 2 wishlist artists');
});

seedData();
console.log('Database seeded successfully.');
