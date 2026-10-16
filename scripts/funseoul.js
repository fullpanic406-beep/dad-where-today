// 펀서울(서울시 공식 축제 사이트, festival.seoul.go.kr)의 축제 상세 페이지를 번호 순서로 읽어 .cache/funseoul.json 에 모은다.
// 보강(enrich) 작업에서 구청 표준데이터에 없는 시간·요금·프로그램을 공식 값으로 채울 때 근거로 쓴다. 서버 수집(ingest)과는 별개이며 사람이 요청할 때만 돌린다.
//   node scripts/funseoul.js [끝번호=900]
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from '../src/env.js';

const MAX = Number(process.argv[2] ?? 900);
const OUT = path.join(ROOT, '.cache', 'funseoul.json');
const URL_OF = n => `https://festival.seoul.go.kr/festival/main/festivalView.do?festacode=${n}`;
const strip = h => h.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&middot;/g, '·').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();

async function one(n) {
  const r = await fetch(URL_OF(n), { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) return null;
  const buf = new Uint8Array(await r.arrayBuffer());
  let html = new TextDecoder('utf-8', { fatal: false }).decode(buf);
  if (html.includes('�')) html = new TextDecoder('euc-kr').decode(buf);   // 인코딩이 EUC-KR 로 오는 경우
  const title = (html.match(/<h2[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/h2>/) ?? html.match(/<title>([\s\S]*?)\|/))?.[1];
  const info = {};
  const dl = html.match(/<dl class="detail-info">([\s\S]*?)<\/dl>/)?.[1];
  if (!dl || !title) return null;
  for (const m of dl.matchAll(/<dt[\s\S]*?<span>([\s\S]*?)<\/span>[\s\S]*?<\/dt>\s*<dd>([\s\S]*?)<\/dd>/g)) info[strip(m[1])] = strip(m[2]);
  const gu = (html.match(/<span class="[^"]*(?:tag|label|badge)[^"]*"[^>]*>\s*([가-힣]+구)\s*<\/span>/) ?? [])[1] ?? '';
  const body = html.match(/<!-- detail-contents -->([\s\S]*?)<!-- \/\/detail-contents -->/)?.[1] ?? '';
  const alts = [...body.matchAll(/<img[^>]*alt="([^"]{30,})"/g)].map(m => strip(m[1]));
  const m = (info['기간'] ?? '').match(/(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})/);
  return { code: n, title: strip(title), gu, start: m?.[1] ?? '', end: m?.[2] ?? '', time: info['시간'] ?? '', place: info['장소'] ?? '', target: info['대상'] ?? '', fee: info['요금'] ?? '', text: strip(body.replace(/<img[^>]*>/g, '')).slice(0, 1500), poster_text: alts.join('\n').slice(0, 3000), url: URL_OF(n) };
}

const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : [];
const have = new Map(prev.map(p => [p.code, p]));
const todo = []; for (let n = 1; n <= MAX; n++) todo.push(n);
let next = 0, miss = 0;
async function worker() {
  while (next < todo.length) {
    const n = todo[next++];
    try { const v = await one(n); if (v) have.set(n, v); else miss++; } catch { miss++; }
  }
}
await Promise.all(Array.from({ length: 8 }, worker));
const list = [...have.values()].sort((a, b) => a.code - b.code);
mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(list));
console.log(`펀서울 축제 ${list.length}건 저장(없는 번호 ${miss}) → ${OUT}`);
console.log(`2026-10 이후 진행·예정: ${list.filter(x => x.end >= '2026-10-16').length}건`);
