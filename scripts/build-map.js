// data/seoul_geo.json (GeoJSON, 서울 25개 구) → public/seoul-map.json (SVG path)
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const geo = JSON.parse(readFileSync(path.join(root, 'data', 'seoul_geo.json'), 'utf8'));

const W = 600;
const rings = f => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates);

let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
for (const f of geo.features) for (const poly of rings(f)) for (const [x, y] of poly[0]) {
  minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
}
const kx = Math.cos(((minY + maxY) / 2) * Math.PI / 180); // 경도 보정
const scale = W / ((maxX - minX) * kx);
const H = Math.round((maxY - minY) * scale);
const px = x => ((x - minX) * kx * scale);
const py = y => ((maxY - y) * scale);
const r1 = n => Math.round(n * 10) / 10;

function area(ring) { // 부호 있는 면적 + 무게중심
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x0, y0] = ring[i], [x1, y1] = ring[i + 1];
    const c = x0 * y1 - x1 * y0;
    a += c; cx += (x0 + x1) * c; cy += (y0 + y1) * c;
  }
  a /= 2;
  return { a: Math.abs(a), cx: cx / (6 * a), cy: cy / (6 * a) };
}

const districts = geo.features.map(f => {
  let d = '', best = null;
  for (const poly of rings(f)) {
    const pts = poly[0].map(([x, y]) => [px(x), py(y)]);
    d += 'M' + pts.map(([x, y]) => `${r1(x)} ${r1(y)}`).join('L') + 'Z';
    const ar = area(pts);
    if (!best || ar.a > best.a) best = ar;
  }
  return { name: f.properties.name, d, cx: r1(best.cx), cy: r1(best.cy) };
}).sort((a, b) => a.name.localeCompare(b.name, 'ko'));

writeFileSync(path.join(root, 'public', 'seoul-map.json'), JSON.stringify({ viewBox: `0 0 ${W} ${H}`, districts }));
console.log(`[map] ${districts.length}개 구, viewBox 0 0 ${W} ${H}:`, districts.map(d => d.name).join(' '));
