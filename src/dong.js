// 좌표·문구로 '동'을 찾는다 (data/dong-boundaries.json, scripts/build-dong.js 로 만든 서울·경기 읍면동 경계)
// 표시용 동 이름은 목1동·목2동 → 목동, 신정3동 → 신정동 처럼 숫자를 뗀 이름이다.
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from './env.js';

const FILE = path.join(ROOT, 'data', 'dong-boundaries.json');
let DB = null;

function load() {
  if (DB) return DB;
  DB = { dongs: [], byGu: new Map() };
  if (!existsSync(FILE)) return DB; // 경계 파일이 없으면 동 정보 없이 동작(구 단위까지만)
  DB.dongs = JSON.parse(readFileSync(FILE, 'utf8')).dongs;
  for (const d of DB.dongs) {
    const key = `${d.region}|${d.city}`;
    if (!DB.byGu.has(key)) DB.byGu.set(key, new Set());
    DB.byGu.get(key).add(d.dong); DB.byGu.get(key).add(d.name);
  }
  return DB;
}

// 점이 고리들 안에 있는지: 모든 고리의 교차 횟수가 홀수면 안쪽(구멍은 자동으로 빠짐)
function inside(x, y, rings) {
  let c = false;
  for (const r of rings) {
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i], [xj, yj] = r[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
  }
  return c;
}

// 위도·경도 → { dong, name, city, gu, region } 또는 null
export function dongOf(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  for (const d of load().dongs) {
    const [x0, y0, x1, y1] = d.bbox;
    if (lng < x0 || lng > x1 || lat < y0 || lat > y1) continue;
    if (inside(lng, lat, d.rings)) return { dong: d.dong, name: d.name, city: d.city, gu: d.gu, region: d.region };
  }
  return null;
}

// 그 구(시)에 있는 동 이름이 글에 들어 있으면 그 동을 돌려준다 ("신정7동 갈산-호돌이 가족 축제" → 신정동). 글자만 비슷한 말(활동 등)은 걸리지 않는다.
export function dongFromText(text, city, region = '서울') {
  const names = load().byGu.get(`${region}|${city}`);
  if (!names || !text) return '';
  const alts = [...names].sort((a, b) => b.length - a.length).map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const m = text.match(new RegExp(`(?<![가-힣0-9])(${alts.join('|')})(?![가-힣])`));
  return m ? m[1].replace(/\d+동$/, '동') : '';
}

export const hasDongData = () => load().dongs.length > 0;
