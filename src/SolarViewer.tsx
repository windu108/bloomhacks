import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// ── Types ───────────────────────────────────────────────────────────────────

interface Panel {
  id: number;
  x: number;
  y: number;
  orientation: string;
  yearlyKwh: number;
  segmentIndex: number;
}

interface Segment {
  index: number;
  pitchDeg: number;
  azimuthDeg: number;
  areaM2: number;
  centerX: number;
  centerZ: number;
  heightM: number;
  bbox: { sw: { x: number; y: number }; ne: { x: number; y: number } } | null;
}

interface SolarData {
  stats: {
    maxPanels: number;
    roofAreaM2: number;
    maxSunshineHours: number;
    carbonKgPerMwh: number;
  };
  panels: Panel[];
  segments: Segment[];
  recommendedCount: number;
  buildingBbox: { sw: { x: number; y: number }; ne: { x: number; y: number } } | null;
}

interface SolarViewerProps {
  lat: number;
  lon: number;
  solarData: SolarData;
  onStatsChange?: (count: number, kwh: number) => void;
  onRecommend?: () => void;
}

// ── Constants ───────────────────────────────────────────────────────────────

const WALL_H = 2.5;
const WALL_TOP = WALL_H + 0.06;
const PANEL_W = 1.65;
const PANEL_H = 0.99;

// ── Procedural textures ─────────────────────────────────────────────────────

function makeShingleTexture() {
  const w = 256, h = 256;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
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
  const ctx = c.getContext('2d')!;
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

// ── Geometry helpers ────────────────────────────────────────────────────────

interface Point2D { x: number; z: number; }

function computeFootprintFromSegments(segments: Segment[]): Point2D[] | null {
  const rects: { minX: number; maxX: number; minZ: number; maxZ: number }[] = [];
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

  const at = (r: number, c: number) => (r >= 0 && r < rows && c >= 0 && c < cols) ? grid[r * cols + c] : 0;
  const edges: number[][] = [];
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

  const snap = (v: number) => Math.round(v * 1000);
  const key = (x: number, z: number) => `${snap(x)},${snap(z)}`;
  const adj = new Map<string, number[]>();
  edges.forEach((e, i) => {
    const k = key(e[0], e[1]);
    if (!adj.has(k)) adj.set(k, []);
    adj.get(k)!.push(i);
  });

  const used = new Set<number>();
  const points: Point2D[] = [];
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

  const result: Point2D[] = [];
  for (let i = 0; i < points.length; i++) {
    const prev = points[(i - 1 + points.length) % points.length];
    const curr = points[i];
    const next = points[(i + 1) % points.length];
    const cross = (curr.x - prev.x) * (next.z - curr.z) - (curr.z - prev.z) * (next.x - curr.x);
    if (Math.abs(cross) > 0.001) result.push(curr);
  }

  return result.length >= 3 ? result : null;
}

function convexHull(points: Point2D[]): Point2D[] {
  if (points.length < 3) return points.slice();
  const pts = points.slice().sort((a, b) => a.x - b.x || a.z - b.z);
  const cross = (o: Point2D, a: Point2D, b: Point2D) =>
    (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);

  const lower: Point2D[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0)
      lower.pop();
    lower.push(p);
  }
  const upper: Point2D[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0)
      upper.pop();
    upper.push(p);
  }
  lower.pop(); upper.pop();
  return lower.concat(upper);
}

function cross2D(a: Point2D, b: Point2D, p: Point2D) {
  return (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x);
}

