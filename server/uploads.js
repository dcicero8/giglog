import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// In production, store uploads on the persistent volume so they survive redeploys.
// Every upload path (tickets, posters, photos) must derive from this same base —
// /uploads is served from here, so a file written anywhere else 404s.
export const uploadsBase = process.env.NODE_ENV === 'production' && fs.existsSync('/app/data')
  ? '/app/data/uploads'
  : path.join(__dirname, '..', 'uploads');

export const ticketsDir = path.join(uploadsBase, 'tickets');
export const postersDir = path.join(uploadsBase, 'posters');
export const photosDir = path.join(uploadsBase, 'photos');
for (const dir of [ticketsDir, postersDir, photosDir]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Only accept real image uploads. Without this, an HTML/SVG file uploaded as a
// "ticket" would be served same-origin from /uploads and execute as a page (XSS).
export const imageFilter = (req, file, cb) => {
  if (/^image\/(jpeg|png|webp|gif|heic|heif|avif)$/i.test(file.mimetype)) return cb(null, true);
  cb(new Error('Only image uploads are allowed (JPEG, PNG, WebP, GIF, HEIC)'));
};

// Best-effort removal of an uploaded file (used when a request is rejected after
// multer already wrote the file, and when deleting a photo/ticket/poster row).
export const removeUpload = (dir, filename) => {
  if (!filename) return;
  const p = path.join(dir, path.basename(filename));
  try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch { /* best effort */ }
};
