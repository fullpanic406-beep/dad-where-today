// 보강이 필요한 축제 목록: 배포된 사이트의 데이터(기본값) 또는 로컬 public/data 에서 읽어, 앞으로 N일 안에 시작하거나 진행 중인 축제 중
// 시간·요금·링크·포스터·상세 내용이 비어 있는 것을 골라 보여 준다. 이미 보강한 행사는 표시만 하고 건너뛴다.
//   node scripts/enrich-gaps.js [일수=21] [--local]
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from '../src/env.js';
import { GU } from '../src/gu.js';

const days = Number(process.argv.find(a => /^\d+$/.test(a)) ?? 21), local = process.argv.includes('--local');
const SITE = 'https://fullpanic406-beep.github.io/dad-where-today/data/';
const get = async rel => local
  ? JSON.parse(readFileSync(path.join(ROOT, 'public', 'data', rel), 'utf8'))
  : (await fetch(SITE + rel.split('/').map(encodeURIComponent).join('/'))).json();

const today = new Date(Date.now() + 9 * 36e5).toISOString().slice(0, 10);
const limit = new Date(Date.now() + 9 * 36e5 + days * 864e5).toISOString().slice(0, 10);
const enriched = existsSync(path.join(ROOT, 'data', 'enrich.json')) ? JSON.parse(readFileSync(path.join(ROOT, 'data', 'enrich.json'), 'utf8')) : [];
const rows = [];
for (const gu of GU) {
  const [ev, desc] = await Promise.all([get(`gu/${gu}.json`), get(`desc/${gu}.json`)]);
  for (const e of ev) {
    if (e.category !== 'festival' || e.end_date < today || e.start_date > limit) continue;
    const d = desc[e.id] ?? '';
    const miss = [!e.time && '시간', e.is_free == null && !e.fee && '요금', !e.link && '링크', !e.image && '포스터', d.replace(/^.*(주최·주관|문의):.*$/gm, '').length < 40 && '상세'].filter(Boolean);
    rows.push({ gu, title: e.title, start: e.start_date, end: e.end_date, place: e.place, source: e.source, done: !!e.enriched, miss });
  }
}
rows.sort((a, b) => a.start.localeCompare(b.start) || a.gu.localeCompare(b.gu, 'ko'));
const todo = rows.filter(r => !r.done && r.miss.length);
console.log(`기준일 ${today} · 앞으로 ${days}일 · 축제 ${rows.length}건 중 보강 필요 ${todo.length}건 (이미 보강 ${rows.filter(r => r.done).length}건, 보강 항목 ${enriched.length}개)\n`);
for (const r of todo) console.log(`${r.start}${r.end !== r.start ? '~' + r.end.slice(5) : ''} | ${r.gu} | ${r.title} | ${r.place || '장소 없음'} | 없음: ${r.miss.join('·')} [${r.source}]`);