function clipPolyByConvex(subject: Point2D[], clip: Point2D[]): Point2D[] {
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

function computeRoofOutline(panels: Panel[]): Point2D[] | null {
  if (!panels || panels.length < 3) return null;
  const pts = panels.map(p => ({ x: p.x, z: p.y }));
  const hull = convexHull(pts);
  if (hull.length < 3) return null;
  const cx = hull.reduce((s, p) => s + p.x, 0) / hull.length;
  const cz = hull.reduce((s, p) => s + p.z, 0) / hull.length;
  const PAD = 1.2;
  return hull.map(p => {
    const dx = p.x - cx, dz = p.z - cz;
    const len = Math.hypot(dx, dz) || 1;
    return { x: p.x + (dx / len) * PAD, z: p.z + (dz / len) * PAD };
  });
}

function segHeightAbsolute(x: number, z: number, seg: Segment) {
  const azRad = seg.azimuthDeg * Math.PI / 180;
  const pitchRad = seg.pitchDeg * Math.PI / 180;
  const downSlope = (x - seg.centerX) * Math.sin(azRad) + (z - seg.centerZ) * (-Math.cos(azRad));
  return seg.heightM - downSlope * Math.tan(pitchRad);
}

function fanTriangulate(poly: Point2D[], heightFn: (x: number, z: number) => number, pos: number[], uvs: number[]) {
  if (poly.length < 3) return;
  const cx = poly.reduce((s, p) => s + p.x, 0) / poly.length;
  const cz = poly.reduce((s, p) => s + p.z, 0) / poly.length;
  const cy = heightFn(cx, cz);
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    pos.push(cx, cy, cz, a.x, heightFn(a.x, a.z), a.z, b.x, heightFn(b.x, b.z), b.z);
    uvs.push(cx, cz, a.x, a.z, b.x, b.z);
  }
}

// ── React Component ─────────────────────────────────────────────────────────

