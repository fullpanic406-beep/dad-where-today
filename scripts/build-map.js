// 서울 25개 구 지도(SVG path) → public/seoul-map.json
// 원자료: 통계청 SGIS 행정구역경계 2018 시군구(공공누리 제1유형), southkorea/southkorea-maps 의 TopoJSON 원본(단순화 전).
// 이웃한 구가 경계선(arc)을 같이 쓰므로, 경계선마다 한 번씩만 다듬으면 구와 구 사이에 틈·겹침이 생기지 않는다.
// 다듬기: ① Douglas-Peucker 로 계단 모양 점을 줄이고 ② Chaikin 곡선으로 모서리를 둥글게(경계선 양 끝점은 고정).
// 사용: node scripts/build-map.js   (결과는 저장소에 올리므로 서버 수집 때는 다시 만들지 않는다)
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const URL = 'https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2018/json/skorea-municipalities-2018-topo.json';
const topo = await (await fetch(URL)).json();
const { scale, translate } = topo.transform;

// 1) arc 해제 (증분 인코딩)
const arcs = topo.arcs.map(arc => { let x = 0, y = 0; return arc.map(([dx, dy]) => { x += dx; y += dy; return [x * scale[0] + translate[0], y * scale[1] + translate[1]]; }); });

// 2) 경도·위도 → 평면(경도 보정)
const geoms = Object.values(topo.objects)[0].geometries.filter(g => String(g.properties.code).startsWith('11'));
let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
const used = new Set();
for (const g of geoms) for (const poly of g.type === 'Polygon' ? [g.arcs] : g.arcs) for (const ring of poly) for (const i of ring) used.add(i >= 0 ? i : ~i);
for (const i of used) for (const [x, y] of arcs[i]) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
const kx = Math.cos(((minY + maxY) / 2) * Math.PI / 180);
const W = 600, S = W / ((maxX - minX) * kx), H = Math.round((maxY - minY) * S);
const proj = ([x, y]) => [(x - minX) * kx * S, (maxY - y) * S];

// 3) 다듬기
function dp(pts, eps) { // Douglas-Peucker
  if (pts.length < 3) return pts;
  const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1];
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1e-9;
  let mi = 0, md = 0;
  for (let i = 1; i < pts.length - 1; i++) { const d = Math.abs(dy * (pts[i][0] - ax) - dx * (pts[i][1] - ay)) / len; if (d > md) { md = d; mi = i; } }
  if (md <= eps) return [pts[0], pts[pts.length - 1]];
  return [...dp(pts.slice(0, mi + 1), eps).slice(0, -1), ...dp(pts.slice(mi), eps)];
}
function chaikin(pts, n) { // 양 끝점 고정
  for (let k = 0; k < n; k++) {
    if (pts.length < 3) break;
    const o = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      o.push([.75 * x0 + .25 * x1, .75 * y0 + .25 * y1], [.25 * x0 + .75 * x1, .25 * y0 + .75 * y1]);
    }
    o.push(pts[pts.length - 1]); pts = o;
  }
  return pts;
}
const smooth = arcs.map(a => chaikin(dp(a.map(proj), 0.9), 2)); // 600 폭 기준 0.9px 이하 요철은 펴고 둥글게

// 4) 고리 조립 (뒤집힌 arc 는 역순)
const ringPts = idx => { const pts = []; for (const i of idx) { const a = i >= 0 ? smooth[i] : smooth[~i].slice().reverse(); for (let k = pts.length ? 1 : 0; k < a.length; k++) pts.push(a[k]); } return pts; };
const r1 = n => Math.round(n * 10) / 10;
const pathOf = pts => 'M' + pts.map(([x, y]) => `${r1(x)} ${r1(y)}`).join('L') + 'Z';

function area(pts) { let a = 0; for (let i = 0; i < pts.length - 1; i++) a += pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1]; return a / 2; }
function inside(pt, ring) { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if (yi > pt[1] !== yj > pt[1] && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) c = !c; } return c; }
const distSeg = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
function label(ring, holes) { // 경계에서 가장 멀리 떨어진 안쪽 점(글자가 구 안에 들어가도록)
  const xs = ring.map(p => p[0]), ys = ring.map(p => p[1]);
  let best = null;
  for (let x = Math.min(...xs); x <= Math.max(...xs); x += 2) for (let y = Math.min(...ys); y <= Math.max(...ys); y += 2) {
    if (!inside([x, y], ring) || holes.some(h => inside([x, y], h))) continue;
    let d = 1e9; for (const r of [ring, ...holes]) for (let i = 0; i < r.length - 1; i++) d = Math.min(d, distSeg([x, y], r[i], r[i + 1]));
    if (!best || d > best.d) best = { x, y, d };
  }
  return best;
}

const districts = geoms.map(g => {
  const polys = (g.type === 'Polygon' ? [g.arcs] : g.arcs).map(p => p.map(ringPts));
  let d = '', main = null;
  for (const poly of polys) {
    for (const r of poly) d += pathOf(r);
    const a = Math.abs(area(poly[0]));
    if (!main || a > main.a) main = { a, outer: poly[0], holes: poly.slice(1) };
  }
  const lb = label(main.outer, main.holes);
  // 가까운 순 정렬 기준점: 원래 경도·위도의 가장 큰 고리 무게중심
  const raw = (g.type === 'Polygon' ? [g.arcs] : g.arcs).map(p => p[0].map(i => i)).map(idx => { const pts = []; for (const i of idx) { const a = i >= 0 ? arcs[i] : arcs[~i].slice().reverse(); for (let k = pts.length ? 1 : 0; k < a.length; k++) pts.push(a[k]); } return pts; }).sort((a, b) => Math.abs(area(b)) - Math.abs(area(a)))[0];
  let A = 0, cx = 0, cy = 0; for (let i = 0; i < raw.length - 1; i++) { const c = raw[i][0] * raw[i + 1][1] - raw[i + 1][0] * raw[i][1]; A += c; cx += (raw[i][0] + raw[i + 1][0]) * c; cy += (raw[i][1] + raw[i + 1][1]) * c; }
  return { name: g.properties.name, d, cx: r1(lb.x), cy: r1(lb.y), lat: Math.round(cy / (3 * A) * 1e4) / 1e4, lng: Math.round(cx / (3 * A) * 1e4) / 1e4 };
}).sort((a, b) => a.name.localeCompare(b.name, 'ko'));

const out = JSON.stringify({ viewBox: `0 0 ${W} ${H}`, districts });
writeFileSync(path.join(root, 'public', 'seoul-map.json'), out);
console.log(`[map] ${districts.length}개 구, viewBox 0 0 ${W} ${H}, ${Math.round(out.length / 1024)}KB:`, districts.map(d => d.name).join(' '));
