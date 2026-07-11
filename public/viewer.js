import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const WALL_H   = 2.5;
const WALL_TOP = WALL_H + 0.06;

const PANEL_W  = 1.65;   // landscape width
const PANEL_H  = 0.99;   // landscape height

const MAT_PLACED = new THREE.MeshLambertMaterial({ color: 0x1a3a5c, transparent: true, opacity: 0.92, depthWrite: false, side: THREE.DoubleSide });
const MAT_GHOST  = new THREE.MeshLambertMaterial({ color: 0xf9c846, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide });

// ── Procedural textures ──────────────────────────────────────────────────────

function makeShingleTexture() {
  const w = 256, h = 256;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#6b3a2a';
  ctx.fillRect(0, 0, w, h);
  const rowH = 16;
  for (let row = 0; row < h / rowH; row++) {
    const y = row * rowH;
    const shade = 90 + Math.floor(Math.random() * 30);
    ctx.fillStyle = `rgb(${shade}, ${shade - 40}, ${shade - 55})`;
    ctx.fillRect(0, y, w, rowH - 1);
    ctx.strokeStyle = '#3a1e12';
    ctx.lineWidth = 1;
    const offset = (row % 2) * (w / 6);
    for (let x = offset; x < w; x += w / 4) {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + rowH); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(0, y + rowH - 1); ctx.lineTo(w, y + rowH - 1); ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}

function makeSidingTexture() {
  const w = 256, h = 256;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c4b596';
  ctx.fillRect(0, 0, w, h);
  const plankH = 32;
  for (let row = 0; row < h / plankH; row++) {
    const y = row * plankH;
    const r = 180 + Math.floor(Math.random() * 20);
    ctx.fillStyle = `rgb(${r}, ${r - 15}, ${r - 45})`;
    ctx.fillRect(0, y, w, plankH - 1);
    ctx.strokeStyle = `rgba(100, 70, 40, 0.15)`;
    ctx.lineWidth = 0.5;
    for (let k = 0; k < 3; k++) {
      const gy = y + 4 + Math.random() * (plankH - 8);
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
    }
    ctx.strokeStyle = '#8a7a5e';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, y + plankH - 1); ctx.lineTo(w, y + plankH - 1); ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 2);
  return tex;
}

const ROOF_TEX = makeShingleTexture();
const WALL_TEX = makeSidingTexture();

// ── Scene state ──────────────────────────────────────────────────────────────

let scene, camera, renderer, controls, animId;
let footprint3d = null;
let currentSegments = null;
let currentPanels = null;
let roofHeightFn = null;
let slotMeshes  = [];
let placedSet   = new Set();
const raycaster = new THREE.Raycaster();
const pointer   = new THREE.Vector2();

let ghostMesh = null;
let hoveredIdx = null;
let dragSourceIdx = null;
let pointerDownPos = null;

// ── Coordinate helpers ───────────────────────────────────────────────────────

function toScene(footprint) {
  return footprint.map(p => ({ x: p.x, z: p.y }));
}

