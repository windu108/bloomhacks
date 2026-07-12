const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { address } = req.query;
    if (!address) return res.status(400).json({ error: 'address is required' });

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK') {
      return res.status(400).json({ error: `Geocoding failed: ${data.status}` });
    }

    const result = data.results[0];
    res.json({
      lat: result.geometry.location.lat,
      lon: result.geometry.location.lng,
      formattedAddress: result.formatted_address,
      viewport: result.geometry.viewport
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;