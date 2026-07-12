const express = require('express');
const router = express.Router();

const ZOOM = 19;
const IMG_SIZE = 640;

// Compute real-world lat/lon bounding box for a Static Maps image.
// Google Maps uses Web Mercator (EPSG:3857).
function computeBbox(lat, lon) {
  const worldPx = 256 * Math.pow(2, ZOOM); // total pixels across the world at this zoom

  // degrees longitude per pixel is constant
  const degPerPxLon = 360 / worldPx;

  // Convert lat to Mercator pixel y
  const latRad = (lat * Math.PI) / 180;
  const centerPxY = (worldPx / (2 * Math.PI)) * (Math.PI - Math.log(Math.tan(Math.PI / 4 + latRad / 2)));

  const half = IMG_SIZE / 2;

  const west = lon - half * degPerPxLon;
  const east = lon + half * degPerPxLon;

  // pixel y: smaller = further north in Mercator
  const northPxY = centerPxY - half;
  const southPxY = centerPxY + half;

  function pxYToLat(pxY) {
    return (2 * Math.atan(Math.exp(Math.PI - (pxY * 2 * Math.PI) / worldPx)) - Math.PI / 2) * (180 / Math.PI);
  }

  return {
    north: pxYToLat(northPxY),
    south: pxYToLat(southPxY),
    east,
    west,
  };
}

// GET /api/satellite?lat=&lon= — returns bbox JSON
router.get('/', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    if (isNaN(lat) || isNaN(lon)) return res.status(400).json({ error: 'lat and lon are required' });

    const bbox = computeBbox(lat, lon);
    res.json({ bbox, zoom: ZOOM, imageSize: IMG_SIZE });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/satellite/image?lat=&lon= — proxies the image so the API key stays server-side
router.get('/image', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    if (isNaN(lat) || isNaN(lon)) return res.status(400).json({ error: 'lat and lon are required' });

    const url =
      `https://maps.googleapis.com/maps/api/staticmap` +
      `?center=${lat},${lon}` +
      `&zoom=${ZOOM}` +
      `&size=${IMG_SIZE}x${IMG_SIZE}` +
      `&maptype=satellite` +
      `&key=${process.env.GOOGLE_MAPS_API_KEY}`;

    const upstream = await fetch(url);
    if (!upstream.ok) {
      return res.status(502).json({ error: `Google Maps returned ${upstream.status}` });
    }

    res.set('Content-Type', upstream.headers.get('content-type') || 'image/png');
    res.set('Cache-Control', 'public, max-age=86400');
    upstream.body.pipeTo(
      new WritableStream({
        write(chunk) { res.write(chunk); },
        close() { res.end(); },
        abort(err) { res.destroy(err); },
      })
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