function azToCompass(deg) {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

// ── Derive wall footprint from segment bboxes ────────────────────────────────

function computeFootprintFromSegments(segments) {
  const rects = [];
  for (const seg of segments) {
    if (!seg.bbox) continue;
    const { sw, ne } = seg.bbox;
    rects.push({
      minX: Math.min(sw.x, ne.x), maxX: Math.max(sw.x, ne.x),
      minZ: Math.min(sw.y, ne.y), maxZ: Math.max(sw.y, ne.y),
    });
  }
  if (!rects.length) return null;

  const RES = 0.3;
  const gMinX = Math.min(...rects.map(r => r.minX)) - RES;
  const gMaxX = Math.max(...rects.map(r => r.maxX)) + RES;
  const gMinZ = Math.min(...rects.map(r => r.minZ)) - RES;
  const gMaxZ = Math.max(...rects.map(r => r.maxZ)) + RES;
  const cols = Math.ceil((gMaxX - gMinX) / RES) + 2;
  const rows = Math.ceil((gMaxZ - gMinZ) / RES) + 2;

  const grid = new Uint8Array(rows * cols);
  for (const r of rects) {
    const c0 = Math.max(0, Math.floor((r.minX - gMinX) / RES));
    const c1 = Math.min(cols - 1, Math.ceil((r.maxX - gMinX) / RES));
    const r0 = Math.max(0, Math.floor((r.minZ - gMinZ) / RES));
    const r1 = Math.min(rows - 1, Math.ceil((r.maxZ - gMinZ) / RES));
    for (let row = r0; row <= r1; row++)
      for (let col = c0; col <= c1; col++)
        grid[row * cols + col] = 1;
  }

  const at = (r, c) => (r >= 0 && r < rows && c >= 0 && c < cols) ? grid[r * cols + c] : 0;
  const edges = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!at(r, c)) continue;
      const x0 = gMinX + c * RES, z0 = gMinZ + r * RES;
      const x1 = x0 + RES, z1 = z0 + RES;
      if (!at(r - 1, c)) edges.push([x0, z0, x1, z0]);
      if (!at(r, c + 1)) edges.push([x1, z0, x1, z1]);
      if (!at(r + 1, c)) edges.push([x1, z1, x0, z1]);
      if (!at(r, c - 1)) edges.push([x0, z1, x0, z0]);
    }
  }
  if (!edges.length) return null;

  const snap = v => Math.round(v * 1000);
  const key = (x, z) => `${snap(x)},${snap(z)}`;
  const adj = new Map();
  edges.forEach((e, i) => {
    const k = key(e[0], e[1]);
    if (!adj.has(k)) adj.set(k, []);
    adj.get(k).push(i);
  });

  const used = new Set();
  const points = [];
  let idx = 0;
  used.add(0);
  points.push({ x: edges[0][0], z: edges[0][1] });

  for (let step = 0; step < edges.length; step++) {
    const e = edges[idx];
    const k = key(e[2], e[3]);
    const cands = adj.get(k) || [];
    let next = -1;
    for (const ci of cands) {
      if (!used.has(ci)) { next = ci; break; }
    }
    if (next < 0) break;
    used.add(next);
    idx = next;
    points.push({ x: edges[next][0], z: edges[next][1] });
  }

  const result = [];
  for (let i = 0; i < points.length; i++) {
    const prev = points[(i - 1 + points.length) % points.length];
    const curr = points[i];
    const next = points[(i + 1) % points.length];
    const cross = (curr.x - prev.x) * (next.z - curr.z)
                - (curr.z - prev.z) * (next.x - curr.x);
    if (Math.abs(cross) > 0.001) result.push(curr);
  }

  return result.length >= 3 ? result : null;
}

// ── Geometry helpers ─────────────────────────────────────────────────────────

function fanTriangulate(poly, heightFn, pos, uvs) {
  if (poly.length < 3) return;
  const cx = poly.reduce((s, p) => s + p.x, 0) / poly.length;
  const cz = poly.reduce((s, p) => s + p.z, 0) / poly.length;
  const cy = heightFn(cx, cz);
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    pos.push(cx, cy, cz,  a.x, heightFn(a.x, a.z), a.z,  b.x, heightFn(b.x, b.z), b.z);
    if (uvs) uvs.push(cx, cz,  a.x, a.z,  b.x, b.z);
  }
}

function splitPolygon(poly, axis, value) {
  const sideA = [], sideB = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const curr = poly[i], next = poly[(i + 1) % n];
    const cv = axis === 'z' ? curr.z : curr.x;
    const nv = axis === 'z' ? next.z : next.x;
    if (cv < value)      sideA.push(curr);
    else if (cv > value) sideB.push(curr);
    else                 { sideA.push(curr); sideB.push(curr); }
    if ((cv < value && nv > value) || (cv > value && nv < value)) {
      const t = (value - cv) / (nv - cv);
      const pt = { x: curr.x + t * (next.x - curr.x), z: curr.z + t * (next.z - curr.z) };
      sideA.push(pt); sideB.push(pt);
    }
  }
  return [sideA, sideB];
}

