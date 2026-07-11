const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const router = express.Router();

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function azToCompass(deg) {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

// POST /api/recommend
// Body: { lat, lon, panels, segments, stats }
router.post('/', async (req, res) => {
  const { lat, lon, panels, segments, stats } = req.body;
  if (!lat || !lon || !panels?.length) {
    return res.status(400).json({ error: 'lat, lon, and panels are required' });
  }

  try {
    // Fetch satellite image as base64 for vision analysis
    const mapUrl =
      `https://maps.googleapis.com/maps/api/staticmap` +
      `?center=${lat},${lon}&zoom=19&size=640x640` +
      `&maptype=satellite&key=${process.env.GOOGLE_MAPS_API_KEY}`;

    const imgRes = await fetch(mapUrl);
    if (!imgRes.ok) throw new Error(`Google Maps ${imgRes.status}`);
    const buffer = await imgRes.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    // Summarise segments
    const segSummary = segments.map((s, i) => {
      const dir = azToCompass(s.azimuthDeg);
      return `  Segment ${i}: faces ${dir} (${s.azimuthDeg.toFixed(0)}°), pitch ${s.pitchDeg.toFixed(0)}°, area ${s.areaM2.toFixed(0)}m², height ${s.heightM.toFixed(1)}m`;
    }).join('\n');

    // Summarise panels grouped by segment
    const bySegment = {};
    panels.forEach((p, i) => {
      const si = p.segmentIndex ?? 0;
      if (!bySegment[si]) bySegment[si] = [];
      bySegment[si].push({ idx: i, kwh: p.yearlyKwh });
    });
    const panelSummary = Object.entries(bySegment).map(([si, ps]) => {
      const seg = segments[si];
      const dir = seg ? azToCompass(seg.azimuthDeg) : '?';
      const totalKwh = ps.reduce((s, p) => s + p.kwh, 0);
      const avgKwh = totalKwh / ps.length;
      return `  Segment ${si} (${dir}): ${ps.length} slots, avg ${avgKwh.toFixed(0)} kWh/yr each, total ${totalKwh.toFixed(0)} kWh/yr`;
    }).join('\n');

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
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
`You're helping a homeowner figure out where to put solar panels on their roof. Look at the satellite image and the data below, then give friendly, practical advice.

Here's the satellite view of their property at ${lat.toFixed(6)}, ${lon.toFixed(6)}. Look at the image carefully for trees, shade, obstructions, and which parts of the roof get the most sun.

Their roof has these sections:
${segSummary}

Solar panel slots available per section:
${panelSummary}

Roof is ${stats.roofAreaM2?.toFixed(0)}m² total with up to ${stats.maxPanels} possible panel slots and ${stats.maxSunshineHours?.toFixed(0)} peak sun hours/yr.

Write a short, friendly recommendation (like you're talking to the homeowner). Keep it to 3-5 sentences max. Cover:
- Which areas of the roof are the sweet spots and roughly how many panels would work well there
- Any areas to avoid and why (shade from trees, north-facing, etc.)
- Anything you notice from the satellite image (tree cover, nearby shade, etc.)

Do NOT list every segment individually. Talk about general areas: "the south side", "the back of the house", etc. Be conversational, not technical.

Respond with EXACTLY this JSON format (no other text):
{
  "reasoning": "Your friendly 3-5 sentence recommendation here"
}`
          },
        ],
      }],
    });

    const text = message.content[0].text;
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart < 0 || jsonEnd < 0) {
      return res.status(502).json({ error: 'AI did not return valid JSON' });
    }
    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));

    res.json(parsed);
  } catch (err) {
    console.error('recommend error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
