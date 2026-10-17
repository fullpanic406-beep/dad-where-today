// 구별 JSON(public/data) 로더와 필터·집계. 서버 없이 브라우저에서 처리한다.
// 상대 경로만 쓴다 (GitHub Pages 의 /저장소이름/ 아래에서도 동작하도록).
const memo = new Map();
const once = (key, fn) => { if (!memo.has(key)) memo.set(key, fn().catch(e => { memo.delete(key); throw e; })); return memo.get(key); };
// 웹: 같은 사이트의 data/ 를 읽는다. 앱(Capacitor): config.js 의 APP_DATA_BASE(배포 주소)에서 최신 데이터를 먼저 읽고,
// 오프라인·장애 때는 앱에 들어 있는 스냅샷으로 대체한다.
const getJson = async url => {
  const base = globalThis.APP_DATA_BASE;
  let err;
  for (const u of base ? [base + url, url] : [url]) {
    try { const r = await fetch(u, { cache: 'no-cache' }); if (r.ok) return await r.json(); err = new Error(`${u} ${r.status}`); } catch (e) { err = e; }
  }
  throw err;
};

export const loadMeta = () => once('meta', () => getJson('data/meta.json'));
export const loadIndex = () => once('index', () => getJson('data/index.json'));
export const loadGu = gu => once('gu:' + gu, () => getJson(`data/gu/${encodeURIComponent(gu)}.json`));
export async function loadAll() {
  const { gu } = await loadIndex();
  return (await Promise.all(gu.map(loadGu))).flat();
}
export const loadDesc = async e => (await once('desc:' + e.gu, () => getJson(`data/desc/${encodeURIComponent(e.gu)}.json`)))[e.id] ?? '';

// a~b(YYYY-MM-DD) 사이에 허용 요일(비트마스크, bit n = Date.getDay() 가 n)이 하루라도 있는가
function dayHit(a, b, mask) {
  if (!mask || mask === 127) return true;
  for (const d = new Date(a + 'T00:00:00'), end = new Date(b + 'T00:00:00'); d <= end; d.setDate(d.getDate() + 1)) if (mask & (1 << d.getDay())) return true;
  return false;
}
const span = e => (Date.parse(e.end_date) - Date.parse(e.start_date)) / 864e5;
// 예약 가능한 행사를 앞으로, 마감된 행사를 뒤로
const openScore = e => (e.source !== 'yeyak' ? 0 : e.status === '접수중' ? 1 : e.status === '안내중' ? 0 : -1);

function matches(e, p) {
  if (p.from) {
    const to = p.to || p.from;
    if (!(e.start_date <= to && e.end_date >= p.from)) return false;
    // 주말에만 여는 행사 등 요일이 정해진 행사는 조회 기간에 해당 요일이 있을 때만
    if (e.dow && !dayHit(e.start_date > p.from ? e.start_date : p.from, e.end_date < to ? e.end_date : to, e.dow)) return false;
  }
  if (p.free && e.is_free !== 1) return false;
  if (p.family && !e.family) return false;
  if (p.cat && e.category !== p.cat) return false;
  if (!p.cat && !p.all && e.category === 'kidscafe') return false; // 키즈카페는 따로 노출(검색·분류 선택 때만 포함)
  if (p.q) { const q = p.q.toLowerCase(); if (!(e.title.toLowerCase().includes(q) || (e.place || '').toLowerCase().includes(q))) return false; }
  return true;
}

export async function queryEvents(p) {
  if (p.ids) {
    const want = new Set(String(p.ids).split(',').filter(Boolean));
    return { events: (await loadAll()).filter(e => want.has(e.id)) };
  }
  const list = (p.gu ? await loadGu(p.gu) : await loadAll()).filter(e => matches(e, p));
  list.sort((a, b) => b.family - a.family || (b.dow ? 1 : 0) - (a.dow ? 1 : 0) || openScore(b) - openScore(a) || span(a) - span(b)
    || a.start_date.localeCompare(b.start_date) || a.title.localeCompare(b.title, 'ko'));
  return { events: list.slice(0, 200), total: list.length };
}