function makeWalls(f3d) {
  const pos = [], uvs = [];
  const n = f3d.length;
  let uOffset = 0;
  for (let i = 0; i < n; i++) {
    const a = f3d[i], b = f3d[(i + 1) % n];
    const segLen = Math.hypot(b.x - a.x, b.z - a.z);
    const u0 = uOffset, u1 = uOffset + segLen;
    pos.push(a.x, 0, a.z,  b.x, 0, b.z,  b.x, WALL_TOP, b.z);
    uvs.push(u0, 0,  u1, 0,  u1, WALL_TOP);
    pos.push(a.x, 0, a.z,  b.x, WALL_TOP, b.z,  a.x, WALL_TOP, a.z);
    uvs.push(u0, 0,  u1, WALL_TOP,  u0, WALL_TOP);
    uOffset = u1;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: WALL_TEX, side: THREE.DoubleSide }));
}

function makeRoof(f3d, pitchDeg, isFlat, ridgeAlongXOverride = null) {
  const xs = f3d.map(p => p.x), zs = f3d.map(p => p.z);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const W = maxX - minX, D = maxZ - minZ;
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  const span = Math.min(W, D);
  const h = isFlat ? 0 : (span / 2) * Math.tan((pitchDeg * Math.PI) / 180);
  const pos = [], uvs = [];

  if (isFlat || h < 0.01) {
    fanTriangulate(f3d, () => WALL_H, pos, uvs);
  } else {
    const ridgeAlongX = ridgeAlongXOverride ?? (W >= D);
    function roofHeight(x, z) {
      const dist = ridgeAlongX ? Math.abs(z - cz) : Math.abs(x - cx);
      return WALL_H + h * Math.max(0, 1 - dist / (span / 2));
    }
    const [sideA, sideB] = splitPolygon(f3d, ridgeAlongX ? 'z' : 'x', ridgeAlongX ? cz : cx);
    fanTriangulate(sideA, roofHeight, pos, uvs);
    fanTriangulate(sideB, roofHeight, pos, uvs);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: ROOF_TEX, side: THREE.DoubleSide }));
}

function inferRidgeAlongX(segments) {
  if (!segments || !segments.length) return null;
  const dom = segments.reduce((b, s) => s.areaM2 > b.areaM2 ? s : b, segments[0]);
  const azRad = dom.azimuthDeg * Math.PI / 180;
  return Math.abs(Math.cos(azRad)) >= Math.abs(Math.sin(azRad));
}

// ── Solar-API-based roof geometry ────────────────────────────────────────────

function segHeightAbsolute(x, z, seg) {
  const azRad    = seg.azimuthDeg * Math.PI / 180;
  const pitchRad = seg.pitchDeg   * Math.PI / 180;
  const downSlope = (x - seg.centerX) * Math.sin(azRad)
                  + (z - seg.centerZ) * (-Math.cos(azRad));
  return seg.heightM - downSlope * Math.tan(pitchRad);
}

// Convex hull (Andrew's monotone chain) — returns CCW polygon
function convexHull(points) {
  if (points.length < 3) return points.slice();
  const pts = points.slice().sort((a, b) => a.x - b.x || a.z - b.z);
  const cross = (o, a, b) => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);

  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0)
      lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0)
      upper.pop();
    upper.push(p);
  }
  lower.pop(); upper.pop();
  return lower.concat(upper);
}

// 2D cross product for Sutherland-Hodgman clipping
function cross2D(a, b, p) {
  return (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x);
}

// Clip subject polygon by a convex clip polygon using Sutherland-Hodgman
function clipPolyByConvex(subject, clip) {
  let output = subject.slice();
  for (let i = 0; i < clip.length; i++) {
    if (output.length === 0) return [];
    const a = clip[i], b = clip[(i + 1) % clip.length];
    const input = output;
    output = [];
    for (let j = 0; j < input.length; j++) {
      const curr = input[j], next = input[(j + 1) % input.length];
      const dC = cross2D(a, b, curr);
      const dN = cross2D(a, b, next);
      if (dC >= -1e-10) output.push(curr);
      if ((dC > 0 && dN < 0) || (dC < 0 && dN > 0)) {
        const t = dC / (dC - dN);
        output.push({
          x: curr.x + t * (next.x - curr.x),
          z: curr.z + t * (next.z - curr.z),
        });
      }
    }
  }
  return output;
}

// Compute convex hull of ALL panel positions — the true roof outline
let currentRoofOutline = null;

