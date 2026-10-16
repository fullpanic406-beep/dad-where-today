// 행사 수집: 서울시 문화행사 + 서울시 공공서비스예약 → 서울 25개 구 전체를 구별 파일로 저장
// 사용: npm run ingest   (SEOUL_API_KEY 는 .env 또는 환경변수/GitHub Secrets)
//
// 결과(public/data):
//   meta.json          생성 시각, 출처별·구별 건수
//   index.json         전 구 요약(지도·건수용, 제목 없음)
//   gu/<구>.json       그 구의 행사 전체
//   desc/<구>.json     그 구 행사의 상세 설명(상세 화면을 열 때만 읽음)
//
// 한 곳이라도 실패하거나 건수가 급감하면 아무것도 쓰지 않고 종료 코드 1로 끝난다.
// (GitHub Actions 에서는 그러면 배포 단계로 넘어가지 않아 기존 사이트가 그대로 유지된다.)
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { loadEnv, ROOT } from './env.js';
import { GU, CATS } from './gu.js';
import * as seoulEvents from './sources/seoul-events.js';
import * as yeyak from './sources/yeyak.js';
import * as yeogijeogi from './sources/yeogijeogi.js';
import * as cultureFestival from './sources/culture-festival.js';
import * as tourFestival from './sources/tourapi-festival.js';
import * as seoulSpace from './places/seoul-space.js';
import * as tourapi from './places/tourapi.js';

loadEnv();

const KEY = process.env.SEOUL_API_KEY || 'sample';
const SOURCES = [seoulEvents, yeyak, yeogijeogi, cultureFestival, tourFestival]; // 앞에 둔 소스를 우선(중복 제거 기준). optional 소스는 실패해도 나머지를 계속 진행(경고만)
const PLACE_SOURCES = [seoulSpace, tourapi]; // 장소 소스(앞에 둔 소스의 값을 우선): 서울시 문화공간, 한국관광공사 TourAPI(서울·경기, TOURAPI_KEY 필요)
const OUT = path.join(ROOT, 'public', 'data');
const pad = n => String(n).padStart(2, '0');
const today = (() => { // 한국 시간 기준 오늘 (CI 서버는 UTC)
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
})();
const log = m => process.stdout.write(`\r[ingest] ${m}   `);
const write = (file, data) => writeFileSync(file, JSON.stringify(data));

