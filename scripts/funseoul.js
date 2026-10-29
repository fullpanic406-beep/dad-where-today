// 서울문화포털(culture.seoul.go.kr)의 축제 상세 페이지를 읽어 .cache/funseoul.json 에 모은다. (예전 펀서울 festival.seoul.go.kr 이 서울문화포털로 옮겨짐 — 번호도 festacode → cultcode 로 바뀜)
// 보강(enrich) 작업에서 구청 표준데이터에 없는 시간·요금·프로그램을 공식 값으로 채울 때 근거로 쓴다. 서버 수집(ingest)과는 별개이며 사람이 요청할 때만 돌린다.
//   node scripts/funseoul.js
// 읽을 번호(cultcode)는 ① 배포된 사이트 데이터의 서울시 문화행사 중 축제 분류 ② 서울문화포털 축제 목록 최신 10건에서 모은다.
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from '../src/env.js';
import { GU } from '../src/gu.js';

const SITE = 'https://fullpanic406-beep.github.io/dad-where-today/data';
const BASE = 'https://culture.seoul.go.kr';
const OUT = path.join(ROOT, '.cache', 'funseoul.json');
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36' };
const URL_OF = n => `${BASE}/culture/culture/cultureEvent/view.do?cultcode=${n}&menuNo=200010`;
const strip = h => h.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&middot;/g, '·').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();

async function one(n) {
  const r = await fetch(URL_OF(n), { headers: UA, signal: AbortSignal.timeout(20000) });
  if (!r.ok) return null;
  const html = await r.text();
  const title = html.match(/<div class="event-title">[\s\S]*?<h2>([\s\S]*?)<\/h2>/)?.[1];
  const box = html.match(/<div class="type-box">([\s\S]*?)<\/ul>\s*<\/div>/)?.[1];
  if (!title || !box) return null; // 에러안내 페이지 등
  const info = {};
  for (const m of box.matchAll(/<div class="type-th">\s*<span>([\s\S]*?)<\/span>[\s\S]*?<div class="type-td">([\s\S]*?)<\/div>\s*<\/li>/g)) info[strip(m[1])] = strip(m[2]).replace(/\s*\n\s*/g, ' ');
  const body = html.match(/<div class="culture-content">([\s\S]*?)<\/div>\s*<\/section>/)?.[1] ?? '';
  const alts = [...body.matchAll(/<img[^>]*alt="([^"]{30,})"/g)].map(m => strip(m[1]));
  const m = (info['기간'] ?? '').match(/(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})/);
  const homepage = html.match(/<div class="detail-btn"[^>]*>\s*<a href="([^"]+)"/)?.[1] ?? '';
  const place = info['장소'] ?? '';
  return { code: n, title: strip(title), gu: GU.find(g => place.includes(g)) ?? '', start: m?.[1] ?? '', end: m?.[2] ?? '', time: info['시간'] ?? '', place, target: info['대상'] ?? '', fee: info['요금'] ?? '', contact: info['문의'] ?? '', homepage, text: strip(body.replace(/<img[^>]*>/g, '')).slice(0, 1500), poster_text: alts.join('\n').slice(0, 3000), url: URL_OF(n) };
}

const codes = new Set();
for (const g of GU) {
  try {
    const list = await (await fetch(`${SITE}/gu/${encodeURIComponent(g)}.json`)).json();
    for (const e of list) if (e.category === 'festival') { const c = e.link?.match(/cultcode=(\d+)/)?.[1]; if (c) codes.add(Number(c)); }
  } catch { /* 사이트 데이터를 못 읽으면 목록 쪽만 사용 */ }
}
try {
  const r = await fetch(`${BASE}/culture/culture/cultureEvent/culturalEventListNoPage.json`, { method: 'POST', headers: { ...UA, 'content-type': 'application/x-www-form-urlencoded' }, body: 'subjcodeGroup=FESTIVAL&limitYn=&pageSC=', signal: AbortSignal.timeout(20000) });
  for (const x of (await r.json()).resultList ?? []) codes.add(Number(x.cultcode));
} catch (e) { console.log(`경고 — 서울문화포털 축제 목록을 못 읽음: ${e.message}`); }

const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')).filter(p => p.url?.includes('culture.seoul.go.kr')) : []; // 옛 펀서울 번호 자료는 버린다
const have = new Map(prev.map(p => [p.code, p]));
const todo = [...codes];
let next = 0, miss = 0;
async function worker() {
  while (next < todo.length) {
    const n = todo[next++];
    try { const v = await one(n); if (v) have.set(n, v); else miss++; } catch { miss++; }
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
const list = [...have.values()].sort((a, b) => a.code - b.code);
mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(list));
console.log(`서울문화포털 축제 ${list.length}건 저장(읽지 못한 번호 ${miss}) → ${OUT}`);
console.log(`오늘 이후 진행·예정: ${list.filter(x => x.end >= new Date().toISOString().slice(0, 10)).length}건`);
