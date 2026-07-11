// app.js

const form = document.getElementById('address-form');
const input = document.getElementById('address-input');
const status = document.getElementById('status');
const resultSection = document.getElementById('result-section');

const state = { lat: null, lon: null, bbox: null, solarData: null };

function setStatus(msg, isError = false) {
  status.textContent = msg;
  status.className = isError ? 'error' : '';
}

// ── Geocode ──────────────────────────────────────────────────────────────────

async function geocode(address) {
  const res = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Geocoding failed');
  return data;
}

// ── Satellite image + bounding box ───────────────────────────────────────────

async function loadSatellite(lat, lon) {
  const res = await fetch(`/api/satellite?lat=${lat}&lon=${lon}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Satellite fetch failed');

  state.bbox = data.bbox;

  const img = document.getElementById('satellite-img');
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = `/api/satellite/image?lat=${lat}&lon=${lon}`;
  });

  const { north, south, east, west } = data.bbox;
  document.getElementById('bbox-info').textContent =
    `Bbox — N:${north.toFixed(6)} S:${south.toFixed(6)} E:${east.toFixed(6)} W:${west.toFixed(6)}`;

  document.getElementById('satellite-section').hidden = false;
}

// ── Solar API ────────────────────────────────────────────────────────────────

async function fetchSolarData(lat, lon) {
  try {
    const res  = await fetch(`/api/solar?lat=${lat}&lon=${lon}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    state.solarData = data;
    console.log(`Solar API: ${data.panels.length} panel slots, ${data.stats.roofAreaM2?.toFixed(1)}m² roof`);
  } catch (err) {
    console.warn('Solar API unavailable:', err.message);
    state.solarData = null;
  }
}

// ── Form submit ──────────────────────────────────────────────────────────────

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const address = input.value.trim();
  if (!address) return;

  document.getElementById('go-btn').disabled = true;
  document.getElementById('satellite-section').hidden = true;
  document.getElementById('viewer-section').hidden = true;
  state.solarData = null;
  setStatus('Looking up address…');

  try {
    const geo = await geocode(address);
    state.lat = geo.lat;
    state.lon = geo.lon;

    document.getElementById('geocode-result').innerHTML =
      `<strong>${geo.formattedAddress}</strong> &nbsp; ${geo.lat.toFixed(6)}, ${geo.lon.toFixed(6)}`;
    resultSection.hidden = false;

    // Fetch satellite image and solar data in parallel
    setStatus('Loading satellite image + solar data…');
    await Promise.all([
      loadSatellite(geo.lat, geo.lon),
      fetchSolarData(geo.lat, geo.lon),
    ]);

    // Auto-build 3D from Solar API building bbox (no manual trace needed)
    if (state.solarData?.buildingBbox) {
      const { sw, ne } = state.solarData.buildingBbox;
      const footprint = [
        { x: sw.x, y: sw.y },
        { x: ne.x, y: sw.y },
        { x: ne.x, y: ne.y },
        { x: sw.x, y: ne.y },
      ];
      document.getElementById('viewer-section').hidden = false;
      if (typeof window.initViewer === 'function') {
        window.initViewer(footprint, state.lat, state.lon, state.solarData);
      }
      setStatus('');
    } else {
      setStatus('Solar data unavailable for this location.');
    }
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    document.getElementById('go-btn').disabled = false;
  }
});
