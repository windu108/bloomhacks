const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const router = express.Router();

const ZOOM = 19;
const IMG_SIZE = 640;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Fallback: a centered rectangle covering roughly the middle third of the image
const FALLBACK_POLYGON = [
  { x: 213, y: 213 },
  { x: 427, y: 213 },
  { x: 427, y: 427 },
  { x: 213, y: 427 },
];

function clamp(v) { return Math.max(0, Math.min(IMG_SIZE, v)); }

function extractOuterArray(text) {
  const start = text.indexOf('[');
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '[') depth++;
    else if (text[i] === ']') { if (--depth === 0) return text.slice(start, i + 1); }
  }
  return null;
}

function parsePolygon(text) {
  const extracted = extractOuterArray(text);
  if (!extracted) return null;

  const raw = JSON.parse(extracted);
  if (!Array.isArray(raw) || raw.length < 3) return null;

  // Accept both [[x,y],...] and [{x,y},...]
  return raw.map((pt) => {
    if (Array.isArray(pt)) return { x: clamp(pt[0]), y: clamp(pt[1]) };
    if (typeof pt.x === 'number') return { x: clamp(pt.x), y: clamp(pt.y) };
    return null;
  }).filter(Boolean);
}

// GET /api/trace?lat=&lon=
router.get('/', async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  if (isNaN(lat) || isNaN(lon)) return res.status(400).json({ error: 'lat and lon are required' });

  try {
    // Fetch the satellite image as base64
    const mapUrl =
      `https://maps.googleapis.com/maps/api/staticmap` +
      `?center=${lat},${lon}&zoom=${ZOOM}&size=${IMG_SIZE}x${IMG_SIZE}` +
      `&maptype=satellite&key=${process.env.GOOGLE_MAPS_API_KEY}`;

    const imgRes = await fetch(mapUrl);
    if (!imgRes.ok) throw new Error(`Google Maps ${imgRes.status}`);
    const buffer = await imgRes.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    // Ask Claude to outline the central roof
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/png', data: base64 },
          },
          {
            type: 'text',
            text:
              `This is a ${IMG_SIZE}x${IMG_SIZE} satellite image (top-left is pixel [0,0]). ` +
              `Identify the roof outline of the single main building at the center of the image. ` +
              `Return ONLY a JSON array of [x, y] pixel coordinate pairs forming a clockwise polygon around that roof. ` +
              `Include 4–12 vertices. Output nothing else — just the raw JSON array.`,
          },
        ],
      }],
    });

    const polygon = parsePolygon(message.content[0].text);
    if (!polygon || polygon.length < 3) {
      return res.json({ polygon: FALLBACK_POLYGON, fallback: true });
    }

    res.json({ polygon, fallback: false });
  } catch (err) {
    console.error('trace error:', err.message);
    res.json({ polygon: FALLBACK_POLYGON, fallback: true, error: err.message });
  }
});

module.exports = router;
