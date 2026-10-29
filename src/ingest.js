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
import { dongOf, dongFromText } from './dong.js';
import * as manual from './sources/manual.js';
import { applyEnrich } from './enrich.js';
import { staleReason, kstNow } from '../public/fresh.js';
import * as cultureFestival from './sources/culture-festival.js';
import * as tourFestival from './sources/tourapi-festival.js';
import * as seoulSpace from './places/seoul-space.js';
import * as tourapi from './places/tourapi.js';

loadEnv();

const KEY = process.env.SEOUL_API_KEY || 'sample';
const SOURCES = [manual, seoulEvents, yeyak, yeogijeogi, cultureFestival, tourFestival]; // 앞에 둔 소스를 우선(중복 제거 기준). optional 소스는 실패해도 나머지를 계속 진행(경고만)
const PLACE_SOURCES = [seoulSpace, tourapi]; // 장소 소스(앞에 둔 소스의 값을 우선): 서울시 문화공간, 한국관광공사 TourAPI(서울·경기, TOURAPI_KEY 필요)
const OUT = path.join(ROOT, 'public', 'data');
const pad = n => String(n).padStart(2, '0');
const today = (() => { // 한국 시간 기준 오늘 (CI 서버는 UTC)
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
})();
const log = m => process.stdout.write(`\r[ingest] ${m}   `);
// 사진 주소 정리: 서울시 공공서비스예약의 상대 경로(/cmsdata/…)는 사이트 주소를 붙이고, 관광공사 http 사진은 https 로(앱은 http 사진을 막는다)
const fixImage = (u, source) => {
  if (!u) return '';
  if (u.startsWith('/') && source === 'yeyak') return 'https://yeyak.seoul.go.kr' + u;
  return u.replace(/^http:\/\/tong\.visitkorea\.or\.kr\//, 'https://tong.visitkorea.or.kr/');
};
// 설명 글에 남은 HTML 태그를 지운다(<br>은 줄바꿈). 워드에서 붙여 넣은 <v:line …>, <meta …>, 속성 달린 태그 등.
// "<TASTE OF GREEN>"처럼 꺾쇠를 괄호로 쓴 제목·문구는 태그가 아니므로 남긴다(대문자·한글로 시작하거나 속성이 없음)
const stripTags = (v, br = '\n') => {
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, stripTags(x, br)]));
  if (typeof v !== 'string') return v;
  return v.replace(/\r\n?/g, '\n')
    .replace(/<br\s*\/?>/gi, br)
    .replace(/<\/?(?:p|div|span|meta|address|font|b|strong|em|u|o:p|table|tbody|tr|td|ul|ol|li|h[1-6])(?:\s[^>]*)?\/?>/gi, '')
    .replace(/<\/?[a-z][\w:-]*:[\w-]+[^>]*>/g, '')                                   // <v:line …>, <o:p> 같은 이름공간 태그
    .replace(/<[a-z][\w:-]*(?:\s+[\w:-]+=(?:"[^"]*"|'[^']*'))+\s*\/?>/g, '')          // 속성이 달린 소문자 태그
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
};
const write = (file, data) => writeFileSync(file, JSON.stringify(data));

async function main() {
  // CI 에서 키가 없으면 빈약한 테스트 데이터가 배포되므로 막는다
  if (process.env.CI && KEY === 'sample') throw new Error('CI 에서는 SEOUL_API_KEY 가 필요합니다');
  console.log(`[ingest] 수집 시작 (key=${KEY === 'sample' ? 'sample — 소량 테스트' : '사용자 키'}, 기준일 ${today})`);
  const events = [], descs = {}, seen = new Set(), counts = {}, warnings = [];
  let unknownGu = 0;
  const evIndex = {}; // 구 → 이미 담은 행사(중복 합치기용)
  // 이전 배포 데이터(받아 둔 경우): 선택 소스가 일시적으로 실패한 날 그 소스의 행사를 이어 쓰려고 먼저 읽어 둔다
  const prevEvents = [], prevDescs = {};
  for (const g of GU) {
    try {
      const f = path.join(OUT, 'gu', `${g}.json`), d = path.join(OUT, 'desc', `${g}.json`);
      if (existsSync(f)) prevEvents.push(...JSON.parse(readFileSync(f, 'utf8')));
      if (existsSync(d)) Object.assign(prevDescs, JSON.parse(readFileSync(d, 'utf8')));
    } catch { /* 이전 데이터가 깨져 있으면 무시 */ }
  }
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
      // 일시적인 실패(네트워크 등)로 행사가 사이트에서 갑자기 사라지지 않도록, 이전에 배포된 이 소스의 행사 중 아직 끝나지 않은 것을 이어 쓴다
      const keep = prevEvents.filter(p => p.source === src.name && p.end_date >= today && GU.includes(p.gu) && !seen.has(p.id));
      for (const p of keep) {
        seen.add(p.id); events.push(p);
        (evIndex[p.gu] ??= []).push({ n: normTitle(p.title), ev: p });
        if (prevDescs[p.id]) descs[p.id] = prevDescs[p.id];
      }
      const note = keep.length ? ` (이전 데이터 ${keep.length}건 유지)` : '';
      warnings.push(`${src.label}: ${e.message}${note}`);
      console.log(`[ingest] 경고 — ${src.label} 건너뜀: ${e.message}${note}`);
      counts[src.name] = keep.length;
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

  // 연도·날짜·시간 확인: 날짜가 잘못됐거나 이미 끝났거나 지난해 자료인 행사는 저장하지 않는다(앱 화면에서도 같은 기준으로 한 번 더 거른다)
  const staleCounts = {}, now = kstNow();
  for (let i = events.length - 1; i >= 0; i--) {
    const why = staleReason(events[i], now);
    if (why) { staleCounts[why] = (staleCounts[why] ?? 0) + 1; delete descs[events[i].id]; events.splice(i, 1); }
  }
  if (Object.keys(staleCounts).length) console.log(`[ingest] 지난 행사 제외: ${Object.entries(staleCounts).map(([k, v]) => `${k} ${v}건`).join(', ')}`);

  // 같은 소스에서 똑같은 행사(구·제목·기간·시간·장소가 모두 같음)가 두 번 내려오면 하나만 남긴다
  const exact = new Set();
  let sameDup = 0;
  for (let i = 0; i < events.length; i++) {
    const e = events[i], k = [e.source, e.gu, e.title.replace(/\s+/g, ''), e.start_date, e.end_date, e.time ?? '', e.place ?? ''].join('|');
    if (exact.has(k)) { delete descs[e.id]; events.splice(i--, 1); sameDup++; } else exact.add(k);
  }
  if (sameDup) console.log(`[ingest] 같은 소스 중복 행사 ${sameDup}건 제외`);

  // 화면에 그대로 찍히는 값 정리: 상대 경로·http 사진, 좌표 한쪽만 있는 값, 설명 속 HTML 태그
  for (const e of events) {
    e.image = fixImage(e.image, e.source);
    if ((e.lat == null) !== (e.lng == null)) { e.lat = null; e.lng = null; }
  }
  for (const [id, d] of Object.entries(descs)) descs[id] = stripTags(d);

  // 안전장치: 이전 결과보다 절반 넘게 줄었거나 너무 적으면 반영하지 않는다
  const metaFile = path.join(OUT, 'meta.json');
  if (KEY !== 'sample') {
    if (events.length < 50) throw new Error(`수집 건수가 너무 적음(${events.length})`);
    if (existsSync(metaFile)) {
      const prev = JSON.parse(readFileSync(metaFile, 'utf8')).total ?? 0;
      if (prev >= 50 && events.length < prev * 0.5) throw new Error(`건수 급감(${prev} → ${events.length}) — 반영하지 않음`);
    }
  }

  // 행사마다 '동'을 붙인다: ① 직접 적은 값 ② 좌표로 찾은 동(같은 구일 때만) ③ 장소·제목 글에 그 구의 동 이름이 있으면 그 동
  let dongHit = 0;
  for (const e of events) {
    if (!e.dong) {
      const hit = dongOf(e.lat, e.lng);
      e.dong = (hit && hit.city === e.gu ? hit.dong : '') || dongFromText(`${e.place} ${e.title}`, e.gu) || '';
    }
    if (e.dong) dongHit++;
  }
  console.log(`[ingest] 동 정보: 행사 ${events.length}건 중 ${dongHit}건(${Math.round(dongHit / events.length * 100)}%)`);

  // 직접 확인해 적어 둔 보강 내용(data/enrich.json)을 덧씌운다
  applyEnrich(events, descs, path.join(ROOT, 'data', 'enrich.json'));

  // 축제: 설명·사진·링크가 하나도 없는 행사, 링크가 열리지 않는 행사는 삭제한다
  const festDrop = { 내용없음: 0, 링크불가: 0 };
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.category === 'festival' && !descs[e.id] && !e.image && !e.link) { delete descs[e.id]; events.splice(i, 1); festDrop.내용없음++; }
  }
  // 링크가 열리지 않는 축제: 서버(해외 IP)에서는 국내 사이트가 막혀 점검이 안 되므로, 이 컴퓨터에서 `node scripts/check-festival-links.js`로 만든 data/dead-links.json 의 주소만 삭제한다
  const deadFile = path.join(ROOT, 'data', 'dead-links.json');
  const deadLinks = new Set(existsSync(deadFile) ? (JSON.parse(readFileSync(deadFile, 'utf8')).links ?? []).map(x => x.link) : []);
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.category === 'festival' && e.link && deadLinks.has(e.link)) { console.log(`[ingest] 링크 불가 축제 삭제: ${e.title} ${e.link}`); delete descs[e.id]; events.splice(i, 1); festDrop.링크불가++; }
  }
  if (festDrop.내용없음 || festDrop.링크불가) console.log(`[ingest] 축제 삭제: 내용 없음 ${festDrop.내용없음}건, 링크 불가 ${festDrop.링크불가}건`);

  // 체험객·관람객 얼굴이 나온 사진(초상권)은 data/image-exclude.json 의 주소 목록으로 걸러 기본 이미지로 대체한다
  const excludeImg = existsSync(path.join(ROOT, 'data', 'image-exclude.json')) ? new Set(JSON.parse(readFileSync(path.join(ROOT, 'data', 'image-exclude.json'), 'utf8'))) : new Set();
  let imgDropped = 0;
  for (const e of events) if (e.image && excludeImg.has(e.image)) { e.image = ''; e.image_license = ''; imgDropped++; }

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
  // 장소마다 '동'을 붙인다: 도로명주소 끝의 "(신정동)" → 좌표로 찾은 동 → 주소 글에 있는 동 이름
  let placeDong = 0;
  for (const p of places) {
    if (!p.dong) {
      const paren = (p.addr.match(/\(([가-힣0-9]+[동읍면가])[,)]/) ?? [])[1];
      const hit = dongOf(p.lat, p.lng);
      p.dong = (paren ? paren.replace(/\d+동$/, '동') : '') || (hit && hit.city === p.gu ? hit.dong : '') || dongFromText(p.addr, p.gu, p.region) || '';
    }
    if (p.dong) placeDong++;
  }
  console.log(`[ingest] 동 정보: 장소 ${places.length}곳 중 ${placeDong}곳`);
  for (const p of places) if (p.image && excludeImg.has(p.image)) { p.image = ''; p.imageLicense = ''; imgDropped++; }
  // 장소 값 정리: http 사진(앱에서 막힘)을 https 로, "http://가평군청" 같은 주소 아닌 홈페이지는 비우고, 운영 시간 등의 <br> 태그 제거
  for (const p of places) {
    p.image = fixImage(p.image, p.source);
    if (p.url && !/^https?:\/\/[^\s/]+\.[a-z]{2,}/i.test(p.url)) p.url = '';
    for (const k of ['hours', 'fee', 'closed', 'desc']) if (typeof p[k] === 'string') p[k] = stripTags(p[k], ' / ').replace(/\s*\n\s*/g, ' ').trim();
  }
  console.log(`[ingest] 얼굴이 나온 사진 제외: ${imgDropped}건`);
  places.sort((a, b) => a.region.localeCompare(b.region, 'ko') || a.gu.localeCompare(b.gu, 'ko') || a.dong.localeCompare(b.dong, 'ko') || a.name.localeCompare(b.name, 'ko'));
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