async function main() {
  // CI 에서 키가 없으면 빈약한 테스트 데이터가 배포되므로 막는다
  if (process.env.CI && KEY === 'sample') throw new Error('CI 에서는 SEOUL_API_KEY 가 필요합니다');
  console.log(`[ingest] 수집 시작 (key=${KEY === 'sample' ? 'sample — 소량 테스트' : '사용자 키'}, 기준일 ${today})`);
  const events = [], descs = {}, seen = new Set(), counts = {}, warnings = [];
  let unknownGu = 0;
  const evIndex = {}; // 구 → 이미 담은 행사(중복 합치기용)
  const normTitle = t => t.replace(/[\s\[\]()「」<>·\-_:：,.!?'"‘’“”~]|제?\d+회|\d+주년|20\d\d/g, '');
  const findDup = e => {
    const n = normTitle(e.title);
    return (evIndex[e.gu] ?? []).find(o => o.ev.source !== e.source && o.ev.start_date <= e.end_date && e.start_date <= o.ev.end_date
      && (o.n === n || (Math.min(o.n.length, n.length) >= 5 && (o.n.includes(n) || n.includes(o.n)))));
  };
  for (const src of SOURCES) {
    let rows;
    try {
      rows = await src.fetchEvents(KEY, today, log);
    } catch (e) {
      if (!src.optional) throw e;
      process.stdout.write('\n');
      warnings.push(`${src.label}: ${e.message}`);
      console.log(`[ingest] 경고 — ${src.label} 건너뜀: ${e.message}`);
      counts[src.name] = 0;
      continue;
    }
    process.stdout.write('\n');
    let n = 0, merged = 0;
    for (const { event, desc } of rows) {
      if (seen.has(event.id)) continue; // 같은 행사가 두 번 내려오는 경우
      if (!GU.includes(event.gu)) { unknownGu++; continue; } // 25개 구가 아닌 값은 제외
      // 다른 소스에 같은 행사가 이미 있으면(같은 구, 기간이 겹치고, 제목이 같거나 한쪽이 다른 쪽을 포함) 합치고 빈 항목만 채운다
      const dup = findDup(event);
      if (dup) {
        for (const [k, v] of Object.entries(event)) if ((dup.ev[k] === '' || dup.ev[k] == null) && v !== '' && v != null) dup.ev[k] = v;
        if (desc && !descs[dup.ev.id]) descs[dup.ev.id] = desc;
        merged++; continue;
      }
      seen.add(event.id); events.push(event); n++;
      (evIndex[event.gu] ??= []).push({ n: normTitle(event.title), ev: event });
      if (desc) descs[event.id] = desc;
    }
    counts[src.name] = n;
    console.log(`[ingest] ${src.label}: ${n}건${merged ? ` (다른 소스와 겹쳐 ${merged}건 합침)` : ''}`);
  }
  if (unknownGu) console.log(`[ingest] 구 정보가 25개 구가 아닌 ${unknownGu}건은 제외했습니다.`);

  // 안전장치: 이전 결과보다 절반 넘게 줄었거나 너무 적으면 반영하지 않는다
  const metaFile = path.join(OUT, 'meta.json');
  if (KEY !== 'sample') {
    if (events.length < 50) throw new Error(`수집 건수가 너무 적음(${events.length})`);
    if (existsSync(metaFile)) {
      const prev = JSON.parse(readFileSync(metaFile, 'utf8')).total ?? 0;
      if (prev >= 50 && events.length < prev * 0.5) throw new Error(`건수 급감(${prev} → ${events.length}) — 반영하지 않음`);
    }
  }

  // 구별로 나눠 저장
  rmSync(path.join(OUT, 'gu'), { recursive: true, force: true });
  rmSync(path.join(OUT, 'desc'), { recursive: true, force: true });
  mkdirSync(path.join(OUT, 'gu'), { recursive: true });
  mkdirSync(path.join(OUT, 'desc'), { recursive: true });

  const byGu = {};
  for (const g of GU) byGu[g] = [];
  for (const e of events) byGu[e.gu].push(e);

  const guCounts = {};
  for (const g of GU) {
    const list = byGu[g].sort((a, b) => a.start_date.localeCompare(b.start_date) || a.title.localeCompare(b.title, 'ko'));
    guCounts[g] = list.length;
    write(path.join(OUT, 'gu', `${g}.json`), list);
    write(path.join(OUT, 'desc', `${g}.json`), Object.fromEntries(list.filter(e => descs[e.id]).map(e => [e.id, descs[e.id]])));
  }

  // 가볼 만한 곳(상시 운영하는 어린이박물관·과학관·체험관 등): 소스가 실패해도 행사 배포는 계속된다
  // 같은 시설이 여러 소스에 있으면(이름이 같거나 주소·종류가 같음) 하나로 합치고, 빈 항목은 다른 소스 값으로 채운다
  const placesFile = path.join(OUT, 'places.json');
  const prevPlaces = existsSync(placesFile) ? (JSON.parse(readFileSync(placesFile, 'utf8')).places ?? []) : [];
  const places = [], byName = new Map(), byAddr = new Map(), placeCounts = {};
  const nameKey = p => p.name.replace(/[\s()·\-_,.]/g, '');
  const addrKey = p => (p.addr.replace(/\([^)]*\)/g, '').replace(/\s+/g, '') + '|' + p.kind);
  for (const src of PLACE_SOURCES) {
    try {
      const rows = await src.fetchPlaces(KEY, log);
      process.stdout.write('\n');
      let n = 0;
      for (const p of rows) {
        const dup = byName.get(nameKey(p)) ?? (p.addr.length > 8 ? byAddr.get(addrKey(p)) : null);
        if (dup) { for (const [k, v] of Object.entries(p)) if ((dup[k] === '' || dup[k] == null) && v !== '' && v != null) dup[k] = v; continue; }
        places.push(p); byName.set(nameKey(p), p); if (p.addr.length > 8) byAddr.set(addrKey(p), p); n++;
      }
      placeCounts[src.name] = n;
      console.log(`[ingest] ${src.label}: ${n}곳`);
    } catch (e) {
      process.stdout.write('\n');
      // 실패한 날에는 이전에 배포된 이 소스의 장소를 그대로 이어 써서 사이트에서 갑자기 사라지지 않게 한다
      const keep = prevPlaces.filter(p => p.source === src.name);
      for (const p of keep) {
        if (byName.has(nameKey(p))) continue;
        places.push(p); byName.set(nameKey(p), p); if (p.addr.length > 8) byAddr.set(addrKey(p), p);
      }
      warnings.push(`${src.label}: ${e.message}${keep.length ? ` (이전 데이터 ${keep.length}곳 유지)` : ''}`);
      console.log(`[ingest] 경고 — ${src.label} 건너뜀: ${e.message}${keep.length ? ` (이전 데이터 ${keep.length}곳 유지)` : ''}`);
      placeCounts[src.name] = keep.length;
    }
  }
  places.sort((a, b) => a.region.localeCompare(b.region, 'ko') || a.gu.localeCompare(b.gu, 'ko') || a.name.localeCompare(b.name, 'ko'));
  write(path.join(OUT, 'places.json'), { meta: { generatedAt: new Date().toISOString(), total: places.length, counts: placeCounts }, places });

  // 지도·건수용 요약: [구 번호, 시작, 종료, 아이와, 무료, 카테고리 번호, 접수중 여부, 운영 요일 비트마스크(127=매일)]
  const rows = events.map(e => [GU.indexOf(e.gu), e.start_date, e.end_date, e.family, e.is_free ?? -1, Math.max(0, CATS.indexOf(e.category)), e.status === '접수중' ? 1 : 0, e.dow ?? 127]);
  write(path.join(OUT, 'index.json'), { gu: GU, cats: CATS, rows });
  const meta = { generatedAt: new Date().toISOString(), today, total: events.length, counts, guCounts, warnings };
  write(metaFile, meta);

  console.log(`[ingest] 저장 완료: 총 ${events.length}건, 25개 구 파일 생성`);
  console.log('[ingest] 구별:', GU.map(g => `${g} ${guCounts[g]}`).join(', '));
  for (const w of warnings) console.log(`::warning::${w}`); // GitHub Actions 경고로 표시
}

main().catch(e => { console.error('\n[ingest] 실패:', e.message); process.exit(1); });