// 월간 캘린더: 날짜별 행사 수 (n 전체, s 7일 이하 단기 행사, f 아이와)
export async function queryCalendar(p) {
  const [y, m] = p.month.split('-').map(Number);
  const last = new Date(y, m, 0).getDate(), pad = n => String(n).padStart(2, '0');
  const from = `${p.month}-01`, to = `${p.month}-${pad(last)}`;
  const days = {};
  for (const e of (await loadGu(p.gu)).filter(e => matches(e, { ...p, from, to }))) {
    const a = e.start_date < from ? from : e.start_date, b = e.end_date > to ? to : e.end_date;
    const short = span(e) <= 7 || !!e.dow;
    for (let d = Number(a.slice(8)); d <= Number(b.slice(8)); d++) {
      const k = `${p.month}-${pad(d)}`;
      if (e.dow && !(e.dow & (1 << new Date(k + 'T00:00:00').getDay()))) continue; // 운영하지 않는 요일
      (days[k] ??= { n: 0, s: 0, f: 0 });
      days[k].n++; days[k].f += e.family; if (short) days[k].s++;
    }
  }
  return { days };
}

// 구별 행사 수 (지도용) — 제목 없는 요약 파일만 읽는다
export async function querySummary(p) {
  const { gu, cats, rows } = await loadIndex();
  const out = {};
  for (const [g, s, e, fam, free, cat, , mask] of rows) {
    if (p.from) {
      const to = p.to || p.from;
      if (!(s <= to && e >= p.from)) continue;
      if (mask !== 127 && !dayHit(s > p.from ? s : p.from, e < to ? e : to, mask)) continue;
    }
    if (p.free && free !== 1) continue;
    if (p.family && !fam) continue;
    if (p.cat && cats[cat] !== p.cat) continue;
    if (!p.cat && !p.all && cats[cat] === 'kidscafe') continue;
    const o = (out[gu[g]] ??= { n: 0, f: 0 });
    o.n++; o.f += fam;
  }
  return { gu: out };
}

// ---- 가볼 만한 곳(상시 운영 장소): 어린이박물관·과학관·체험관 등 ----
export const loadPlaces = () => once('places', () => getJson('data/places.json'));
const rad = x => (x * Math.PI) / 180;
export const km = (a, b) => { // 두 지점(위도·경도) 사이 거리(km)
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};
// 계절 한정 장소·행사: 철이 아니면 추천·목록에서 뺀다(눈썰매장은 겨울에만, 물놀이는 여름에만 등)
const SEASONS = [[/눈썰매|스키|스노보드|빙어|눈꽃|얼음낚시|눈사람|겨울/, [12, 1, 2]], [/물놀이|워터파크|워터슬라이드|물총|해수욕|계곡|래프팅|여름/, [6, 7, 8, 9]],
  [/갯벌/, [4, 5, 6, 7, 8, 9, 10]], [/딸기/, [12, 1, 2, 3, 4, 5]], [/벚꽃/, [3, 4]], [/단풍/, [10, 11]], [/억새|코스모스/, [9, 10, 11]],
  [/크리스마스|성탄/, [11, 12]], [/할로윈|핼러윈/, [10]], [/김장/, [11, 12]]];
export const inSeason = (text, month = new Date().getMonth() + 1) => SEASONS.every(([re, ms]) => !re.test(text) || ms.includes(month));
export const isSeasonal = text => SEASONS.some(([re]) => re.test(text));   // 철이 정해진 이름인가(inSeason 과 같이 쓰면 '지금이 제철')

export async function queryPlaces(p) {
  const { places } = await loadPlaces();
  if (p.ids) { const want = new Set(String(p.ids).split(',').filter(Boolean)); return { places: places.filter(x => want.has(x.id)) }; }
  let list = places.filter(x => p.q || inSeason(x.name)).filter(x => (!p.region || x.region === p.region) && (!p.kind || x.kind === p.kind) && (!p.free || x.free === 1)
    && (!p.q || x.name.toLowerCase().includes(p.q.toLowerCase()) || x.addr.toLowerCase().includes(p.q.toLowerCase())));
  list = list.map(x => ({ ...x, dist: p.near && x.lat != null ? km(p.near, x) : null }));
  list.sort((a, b) => (p.near ? (a.dist ?? 1e9) - (b.dist ?? 1e9) : 0) || a.name.localeCompare(b.name, 'ko'));
  return { places: list.slice(0, p.limit || 200), total: list.length };
}

// 구별 소아청소년과 병·의원(src/hospitals.js 가 만든 data/hospitals/<구>.json)
export const loadHospitals = gu => once('hosp:' + gu, () => getJson(`data/hospitals/${encodeURIComponent(gu)}.json`));