function computeRoofOutline(panels) {
  if (!panels || panels.length < 3) return null;
  const pts = panels.map(p => ({ x: p.x, z: p.y }));
  const hull = convexHull(pts);
  if (hull.length < 3) return null;
  // Pad outward by ~1m so the roof extends slightly past the outermost panels
  const cx = hull.reduce((s, p) => s + p.x, 0) / hull.length;
  const cz = hull.reduce((s, p) => s + p.z, 0) / hull.length;
  const PAD = 1.2;
  return hull.map(p => {
    const dx = p.x - cx, dz = p.z - cz;
    const len = Math.hypot(dx, dz) || 1;
    return { x: p.x + (dx / len) * PAD, z: p.z + (dz / len) * PAD };
  });
}

// Segment polygon: full bbox clipped to the overall roof outline.
function segPoly(segIndex, seg) {
  if (!seg.bbox) return null;

  const minX = Math.min(seg.bbox.sw.x, seg.bbox.ne.x);
  const maxX = Math.max(seg.bbox.sw.x, seg.bbox.ne.x);
  const minZ = Math.min(seg.bbox.sw.y, seg.bbox.ne.y);
  const maxZ = Math.max(seg.bbox.sw.y, seg.bbox.ne.y);
  if (minX >= maxX || minZ >= maxZ) return null;

  let poly = [
    { x: minX, z: minZ }, { x: maxX, z: minZ },
    { x: maxX, z: maxZ }, { x: minX, z: maxZ },
  ];

  // Clip against overall roof outline (convex hull of all panels)
  if (currentRoofOutline && currentRoofOutline.length >= 3) {
    poly = clipPolyByConvex(poly, currentRoofOutline);
  }

  return poly.length >= 3 ? poly : null;
}

function computeHeightOffset(segments) {
  let minH = Infinity;
  for (let i = 0; i < segments.length; i++) {
    const poly = segPoly(i, segments[i]);
    if (!poly) continue;
    for (const pt of poly) {
      const h = segHeightAbsolute(pt.x, pt.z, segments[i]);
      if (h < minH) minH = h;
    }
  }
  return isFinite(minH) ? WALL_H - minH : 0;
}

function makeRoofFromSolar(segments, heightOffset) {
  const pos = [], uvs = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const poly = segPoly(i, seg);
    if (!poly || poly.length < 3) continue;
    fanTriangulate(poly, (x, z) => segHeightAbsolute(x, z, seg) + heightOffset, pos, uvs);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: ROOF_TEX, side: THREE.DoubleSide, flatShading: true }));
}

// ── Build / rebuild ──────────────────────────────────────────────────────────

function rebuildBuilding(pitchDeg, isFlat) {
  ['roof', 'walls'].forEach(name => {
    const obj = scene.getObjectByName(name);
    if (obj) { obj.geometry.dispose(); obj.material.dispose(); scene.remove(obj); }
  });
  const walls = makeWalls(footprint3d); walls.name = 'walls'; scene.add(walls);

  // Compute roof outline from all panels before building segments
  currentRoofOutline = computeRoofOutline(currentPanels);

  const hasSolarGeom = currentSegments?.length > 0 && currentSegments.some(s => s.bbox);

  if (hasSolarGeom && !isFlat) {
    const heightOffset = computeHeightOffset(currentSegments);
    const roof = makeRoofFromSolar(currentSegments, heightOffset);
    roof.name = 'roof'; scene.add(roof);

    roofHeightFn = (x, z, segOverride) => {
      const seg = segOverride || currentSegments.reduce((b, s) => {
        const d = Math.hypot(x - s.centerX, z - s.centerZ);
        return d < Math.hypot(x - b.centerX, z - b.centerZ) ? s : b;
      }, currentSegments[0]);
      return segHeightAbsolute(x, z, seg) + heightOffset + 0.05;
    };
  } else {
    const ridgeAlongXOverride = inferRidgeAlongX(currentSegments);
    const roof = makeRoof(footprint3d, pitchDeg, isFlat, ridgeAlongXOverride);
    roof.name = 'roof'; scene.add(roof);

    const xs = footprint3d.map(p => p.x), zs = footprint3d.map(p => p.z);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minZ = Math.min(...zs), maxZ = Math.max(...zs);
    const W = maxX - minX, D = maxZ - minZ;
    const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
    const span = Math.min(W, D);
    const h = isFlat ? 0 : (span / 2) * Math.tan((pitchDeg * Math.PI) / 180);
    const ridgeAlongX = ridgeAlongXOverride ?? (W >= D);
    roofHeightFn = (x, z) => {
      if (isFlat || h < 0.01) return WALL_H + 0.05;
      const dist = ridgeAlongX ? Math.abs(z - cz) : Math.abs(x - cx);
      return WALL_H + h * Math.max(0, 1 - dist / (span / 2)) + 0.05;
    };
  }
}