export default function SolarViewer({ lat, lon, solarData, onStatsChange }: SolarViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
    animId: number;
    slotMeshes: THREE.Mesh[];
    placedSet: Set<number>;
    placedMeshes: Map<number, THREE.Mesh>;
    ghostMesh: THREE.Mesh | null;
    hoveredIdx: number | null;
    dragSourceIdx: number | null;
    pointerDownPos: { x: number; y: number } | null;
    roofHeightFn: ((x: number, z: number, seg?: Segment) => number) | null;
    currentRoofOutline: Point2D[] | null;
  } | null>(null);

  const MAT_PLACED = useRef(new THREE.MeshLambertMaterial({ color: 0x1a3a5c, transparent: true, opacity: 0.92, depthWrite: false, side: THREE.DoubleSide }));
  const MAT_GHOST = useRef(new THREE.MeshLambertMaterial({ color: 0xf9c846, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide }));

  const onStatsChangeRef = useRef(onStatsChange);
  onStatsChangeRef.current = onStatsChange;

  const updateStats = useCallback(() => {
    const s = sceneRef.current;
    if (!s) return;
    const placed = [...s.placedSet];
    const count = placed.length;
    const kwh = placed.reduce((sum, i) => sum + (s.slotMeshes[i]?.userData.yearlyKwh ?? 0), 0);
    onStatsChangeRef.current?.(count, kwh);
  }, []);

  const setPlaced = useCallback((idx: number, placed: boolean) => {
    const s = sceneRef.current;
    if (!s) return;
    const slot = s.slotMeshes[idx];
    if (!slot) return;
    if (placed) {
      s.placedSet.add(idx);
      if (!s.placedMeshes.has(idx)) {
        const { pw, ph } = slot.userData;
        const m = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), MAT_PLACED.current.clone());
        m.quaternion.copy(slot.quaternion);
        m.position.copy(slot.position);
        m.userData = { slotIdx: idx };
        s.scene.add(m);
        s.placedMeshes.set(idx, m);
      }
    } else {
      s.placedSet.delete(idx);
      const m = s.placedMeshes.get(idx);
      if (m) { m.geometry.dispose(); m.material.dispose(); s.scene.remove(m); s.placedMeshes.delete(idx); }
    }
  }, []);

  const placeAll = useCallback(() => {
    const s = sceneRef.current;
    if (!s) return;
    s.slotMeshes.forEach((_, i) => setPlaced(i, true));
    updateStats();
  }, [setPlaced, updateStats]);

  const clearPlaced = useCallback(() => {
    const s = sceneRef.current;
    if (!s) return;
    s.slotMeshes.forEach((_, i) => setPlaced(i, false));
    updateStats();
  }, [setPlaced, updateStats]);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    container.innerHTML = '';

    const W = 640, H = 480;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f1117);

    const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 2000);
    camera.position.set(15, 20, 30);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const sun = new THREE.DirectionalLight(0xfff5e0, 1.1);
    sun.position.set(-10, 40, 20);
    scene.add(sun);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.target.set(0, WALL_H, 0);
    controls.update();

    // Ground with satellite texture
    const tex = new THREE.TextureLoader().load(`/api/satellite/image?lat=${lat}&lon=${lon}`);
    tex.colorSpace = THREE.SRGBColorSpace;
    const groundGeo = new THREE.PlaneGeometry(160, 160);
    groundGeo.rotateX(-Math.PI / 2);
    const ground = new THREE.Mesh(groundGeo, new THREE.MeshBasicMaterial({ map: tex }));
    ground.position.y = -0.05; ground.name = 'ground';
    scene.add(ground);

    const ROOF_TEX = makeShingleTexture();
    const WALL_TEX = makeSidingTexture();

    const { segments, panels } = solarData;

    // Derive footprint
    let footprint3d: Point2D[];
    const derived = computeFootprintFromSegments(segments);
    if (derived) {
      footprint3d = derived;
    } else if (solarData.buildingBbox) {
      const { sw, ne } = solarData.buildingBbox;
      footprint3d = [
        { x: sw.x, z: sw.y }, { x: ne.x, z: sw.y },
        { x: ne.x, z: ne.y }, { x: sw.x, z: ne.y },
      ];
    } else {
      footprint3d = [{ x: -5, z: -5 }, { x: 5, z: -5 }, { x: 5, z: 5 }, { x: -5, z: 5 }];
    }

    // Roof outline
    const roofOutline = computeRoofOutline(panels);

    // Build segment polys
    function segPoly(seg: Segment): Point2D[] | null {
      if (!seg.bbox) return null;
      const minX = Math.min(seg.bbox.sw.x, seg.bbox.ne.x);
      const maxX = Math.max(seg.bbox.sw.x, seg.bbox.ne.x);
      const minZ = Math.min(seg.bbox.sw.y, seg.bbox.ne.y);
      const maxZ = Math.max(seg.bbox.sw.y, seg.bbox.ne.y);
      if (minX >= maxX || minZ >= maxZ) return null;
      let poly: Point2D[] = [
        { x: minX, z: minZ }, { x: maxX, z: minZ },
        { x: maxX, z: maxZ }, { x: minX, z: maxZ },
      ];
      if (roofOutline && roofOutline.length >= 3) {
        poly = clipPolyByConvex(poly, roofOutline);
      }
      return poly.length >= 3 ? poly : null;
    }

    // Walls
    const wallPos: number[] = [], wallUvs: number[] = [];
    let uOffset = 0;
    for (let i = 0; i < footprint3d.length; i++) {
      const a = footprint3d[i], b = footprint3d[(i + 1) % footprint3d.length];
      const segLen = Math.hypot(b.x - a.x, b.z - a.z);
      const u0 = uOffset, u1 = uOffset + segLen;
      wallPos.push(a.x, 0, a.z, b.x, 0, b.z, b.x, WALL_TOP, b.z);
      wallUvs.push(u0, 0, u1, 0, u1, WALL_TOP);
      wallPos.push(a.x, 0, a.z, b.x, WALL_TOP, b.z, a.x, WALL_TOP, a.z);
      wallUvs.push(u0, 0, u1, WALL_TOP, u0, WALL_TOP);
      uOffset = u1;
    }
    const wallGeo = new THREE.BufferGeometry();
    wallGeo.setAttribute('position', new THREE.Float32BufferAttribute(wallPos, 3));
    wallGeo.setAttribute('uv', new THREE.Float32BufferAttribute(wallUvs, 2));
    wallGeo.computeVertexNormals();
    const walls = new THREE.Mesh(wallGeo, new THREE.MeshLambertMaterial({ map: WALL_TEX, side: THREE.DoubleSide }));
    walls.name = 'walls';
    scene.add(walls);

    // Roof from solar segments
    const hasSolarGeom = segments.length > 0 && segments.some(s => s.bbox);
    let roofHeightFn: ((x: number, z: number, seg?: Segment) => number) | null = null;

    if (hasSolarGeom) {
      // Compute height offset
      let minH = Infinity;
      for (const seg of segments) {
        const poly = segPoly(seg);
        if (!poly) continue;
        for (const pt of poly) {
          const h = segHeightAbsolute(pt.x, pt.z, seg);
          if (h < minH) minH = h;
        }
      }
      const heightOffset = isFinite(minH) ? WALL_H - minH : 0;

      // Build roof geometry
      const roofPos: number[] = [], roofUvs: number[] = [];
      for (const seg of segments) {
        const poly = segPoly(seg);
        if (!poly || poly.length < 3) continue;
        fanTriangulate(poly, (x, z) => segHeightAbsolute(x, z, seg) + heightOffset, roofPos, roofUvs);
      }
      const roofGeo = new THREE.BufferGeometry();
      roofGeo.setAttribute('position', new THREE.Float32BufferAttribute(roofPos, 3));
      roofGeo.setAttribute('uv', new THREE.Float32BufferAttribute(roofUvs, 2));
      roofGeo.computeVertexNormals();
      const roof = new THREE.Mesh(roofGeo, new THREE.MeshLambertMaterial({ map: ROOF_TEX, side: THREE.DoubleSide, flatShading: true }));
      roof.name = 'roof';
      scene.add(roof);

      roofHeightFn = (x: number, z: number, segOverride?: Segment) => {
        const seg = segOverride || segments.reduce((b, s) => {
          const d = Math.hypot(x - s.centerX, z - s.centerZ);
          return d < Math.hypot(x - b.centerX, z - b.centerZ) ? s : b;
        }, segments[0]);
        return segHeightAbsolute(x, z, seg) + heightOffset + 0.05;
      };
    } else {
      // Simple gabled roof fallback
      const xs = footprint3d.map(p => p.x), zs = footprint3d.map(p => p.z);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minZ = Math.min(...zs), maxZ = Math.max(...zs);
      const W = maxX - minX, D = maxZ - minZ;
      const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
      const span = Math.min(W, D);
      const h = (span / 2) * Math.tan((27 * Math.PI) / 180);
      const ridgeAlongX = W >= D;

      function splitPolygon(poly: Point2D[], axis: 'x' | 'z', value: number) {
        const sideA: Point2D[] = [], sideB: Point2D[] = [];
        const n = poly.length;
        for (let i = 0; i < n; i++) {
          const curr = poly[i], next = poly[(i + 1) % n];
          const cv = axis === 'z' ? curr.z : curr.x;
          const nv = axis === 'z' ? next.z : next.x;
          if (cv < value) sideA.push(curr);
          else if (cv > value) sideB.push(curr);
          else { sideA.push(curr); sideB.push(curr); }
          if ((cv < value && nv > value) || (cv > value && nv < value)) {
            const t = (value - cv) / (nv - cv);
            const pt = { x: curr.x + t * (next.x - curr.x), z: curr.z + t * (next.z - curr.z) };
            sideA.push(pt); sideB.push(pt);
          }
        }
        return [sideA, sideB];
      }

      function roofHeight(x: number, z: number) {
        const dist = ridgeAlongX ? Math.abs(z - cz) : Math.abs(x - cx);
        return WALL_H + h * Math.max(0, 1 - dist / (span / 2));
      }
      const [sideA, sideB] = splitPolygon(footprint3d, ridgeAlongX ? 'z' : 'x', ridgeAlongX ? cz : cx);
      const roofPos: number[] = [], roofUvs: number[] = [];
      fanTriangulate(sideA, roofHeight, roofPos, roofUvs);
      fanTriangulate(sideB, roofHeight, roofPos, roofUvs);
      const roofGeo = new THREE.BufferGeometry();
      roofGeo.setAttribute('position', new THREE.Float32BufferAttribute(roofPos, 3));
      roofGeo.setAttribute('uv', new THREE.Float32BufferAttribute(roofUvs, 2));
      roofGeo.computeVertexNormals();
      const roof = new THREE.Mesh(roofGeo, new THREE.MeshLambertMaterial({ map: ROOF_TEX, side: THREE.DoubleSide }));
      roof.name = 'roof';
      scene.add(roof);

      roofHeightFn = (x: number, z: number) => {
        const dist = ridgeAlongX ? Math.abs(z - cz) : Math.abs(x - cx);
        return WALL_H + h * Math.max(0, 1 - dist / (span / 2)) + 0.05;
      };
    }

    // Panel slots
    const slotMeshes: THREE.Mesh[] = [];
    const placedSet = new Set<number>();
    const placedMeshes = new Map<number, THREE.Mesh>();

    panels.forEach((panel, idx) => {
      const seg = segments[panel.segmentIndex] ?? segments[0];
      if (!seg) return;

      const isLandscape = panel.orientation !== 'PORTRAIT';
      const pw = isLandscape ? PANEL_W : PANEL_H;
      const ph = isLandscape ? PANEL_H : PANEL_W;

      const azRad = seg.azimuthDeg * Math.PI / 180;
      const pitchRad = seg.pitchDeg * Math.PI / 180;
      const uDir = new THREE.Vector3(-Math.cos(azRad), 0, -Math.sin(azRad));
      const vDir = new THREE.Vector3(
        -Math.cos(pitchRad) * Math.sin(azRad),
        Math.sin(pitchRad),
        Math.cos(pitchRad) * Math.cos(azRad)
      );
      const normal = new THREE.Vector3(
        Math.sin(pitchRad) * Math.sin(azRad),
        Math.cos(pitchRad),
        -Math.cos(azRad) * Math.sin(pitchRad)
      );

      const py = roofHeightFn ? roofHeightFn(panel.x, panel.y, seg) : (WALL_H + 0.1);
      const pos = new THREE.Vector3(panel.x, py, panel.y).addScaledVector(normal, 0.06);

      const geo = new THREE.PlaneGeometry(pw, ph);
      const mat = new THREE.MeshBasicMaterial({ visible: false });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(uDir, vDir, normal));
      mesh.position.copy(pos);
      mesh.userData = { idx, yearlyKwh: panel.yearlyKwh, normal: normal.clone(), pw, ph };

      scene.add(mesh);
      slotMeshes.push(mesh);
    });

    // Ghost mesh
    let ghostMesh: THREE.Mesh | null = null;
    let hoveredIdx: number | null = null;
    let dragSourceIdx: number | null = null;
    let pointerDownPos: { x: number; y: number } | null = null;

    const state = {
      scene, camera, renderer, controls,
      animId: 0,
      slotMeshes, placedSet, placedMeshes,
      ghostMesh, hoveredIdx, dragSourceIdx, pointerDownPos,
      roofHeightFn,
      currentRoofOutline: roofOutline,
    };
    sceneRef.current = state;

    // Pointer events
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    function getNDC(e: PointerEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
        y: -((e.clientY - rect.top) / rect.height) * 2 + 1,
      };
    }

    function findNearestSlot(ndcX: number, ndcY: number) {
      pointer.set(ndcX, ndcY);
      raycaster.setFromCamera(pointer, camera);
      const roofObj = scene.getObjectByName('roof');
      if (!roofObj || !slotMeshes.length) return null;
      const hits = raycaster.intersectObject(roofObj);
      if (!hits.length) return null;
      const pt = hits[0].point;
      let bestIdx: number | null = null, bestDist = Infinity;
      slotMeshes.forEach((m, i) => {
        const d = m.position.distanceTo(pt);
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      });
      return bestDist < 2.5 ? bestIdx : null;
    }

    function updateGhost(idx: number | null) {
      state.hoveredIdx = idx;
      if (idx === null) {
        if (state.ghostMesh) state.ghostMesh.visible = false;
        renderer.domElement.style.cursor = '';
        return;
      }
      const slot = slotMeshes[idx];
      const { pw, ph } = slot.userData;
      if (!state.ghostMesh) {
        state.ghostMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), MAT_GHOST.current.clone());
        scene.add(state.ghostMesh);
      }
      state.ghostMesh.geometry.dispose();
      state.ghostMesh.geometry = new THREE.PlaneGeometry(pw, ph);
      state.ghostMesh.quaternion.copy(slot.quaternion);
      state.ghostMesh.position.copy(slot.position);
      (state.ghostMesh.material as THREE.MeshLambertMaterial).color.set(placedSet.has(idx) ? 0xff6b6b : 0xf9c846);
      state.ghostMesh.visible = true;
      renderer.domElement.style.cursor = 'pointer';
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!slotMeshes.length) return;
      const { x, y } = getNDC(e);
      updateGhost(findNearestSlot(x, y));
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!slotMeshes.length) return;
      state.pointerDownPos = { x: e.clientX, y: e.clientY };
      const { x, y } = getNDC(e);
      pointer.set(x, y);
      raycaster.setFromCamera(pointer, camera);
      const placedArr = [...placedMeshes.values()];
      const hits = raycaster.intersectObjects(placedArr);
      if (hits.length > 0) {
        const slotIdx = hits[0].object.userData.slotIdx;
        state.dragSourceIdx = slotIdx;
        setPlaced(slotIdx, false);
        controls.enabled = false;
        e.stopPropagation();
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!slotMeshes.length) return;
      const moved = state.pointerDownPos
        ? Math.hypot(e.clientX - state.pointerDownPos.x, e.clientY - state.pointerDownPos.y)
        : 999;
      const isClick = moved < 6;

      if (state.dragSourceIdx !== null) {
        const target = state.hoveredIdx ?? state.dragSourceIdx;
        setPlaced(target, true);
        state.dragSourceIdx = null;
        controls.enabled = true;
        updateStats();
      } else if (isClick && state.hoveredIdx !== null) {
        setPlaced(state.hoveredIdx, !placedSet.has(state.hoveredIdx));
        updateStats();
        if (state.ghostMesh && state.ghostMesh.visible) {
          (state.ghostMesh.material as THREE.MeshLambertMaterial).color.set(
            placedSet.has(state.hoveredIdx) ? 0xff6b6b : 0xf9c846
          );
        }
      }
      state.pointerDownPos = null;
    };

    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    // Render loop
    function animate() {
      state.animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(state.animId);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.dispose();
      controls.dispose();
      scene.clear();
      sceneRef.current = null;
    };
  }, [lat, lon, solarData, setPlaced, updateStats]);

  // Expose placeAll/clearPlaced on the container element for external use
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    (el as any)._placeAll = placeAll;
    (el as any)._clearPlaced = clearPlaced;
  }, [placeAll, clearPlaced]);

  return <div ref={containerRef} style={{ width: 640, height: 480 }} />;
}

// Expose control functions
export function getViewerControls(ref: React.RefObject<HTMLDivElement | null>) {
  const el = ref.current;
  if (!el) return null;
  return {
    placeAll: (el as any)._placeAll as () => void,
    clearPlaced: (el as any)._clearPlaced as () => void,
  };
}
