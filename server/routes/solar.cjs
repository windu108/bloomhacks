const express = require('express');
const router = express.Router();

// GET /api/solar?lat=&lon=
// Calls Google Solar API and returns panel slots + segment geometry
// in local flat-earth meters relative to the supplied lat/lon origin.
router.get('/', async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  if (isNaN(lat) || isNaN(lon)) return res.status(400).json({ error: 'lat and lon required' });

  try {
    const url =
      `https://solar.googleapis.com/v1/buildingInsights:findClosest` +
      `?location.latitude=${lat}&location.longitude=${lon}` +
      `&requiredQuality=LOW&key=${process.env.GOOGLE_MAPS_API_KEY}`;

    const upstream = await fetch(url);
    const data = await upstream.json();

    if (!upstream.ok) {
      return res.status(502).json({ error: data.error?.message || `Solar API ${upstream.status}` });
    }

    const sp = data.solarPotential;
    if (!sp) return res.status(502).json({ error: 'No solar potential data for this location' });

    // Convert lat/lon → local meters relative to the user's geocoded origin
    const mPerLat = 111320;
    const mPerLon = 111320 * Math.cos((lat * Math.PI) / 180);
    function toLocal(plat, plon) {
      return {
        x:  (plon - lon) * mPerLon,
        y: -(plat - lat) * mPerLat,  // positive y = south (matches app.js convention)
      };
    }

    // Panel slots — sorted by yearlyEnergyDcKwh descending (best first, per Google docs)
    const panels = (sp.solarPanels || []).map((p, i) => ({
      id: i,
      ...toLocal(p.center.latitude, p.center.longitude),
      orientation: p.orientation,   // 'LANDSCAPE' | 'PORTRAIT'
      yearlyKwh: p.yearlyEnergyDcKwh,
      segmentIndex: p.segmentIndex,
    }));

    // Roof segments — pitch + azimuth + center height + bounding box for 3-D geometry
    function convertBbox(bb) {
      if (!bb?.sw || !bb?.ne) return null;
      return {
        sw: toLocal(bb.sw.latitude, bb.sw.longitude),
        ne: toLocal(bb.ne.latitude, bb.ne.longitude),
      };
    }

    const segments = (sp.roofSegmentStats || []).map((s, i) => {
      const c = s.center ? toLocal(s.center.latitude, s.center.longitude) : { x: 0, y: 0 };
      return {
        index: i,
        pitchDeg:   s.pitchDegrees   ?? 0,
        azimuthDeg: s.azimuthDegrees ?? 180,
        areaM2:     s.stats?.areaMeters2 ?? 0,
        centerX: c.x,
        centerZ: c.y,               // local y → scene z
        heightM: s.planeHeightAtCenterMeters ?? 3,
        bbox: convertBbox(s.boundingBox),
      };
    });

    // Building-level bounding box — used to auto-derive wall footprint
    const buildingBbox = convertBbox(data.boundingBox);

    // "Recommended" cutoff: minimum panels that reach 80% of total annual kWh.
    const totalKwh = panels.reduce((s, p) => s + p.yearlyKwh, 0);
    const target = totalKwh * 0.8;
    let cumulative = 0, recommendedCount = panels.length;
    for (let i = 0; i < panels.length; i++) {
      cumulative += panels[i].yearlyKwh;
      if (cumulative >= target) { recommendedCount = i + 1; break; }
    }

    res.json({
      stats: {
        maxPanels:          sp.maxArrayPanelsCount,
        roofAreaM2:         sp.wholeRoofStats?.areaMeters2 ?? 0,
        maxSunshineHours:   sp.maxSunshineHoursPerYear,
        carbonKgPerMwh:     sp.carbonOffsetFactorKgPerMwh,
      },
      panels,
      segments,
      recommendedCount,
      buildingBbox,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
