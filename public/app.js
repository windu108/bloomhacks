// app.js — grows with each phase

const form = document.getElementById('address-form');
const input = document.getElementById('address-input');
const status = document.getElementById('status');
const resultSection = document.getElementById('result-section');

// State shared across phases
const state = { lat: null, lon: null, bbox: null, editor: null };

function setStatus(msg, isError = false) {
  status.textContent = msg;
  status.className = isError ? 'error' : '';
}

// ── Phase 2: Geocode ──────────────────────────────────────────────────────────

async function geocode(address) {
  const res = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Geocoding failed');
  return data;
}

// ── Phase 3: Satellite image + bounding box ───────────────────────────────────

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
  document.getElementById('trace-controls').hidden = false;
}

// ── Phase 4: Polygon editor ───────────────────────────────────────────────────

const SVG_NS = 'http://www.w3.org/2000/svg';
const IMG_SIZE = 640;

class PolygonEditor {
  constructor(svgEl, points) {
    this.svg = svgEl;
    this.points = points.map(p => ({ ...p }));
    this.dragging = null;
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
    this.svg.addEventListener('mousemove', this._onMouseMove);
    this.svg.addEventListener('mouseup', this._onMouseUp);
    this.svg.addEventListener('mouseleave', this._onMouseUp);
    this.render();
  }

  render() {
    this.svg.innerHTML = '';

    if (this.points.length < 2) return;

    // Filled polygon
    const poly = document.createElementNS(SVG_NS, 'polygon');
    poly.setAttribute('points', this.points.map(p => `${p.x},${p.y}`).join(' '));
    poly.setAttribute('fill', 'rgba(249,200,70,0.15)');
    poly.setAttribute('stroke', '#f9c846');
    poly.setAttribute('stroke-width', '2');
    this.svg.appendChild(poly);

    // Midpoint handles (add vertex)
    for (let i = 0; i < this.points.length; i++) {
      const a = this.points[i];
      const b = this.points[(i + 1) % this.points.length];
      const mid = document.createElementNS(SVG_NS, 'circle');
      mid.setAttribute('cx', (a.x + b.x) / 2);
      mid.setAttribute('cy', (a.y + b.y) / 2);
      mid.setAttribute('r', 5);
      mid.setAttribute('fill', 'rgba(249,200,70,0.45)');
      mid.setAttribute('stroke', '#f9c846');
      mid.setAttribute('stroke-width', '1');
      mid.style.cursor = 'copy';
      mid.dataset.insertAfter = i;
      mid.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        const idx = parseInt(mid.dataset.insertAfter);
        const pa = this.points[idx];
        const pb = this.points[(idx + 1) % this.points.length];
        this.points.splice(idx + 1, 0, { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 });
        this.dragging = idx + 1;
        this.render();
      });
      this.svg.appendChild(mid);
    }

    // Vertex handles
    this.points.forEach((p, i) => {
      const circle = document.createElementNS(SVG_NS, 'circle');
      circle.setAttribute('cx', p.x);
      circle.setAttribute('cy', p.y);
      circle.setAttribute('r', 7);
      circle.setAttribute('fill', '#f9c846');
      circle.setAttribute('stroke', '#fff');
      circle.setAttribute('stroke-width', '2');
      circle.style.cursor = 'grab';
      circle.dataset.index = i;

      circle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.dragging = i;
        circle.style.cursor = 'grabbing';
      });

      circle.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        if (this.points.length > 3) {
          this.points.splice(i, 1);
          this.render();
        }
      });

      this.svg.appendChild(circle);
    });
  }

  _onMouseMove(e) {
    if (this.dragging === null) return;
    const rect = this.svg.getBoundingClientRect();
    this.points[this.dragging] = {
      x: Math.max(0, Math.min(IMG_SIZE, e.clientX - rect.left)),
      y: Math.max(0, Math.min(IMG_SIZE, e.clientY - rect.top)),
    };
    this.render();
  }

  _onMouseUp() {
    this.dragging = null;
  }

  getPoints() {
    return this.points.map(p => ({ ...p }));
  }

  destroy() {
    this.svg.removeEventListener('mousemove', this._onMouseMove);
    this.svg.removeEventListener('mouseup', this._onMouseUp);
    this.svg.removeEventListener('mouseleave', this._onMouseUp);
    this.svg.innerHTML = '';
  }
}

async function traceRoof(lat, lon) {
  setStatus('AI is tracing the roof…');
  document.getElementById('trace-btn').disabled = true;

  try {
    const res = await fetch(`/api/trace?lat=${lat}&lon=${lon}`);
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Trace failed');

    if (state.editor) state.editor.destroy();
    state.editor = new PolygonEditor(document.getElementById('overlay-svg'), data.polygon);

    const note = data.fallback ? ' (AI unavailable — using default rectangle)' : '';
    setStatus(`Roof traced${note}. Drag handles to adjust.`);
    document.getElementById('trace-hint').hidden = false;
  } catch (err) {
    setStatus(`Trace failed: ${err.message}`, true);
  } finally {
    document.getElementById('trace-btn').disabled = false;
  }
}

document.getElementById('trace-btn').addEventListener('click', () => {
  traceRoof(state.lat, state.lon);
});

// ── Form submit ───────────────────────────────────────────────────────────────

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const address = input.value.trim();
  if (!address) return;

  document.getElementById('go-btn').disabled = true;
  document.getElementById('satellite-section').hidden = true;
  document.getElementById('trace-controls').hidden = true;
  if (state.editor) { state.editor.destroy(); state.editor = null; }
  setStatus('Looking up address…');

  try {
    const geo = await geocode(address);
    state.lat = geo.lat;
    state.lon = geo.lon;

    document.getElementById('geocode-result').innerHTML =
      `<strong>${geo.formattedAddress}</strong> &nbsp; ${geo.lat.toFixed(6)}, ${geo.lon.toFixed(6)}`;
    resultSection.hidden = false;

    setStatus('Loading satellite image…');
    await loadSatellite(geo.lat, geo.lon);
    setStatus('');
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    document.getElementById('go-btn').disabled = false;
  }
});