// ── Panel slots ──────────────────────────────────────────────────────────────

const placedMeshes = new Map();

function segmentAxes(seg) {
  const azRad    = seg.azimuthDeg  * Math.PI / 180;
  const pitchRad = seg.pitchDeg    * Math.PI / 180;
  const uDir = new THREE.Vector3(-Math.cos(azRad), 0, -Math.sin(azRad));
  const vDir = new THREE.Vector3(
    -Math.cos(pitchRad) * Math.sin(azRad),
     Math.sin(pitchRad),
     Math.cos(pitchRad) * Math.cos(azRad)
  );
  const normal = new THREE.Vector3(
    Math.sin(pitchRad) * Math.sin(azRad),
    Math.cos(pitchRad),
   -Math.cos(azRad)    * Math.sin(pitchRad)
  );
  return { uDir, vDir, normal };
}

function clearSlots() {
  slotMeshes.forEach(m => { m.geometry.dispose(); m.material.dispose(); scene.remove(m); });
  slotMeshes = [];
  placedSet.clear();
  placedMeshes.forEach(m => { m.geometry.dispose(); m.material.dispose(); scene.remove(m); });
  placedMeshes.clear();
  if (ghostMesh) ghostMesh.visible = false;
  hoveredIdx = null;
  updateStats();
}

function buildSlots(solarData) {
  clearSlots();
  const { panels, segments } = solarData;
  if (!panels.length) return;

  panels.forEach((panel, idx) => {
    const seg = segments[panel.segmentIndex] ?? segments[0];
    if (!seg) return;

    const isLandscape = panel.orientation !== 'PORTRAIT';
    const pw = isLandscape ? PANEL_W : PANEL_H;
    const ph = isLandscape ? PANEL_H : PANEL_W;

    const { uDir, vDir, normal } = segmentAxes(seg);

    // Use the panel's own segment for accurate height
    const py = roofHeightFn ? roofHeightFn(panel.x, panel.y, seg) : (WALL_H + 0.1);
    const pos = new THREE.Vector3(panel.x, py, panel.y)
      .addScaledVector(normal, 0.06);

    const geo = new THREE.PlaneGeometry(pw, ph);
    const mat = new THREE.MeshBasicMaterial({ visible: false }); // invisible anchor
    const mesh = new THREE.Mesh(geo, mat);

    mesh.quaternion.setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(uDir, vDir, normal)
    );
    mesh.position.copy(pos);
    mesh.userData = { idx, yearlyKwh: panel.yearlyKwh, normal: normal.clone(), pw, ph };

    scene.add(mesh);
    slotMeshes.push(mesh);
  });

  updateStats();
}

function setPlaced(idx, placed) {
  const slot = slotMeshes[idx];
  if (!slot) return;
  if (placed) {
    placedSet.add(idx);
    if (!placedMeshes.has(idx)) {
      const { pw, ph } = slot.userData;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), MAT_PLACED.clone());
      m.quaternion.copy(slot.quaternion);
      m.position.copy(slot.position);
      m.userData = { slotIdx: idx };
      scene.add(m);
      placedMeshes.set(idx, m);
    }
  } else {
    placedSet.delete(idx);
    const m = placedMeshes.get(idx);
    if (m) { m.geometry.dispose(); m.material.dispose(); scene.remove(m); placedMeshes.delete(idx); }
  }
}

function placeAll() {
  slotMeshes.forEach((_, i) => setPlaced(i, true));
  updateStats();
}

function clearPlaced() {
  slotMeshes.forEach((_, i) => setPlaced(i, false));
  updateStats();
}

function updateStats() {
  const placed = [...placedSet];
  const count  = placed.length;
  const kwh    = placed.reduce((s, i) => s + (slotMeshes[i]?.userData.yearlyKwh ?? 0), 0);
  document.getElementById('panel-count').textContent = `${count} panel${count !== 1 ? 's' : ''} placed`;
  document.getElementById('kwh-estimate').textContent =
    count > 0 ? `~${Math.round(kwh).toLocaleString()} kWh/year` : '';
}

