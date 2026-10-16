// 서울·경기의 읍면동 경계 → data/dong-boundaries.json (행사·장소의 좌표로 '동'을 찾는 데 쓴다)
// 원자료: 통계청 통계지리정보서비스(SGIS) 행정구역 경계 2018 (공공누리 제1유형: 출처 표시, 상업적 이용 가능)
//         southkorea/southkorea-maps 의 TopoJSON 단순화본을 사용한다.
// 사용: node scripts/build-dong.js   (한 번 만들어 저장소에 올려 두면 되고, 수집 때마다 다시 받지 않는다)
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const BASE = 'https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2018/json/';
const get = async f => { const r = await fetch(BASE + f); if (!r.ok) throw new Error(`${f} ${r.status}`); return r.json(); };

// TopoJSON 해제 (arc 는 증분 인코딩 + transform)
function decode(topo) {
  const { scale, translate } = topo.transform;
  const arcs = topo.arcs.map(arc => { let x = 0, y = 0; return arc.map(([dx, dy]) => { x += dx; y += dy; return [x * scale[0] + translate[0], y * scale[1] + translate[1]]; }); });
  const ring = idx => {
    const pts = [];
    for (const i of idx) { const a = i >= 0 ? arcs[i] : arcs[~i].slice().reverse(); for (let k = pts.length ? 1 : 0; k < a.length; k++) pts.push(a[k]); }
    return pts;
  };
  return g => (g.type === 'Polygon' ? [g.arcs] : g.arcs).flatMap(poly => poly.map(ring)); // 모든 고리(구멍 포함)를 한 줄로 — 찾을 때 짝홀 규칙으로 처리
}

const [subTopo, muniTopo] = await Promise.all([get('skorea-submunicipalities-2018-topo-simple.json'), get('skorea-municipalities-2018-topo-simple.json')]);
const muni = Object.fromEntries(Object.values(muniTopo.objects)[0].geometries.map(g => [g.properties.code, g.properties.name]));
const rings = decode(subTopo);
const r5 = n => Math.round(n * 1e5) / 1e5;

const out = [];
for (const g of Object.values(subTopo.objects)[0].geometries) {
  const code = g.properties.code;
  const sido = code.slice(0, 2);
  if (sido !== '11' && sido !== '31') continue; // 서울(11), 경기(통계청 코드 31)
  const rs = rings(g).map(r => r.map(([x, y]) => [r5(x), r5(y)]));
  const xs = rs.flat().map(p => p[0]), ys = rs.flat().map(p => p[1]);
  const gu = muni[code.slice(0, 5)] ?? '';
  const name = g.properties.name;
  out.push({
    code, region: sido === '11' ? '서울' : '경기', gu, city: sido === '11' ? gu : (gu.match(/^(.+?[시군])/)?.[1] ?? gu),
    name, dong: name.replace(/\d+동$/, '동'), // 목1동·목2동 → 목동, 신정3동 → 신정동 (주민이 쓰는 법정동 이름에 가깝게)
    bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], rings: rs,
  });
}
mkdirSync(path.join(root, 'data'), { recursive: true });
const file = path.join(root, 'data', 'dong-boundaries.json');
writeFileSync(file, JSON.stringify({ source: '통계청 SGIS 행정구역경계 2018 (공공누리 제1유형), southkorea/southkorea-maps', dongs: out }));
const seoul = out.filter(d => d.region === '서울');
console.log(`[dong] 서울 ${seoul.length}개, 경기 ${out.length - seoul.length}개 → data/dong-boundaries.json`);
console.log('[dong] 양천구:', [...new Set(out.filter(d => d.gu === '양천구').map(d => d.dong))].join(', '));
console.log('[dong] 경기 시군 예:', [...new Set(out.filter(d => d.region === '경기').map(d => `${d.gu}→${d.city}`))].slice(0, 8).join(' | '));