// ── Public API ───────────────────────────────────────────────────────────────

window.initViewer = function (footprint, lat, lon, solarData) {
  if (animId) cancelAnimationFrame(animId);
  footprint3d = toScene(footprint);

  // Derive better wall outline from segment bboxes
  if (solarData?.segments?.length) {
    const derived = computeFootprintFromSegments(solarData.segments);
    if (derived) footprint3d = derived;
  }

  const container = document.getElementById('three-container');
  container.innerHTML = '';
  const W = 640, H = 480;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0f1117);

  camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 2000);
  camera.position.set(15, 20, 30);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const sun = new THREE.DirectionalLight(0xfff5e0, 1.1);
  sun.position.set(-10, 40, 20);
  scene.add(sun);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.target.set(0, WALL_H, 0);
  controls.update();

  // Ground — satellite texture
  const tex = new THREE.TextureLoader().load(`/api/satellite/image?lat=${lat}&lon=${lon}`);
  tex.colorSpace = THREE.SRGBColorSpace;
  const groundGeo = new THREE.PlaneGeometry(160, 160);
  groundGeo.rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(groundGeo, new THREE.MeshBasicMaterial({ map: tex }));
  ground.position.y = -0.05; ground.name = 'ground';
  scene.add(ground);

  currentSegments = solarData?.segments ?? null;
  currentPanels   = solarData?.panels  ?? null;
  ghostMesh = null; hoveredIdx = null; dragSourceIdx = null; pointerDownPos = null;

  // Seed pitch from dominant segment
  const slider     = document.getElementById('pitch-slider');
  const valueEl    = document.getElementById('pitch-value');
  const flatToggle = document.getElementById('flat-roof-toggle');
  const initPitch = (() => {
    if (!currentSegments?.length) return 27;
    const dom = currentSegments.reduce((b, s) => s.areaM2 > b.areaM2 ? s : b, currentSegments[0]);
    return Math.max(5, Math.min(60, Math.round(dom.pitchDeg)));
  })();
  slider.value = initPitch; valueEl.textContent = initPitch;
  flatToggle.checked = false; slider.disabled = false;

  // Hide pitch controls when Solar geometry is active
  const hasSolarGeomNow = currentSegments?.some(s => s.heightM != null);
  document.getElementById('roof-controls').hidden = !!hasSolarGeomNow;

  rebuildBuilding(initPitch, false);

  function onPitchChange() {
    const pitch  = parseInt(slider.value);
    const isFlat = flatToggle.checked;
    valueEl.textContent = pitch;
    slider.disabled = isFlat;
    rebuildBuilding(pitch, isFlat);
    if (solarData) buildSlots(solarData);
    else clearSlots();
  }
  slider.oninput = onPitchChange;
  flatToggle.onchange = onPitchChange;

  // ── Panel controls ────────────────────────────────────────────────────────

  const panelControls = document.getElementById('panel-controls');
  const statsBar      = document.getElementById('solar-stats-bar');
  panelControls.hidden = false;

  if (solarData) {
    const { stats } = solarData;
    statsBar.innerHTML =
      `<span class="solar-stat">Roof: <strong>${stats.roofAreaM2?.toFixed(0)} m²</strong></span>` +
      `<span class="solar-stat">Max slots: <strong>${stats.maxPanels}</strong></span>` +
      `<span class="solar-stat">Peak sun: <strong>${stats.maxSunshineHours?.toFixed(0)} hr/yr</strong></span>`;

    buildSlots(solarData);

    // AI Recommend button
    const recBtn = document.getElementById('recommended-btn');
    const reasoningEl = document.getElementById('ai-reasoning');
    recBtn.onclick = async () => {
      recBtn.disabled = true;
      recBtn.textContent = 'Analyzing...';
      reasoningEl.hidden = false;
      reasoningEl.innerHTML = '<span class="ai-summary">AI is analyzing your roof, satellite imagery, and solar data...</span>';
      try {
        const res = await fetch('/api/recommend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lat, lon,
            panels: solarData.panels,
            segments: solarData.segments,
            stats: solarData.stats,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Recommendation failed');
        reasoningEl.innerHTML = `<div class="ai-summary">${data.reasoning}</div>`;
      } catch (err) {
        reasoningEl.innerHTML = `<span class="ai-summary" style="color:#f87171">Recommendation failed: ${err.message}</span>`;
      } finally {
        recBtn.disabled = false;
        recBtn.textContent = 'AI Recommend';
      }
    };
    document.getElementById('fill-btn').onclick         = () => { placeAll(); };
    document.getElementById('clear-panels-btn').onclick  = () => { clearPlaced(); };
  } else {
    statsBar.innerHTML = '<span class="solar-stat meta">Solar API unavailable</span>';
    document.getElementById('recommended-btn').disabled = true;
    document.getElementById('fill-btn').disabled        = true;
  }

  // ── Pointer events: hover ghost + click to place/remove ───────────────────

  function getNDC(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    return {
      x:  ((e.clientX - rect.left) / rect.width)  * 2 - 1,
      y: -((e.clientY - rect.top)  / rect.height) * 2 + 1,
    };
  }

  function findNearestSlot(ndcX, ndcY) {
    pointer.set(ndcX, ndcY);
    raycaster.setFromCamera(pointer, camera);
    const roofObj = scene.getObjectByName('roof');
    if (!roofObj || !slotMeshes.length) return null;
    const hits = raycaster.intersectObject(roofObj);
    if (!hits.length) return null;
    const pt = hits[0].point;
    let bestIdx = null, bestDist = Infinity;
    slotMeshes.forEach((m, i) => {
      const d = m.position.distanceTo(pt);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    });
    return bestDist < 2.5 ? bestIdx : null;
  }

  function updateGhost(idx) {
    hoveredIdx = idx;
    if (idx === null) {
      if (ghostMesh) ghostMesh.visible = false;
      renderer.domElement.style.cursor = '';
      return;
    }
    const slot = slotMeshes[idx];
    const { pw, ph } = slot.userData;
    if (!ghostMesh) {
      ghostMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), MAT_GHOST.clone());
      scene.add(ghostMesh);
    }
    ghostMesh.geometry.dispose();
    ghostMesh.geometry = new THREE.PlaneGeometry(pw, ph);
    ghostMesh.quaternion.copy(slot.quaternion);
    ghostMesh.position.copy(slot.position);
    ghostMesh.material.color.set(placedSet.has(idx) ? 0xff6b6b : 0xf9c846);
    ghostMesh.visible = true;
    renderer.domElement.style.cursor = 'pointer';
  }

  renderer.domElement.addEventListener('pointermove', (e) => {
    if (!slotMeshes.length) return;
    const { x, y } = getNDC(e);
    updateGhost(findNearestSlot(x, y));
  });

  renderer.domElement.addEventListener('pointerdown', (e) => {
    if (!slotMeshes.length) return;
    pointerDownPos = { x: e.clientX, y: e.clientY };

    const { x, y } = getNDC(e);
    pointer.set(x, y);
    raycaster.setFromCamera(pointer, camera);
    const placedArr = [...placedMeshes.values()];
    const hits = raycaster.intersectObjects(placedArr);
    if (hits.length > 0) {
      const slotIdx = hits[0].object.userData.slotIdx;
      dragSourceIdx = slotIdx;
      setPlaced(slotIdx, false);
      controls.enabled = false;
      e.stopPropagation();
    }
  });

  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!slotMeshes.length) return;
    const moved = pointerDownPos
      ? Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y)
      : 999;
    const isClick = moved < 6;

    if (dragSourceIdx !== null) {
      const target = hoveredIdx ?? dragSourceIdx;
      setPlaced(target, true);
      dragSourceIdx = null;
      controls.enabled = true;
      updateStats();
    } else if (isClick && hoveredIdx !== null) {
      setPlaced(hoveredIdx, !placedSet.has(hoveredIdx));
      updateStats();
      if (ghostMesh && ghostMesh.visible) {
        ghostMesh.material.color.set(placedSet.has(hoveredIdx) ? 0xff6b6b : 0xf9c846);
      }
    }

    pointerDownPos = null;
  });

  // ── Render loop ───────────────────────────────────────────────────────────

  function animate() {
    animId = requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();
};
