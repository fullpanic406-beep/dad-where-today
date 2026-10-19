// 아빠 오늘 어디가 — 모바일 웹앱 (프레임워크 없이)
import { clearCache, km, loadMeta, loadGu, queryEvents, queryCalendar, querySummary, loadDesc, queryPlaces, loadHospitals, inSeason, isSeasonal } from './data.js';

const $ = s => document.querySelector(s);
const view = $('#view');

const KIND = { kidsmuseum: '어린이박물관', science: '과학관', experience: '체험관', safety: '안전체험관', nature: '자연·생태', museum: '박물관·전시' };
const KIND_IMG = { kidsmuseum: 'kidscafe', science: 'edu', experience: 'edu', safety: 'today', nature: 'weekend', museum: 'exhibit' }; // 사진이 없을 때 쓰는 3D 아이콘
const CAT = { festival: '축제', show: '공연', exhibit: '전시', edu: '체험·교육', kidscafe: '키즈카페', etc: '기타' };
const DOW = ['일', '월', '화', '수', '목', '금', '토'];

/* ---------- 아이콘 (24x24 선 아이콘) ---------- */
const CLOUD = 'M7 18.5a4 4 0 1 1 .6-7.95A5.5 5.5 0 0 1 18 11.5a3.5 3.5 0 0 1-.5 7z';
const CLOUD_UP = 'M7 15.5a4 4 0 1 1 .6-7.95A5.5 5.5 0 0 1 18 8.5a3.5 3.5 0 0 1-.5 7z';
const P = {
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  chevR: '<path d="M9 5l7 7-7 7"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
  share: '<path d="M12 15V4M8 8l4-4 4 4M5 12v7h14v-7"/>',
  pin: '<path d="M12 21s-6-5.5-6-10.5a6 6 0 0 1 12 0C18 15.5 12 21 12 21z"/><circle cx="12" cy="10.5" r="2.2"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  ticket: '<path d="M4 9a2 2 0 0 0 0 6v2.5A1.5 1.5 0 0 0 5.5 19h13a1.5 1.5 0 0 0 1.5-1.5V15a2 2 0 0 0 0-6V6.5A1.5 1.5 0 0 0 18.5 5h-13A1.5 1.5 0 0 0 4 6.5z"/><path d="M14 8v8" stroke-dasharray="1.6 2.2"/>',
  users: '<circle cx="9" cy="9" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="10" r="2.3"/><path d="M16 14.2a4.5 4.5 0 0 1 4.5 4.3"/>',
  home: '<path d="M4 11l8-6.5 8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-5.5H9v5.5H5.5A1.5 1.5 0 0 1 4 19z"/>',
  map: '<path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6zM9 4v14M15 6v14"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>',
  sparkle: '<path d="M11 3l1.9 5.6L18.5 10.5l-5.6 1.9L11 18l-1.9-5.6L3.5 10.5l5.6-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  gift: '<rect x="4" y="9.5" width="16" height="10.5" rx="2"/><path d="M12 9.5V20M3.5 9.5h17V7h-17zM12 7c-1.5-3.2-5-2.6-4.2-.8M12 7c1.5-3.2 5-2.6 4.2-.8"/>',
  hospital: '<rect x="4" y="4.5" width="16" height="16" rx="3"/><path d="M12 8.5v7M8.5 12h7"/>',
  compass: '<circle cx="12" cy="12" r="8.5"/><path d="M15.6 8.4l-2.1 5.1-5.1 2.1 2.1-5.1z"/>',
  smile: '<circle cx="12" cy="12" r="8.5"/><path d="M8.3 14c1.2 2.2 6.2 2.2 7.4 0"/><path d="M9 9.8h.01M15 9.8h.01" stroke-width="2.4"/>',
  flag: '<path d="M5.5 21V4M5.5 5h12l-2.2 4 2.2 4h-12"/>',
  cloud: `<path d="${CLOUD}"/>`,
  cloudsun: '<circle cx="8" cy="8" r="2.6"/><path d="M8 2.6v1.2M2.6 8h1.2M4.2 4.2l.9.9M11.8 4.2l-.9.9"/><path d="M9 20a3.5 3.5 0 0 1 .3-7A4.6 4.6 0 0 1 18 14.2 2.9 2.9 0 0 1 17.6 20z"/>',
  rain: `<path d="${CLOUD_UP}"/><path d="M8.5 18.5l-1 2.5M12.5 18.5l-1 2.5M16.5 18.5l-1 2.5"/>`,
  snow: `<path d="${CLOUD_UP}"/><path d="M8.5 19h.01M12.5 20.5h.01M16.5 19h.01" stroke-width="2.6"/>`,
  bolt: `<path d="${CLOUD_UP}"/><path d="M12.8 14l-2.3 3.5h3L11.7 21"/>`,
  refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4h-4"/>',
};
const I = n => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${P[n]}</svg>`;

/* ---------- 유틸 ---------- */
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const md = (s, year = false) => { const d = parse(s); return `${year ? d.getFullYear() + '.' : ''}${d.getMonth() + 1}.${d.getDate()}(${DOW[d.getDay()]})`; };
// 올해가 아니거나 시작·끝 연도가 다르면 연도를 붙인다(2025.12.30 ~ 2026.12.31 이 "12.30 ~ 12.31"로 보이지 않게)
const rangeLabel = (a, b) => {
  const y = String(new Date().getFullYear()), cross = a.slice(0, 4) !== b.slice(0, 4);
  return a === b ? md(a, a.slice(0, 4) !== y) : `${md(a, cross || a.slice(0, 4) !== y)} ~ ${md(b, cross || b.slice(0, 4) !== y)}`;
};
const whenText = e => `${rangeLabel(e.start_date, e.end_date)}${e.dow_label ? (e.dow_label === '주말' ? ' · 주말마다' : ` · 매주 ${e.dow_label}`) : ''}`;
const where = e => (e.place && !e.place.includes(e.gu) ? `${e.gu} · ${e.place}` : e.place || e.gu);
const catKey = e => (CAT[e.category] ? e.category : 'etc');
const catImg = e => (!CAT[e.category] || e.category === 'etc' ? 'weekend' : e.category); // 사진이 없을 때 쓰는 3D 아이콘
const store = {
  get(k, def) { try { return JSON.parse(localStorage.getItem('ado.' + k)) ?? def; } catch { return def; } },
  set(k, v) { try { localStorage.setItem('ado.' + k, JSON.stringify(v)); } catch { /* 저장 불가 환경 */ } },
};
const api = async (path, params = {}) => {
  const p = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null && v !== false));
  if (path === '/api/events') return queryEvents(p);
  if (path === '/api/calendar') return queryCalendar(p);
  if (path === '/api/summary') return querySummary(p);
  if (path === '/api/places') return queryPlaces(p);
  if (path === '/api/meta') return loadMeta();
  throw new Error(path);
};
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 1800);
}
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

/* ---------- 상태 ---------- */
const TODAY = iso(new Date());
function weekendOf(s) { // s 기준 이번 주말(토·일). 토요일이면 오늘~내일, 일요일이면 오늘
  const dow = parse(s).getDay();
  if (dow === 0) return [s, s];
  const sat = addDays(s, 6 - dow);
  return [sat, addDays(sat, 1)];
}
const S = {
  tab: 'home',
  gu: store.get('gu', '양천구'),
  from: TODAY, to: TODAY, anchor: TODAY, weekOnly: false,
  family: false, free: false, cat: '',
  searchAll: false,
  placeKind: '', placeRegion: '', placeSort: 'area', near: null, // near: 가까운 순 기준점(내 위치를 쓰면 { lat, lng, label })
  saved: new Set(store.get('saved', [])),
  cache: new Map(), meta: null, mapData: null, weather: null,
  hosp: new Set(),   // 병원 탭 필터(now·hol·sun·sat·night 중 하나)
};
// 가까운 순 기준점: 내 위치를 켜지 않았다면 선택한 구의 중심
const nearPoint = () => S.near ?? (() => { const c = S.mapData?.districts.find(x => x.name === S.gu); return c ? { lat: c.lat, lng: c.lng, label: `${S.gu} 중심` } : null; })();
const distText = p => (p.dist == null ? '' : p.dist < 1 ? `${Math.round(p.dist * 10) * 100}m` : `${p.dist.toFixed(p.dist < 10 ? 1 : 0)}km`);
const filterParams = () => ({ family: S.family ? 1 : '', free: S.free ? 1 : '', cat: S.cat });
const modeOf = () => {
  if (S.from === TODAY && S.to === TODAY) return 'today';
  if (S.from === addDays(TODAY, 1) && S.to === S.from) return 'tomorrow';
  const [a, b] = weekendOf(TODAY);
  return S.from === a && S.to === b ? 'weekend' : 'day';
};
function setRange(from, to) { S.from = from; S.to = to; S.anchor = from; }

/* ---------- 날씨 (Open-Meteo, 키 불필요) ---------- */
const wxIcon = c => c === 0 ? 'sun' : c <= 2 ? 'cloudsun' : c <= 48 ? 'cloud' : c <= 67 ? 'rain'
  : c <= 77 ? 'snow' : c <= 82 ? 'rain' : c <= 86 ? 'snow' : 'bolt';
// 아이와 나가 노는 시간(10:00~18:00)의 시간대별 예보만 본다.
// 하루 최대 강수확률은 새벽·밤 값이 섞여 우천 판단에 부정확해서 쓰지 않는다.
const PLAY_FROM = 10, PLAY_TO = 18;
async function loadWeather() {
  try {
    const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=37.5665&longitude=126.978&hourly=precipitation_probability,precipitation,weathercode&daily=temperature_2m_max,temperature_2m_min&timezone=Asia%2FSeoul&forecast_days=16');
    const j = await r.json();
    const byDay = {};
    j.hourly.time.forEach((t, i) => {
      const hr = Number(t.slice(11, 13));
      if (hr < PLAY_FROM || hr >= PLAY_TO) return;
      (byDay[t.slice(0, 10)] ??= []).push({ hr, p: j.hourly.precipitation_probability[i] ?? 0, mm: j.hourly.precipitation[i] ?? 0, code: j.hourly.weathercode[i] });
    });
    S.weather = Object.fromEntries(j.daily.time.map((t, i) => {
      const hrs = byDay[t] ?? [];
      const maxP = Math.max(0, ...hrs.map(h => h.p)), sumMm = hrs.reduce((acc, h) => acc + h.mm, 0);
      const start = hrs.find(h => h.mm >= 0.5)?.hr; // 눈에 띄게 오기 시작하는 시각
      // rain: 비 옴 / chance: 올 수도 있음 / low: 확률은 있으나 예상 강수 거의 없음 / dry: 걱정 없음
      const status = start != null || sumMm >= 1 ? 'rain' : maxP >= 60 || sumMm >= 0.1 ? 'chance' : maxP >= 40 ? 'low' : 'dry';
      return [t, { code: (hrs.find(h => h.hr === 13) ?? hrs[0])?.code ?? 0, max: Math.round(j.daily.temperature_2m_max[i]), min: Math.round(j.daily.temperature_2m_min[i]),
        status, start: start ?? hrs.find(h => h.mm >= 0.1)?.hr, maxP, sumMm: Math.round(sumMm * 10) / 10 }];
    }));
  } catch { S.weather = {}; }
}
const wxShort = w => w.status === 'rain' ? (w.start != null ? `${w.start}시부터 비` : '비 예보') : w.status === 'chance' ? '비 올 수도 있어요'
  : w.status === 'low' ? '비 걱정 적어요' : '비 걱정 없어요';
function wxPill(day) {
  const w = S.weather?.[day]; if (!w) return '';
  const rainy = w.status === 'rain';
  return `<div class="wx ${rainy ? 'rain' : ''}">${I(rainy || w.status === 'chance' ? 'rain' : wxIcon(w.code))}<span>${w.min}~${w.max}° · ${rainy ? wxShort(w) : '낮 ' + wxShort(w)}</span></div>`;
}
// 이번 주말 두 날의 놀이 시간대 날씨 요약 (예: "토 비 걱정 없어요 · 일 13시부터 비")
function weekendWx(w0, w1) {
  const days = [...new Set([w0, w1])].filter(d => S.weather?.[d]);
  return days.length ? days.map(d => `${DOW[parse(d).getDay()]} ${wxShort(S.weather[d])}`).join(' · ') : '';
}
const INDOOR = new Set(['kidsmuseum', 'science', 'experience', 'safety', 'museum']);   // 비 와도 갈 수 있는 실내 장소
// 비 예보가 있는 날(오늘·이번 주말) 홈에 띄우는 실내 대안 카드
function rainCard(days, indoor, kc) {
  const label = days[0] === TODAY ? '오늘' : days.length > 1 ? '이번 주말' : `${DOW[parse(days[0]).getDay()]}요일`;
  const w = S.weather[days[0]];
  const n = kc.events.length;
  return `<section class="sec rain-card">
    <div class="sec-head"><div><h2>${I('rain')} ${label}은 실내가 좋아요</h2><p class="sec-sub">${esc(wxShort(w))} · 비 와도 아이와 놀 수 있는 곳이에요</p></div></div>
    ${indoor.length ? `<div class="rail">${indoor.map(placeCard).join('')}</div>` : ''}
    ${n ? `<button class="go-btn rain-go" data-go="kidscafe">실내 가볼 만한 곳</button>` : ''}
  </section>`;
}
const rainSoon = days => days.some(d => ['rain', 'chance'].includes(S.weather?.[d]?.status));

/* ---------- 공통 조각 ---------- */
const thumb = e => `<img src="img/i-${catImg(e)}.jpg" alt="">${e.image ? `<img class="ev" src="${esc(e.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}`;
const heartBtn = e => `<button class="heart ${S.saved.has(e.id) ? 'on' : ''}" data-heart="${esc(e.id)}" aria-label="저장">${I('heart')}</button>`;
const statusBadge = e => !e.status ? '' : e.status === '접수중' ? '<span class="badge open">접수중</span>'
  : e.status === '안내중' ? '<span class="badge soon">접수 예정</span>' : '<span class="badge">마감</span>';
const badgesHtml = e => `${e.dow_label ? `<span class="badge wk">${e.dow_label} 한정</span>` : ''}${statusBadge(e)}<span class="badge">${CAT[e.category] ?? '기타'}</span>${e.is_free === 1 ? '<span class="badge free">무료</span>' : ''}${e.family ? '<span class="badge kid">아이와</span>' : ''}`;

// 목록용 배지: 한정·접수 상태 / 무료 / 아이와 (분류는 아래 줄 글자로 옮겨 덜 복잡하게)
const rowBadges = e => `${e.dow_label ? `<span class="badge wk">${e.dow_label} 한정</span>` : statusBadge(e)}${e.is_free === 1 ? '<span class="badge free">무료</span>' : ''}${e.family ? '<span class="badge kid">아이와</span>' : ''}`;

function rowHtml(e) {
  S.cache.set(e.id, e);
  return `<div class="row" data-id="${esc(e.id)}" role="button" tabindex="0">
    <div class="ph">${thumb(e)}${e.category === 'festival' ? '<span class="fest-star" title="축제" aria-label="축제">★</span>' : ''}</div>
    <div class="body">
      <div class="badges">${rowBadges(e)}</div>
      <h3>${esc(e.title)}</h3>
      <div class="meta">${whenText(e)}${e.time ? ' · ' + esc(e.time) : ''}</div>
      <div class="meta dim">${CAT[e.category] ?? '기타'} · ${esc(where(e))}</div>
    </div>${heartBtn(e)}</div>`;
}
function pickSlide(e) {
  S.cache.set(e.id, e);
  return `<button class="car-slide pick" data-id="${esc(e.id)}">
    <div class="pick-bg ${e.image ? '' : 'none'}"${e.image ? ` style="background-image:url('${esc(e.image)}')"` : ''}></div>
    <div class="pick-text">
      <span class="eyebrow">아빠 PICK</span><span class="locchip">${esc(e.gu)}${e.dong ? ' ' + esc(e.dong) : ''}</span>
      <h2>${esc(e.title)}</h2>
      <p>${whenText(e)}${e.place ? ' · ' + esc(e.place) : ''}</p>
      <div class="badges">${rowBadges(e)}</div>
    </div>
    <div class="pick-img"><img src="img/i-${catImg(e)}.jpg" alt=""><img class="ev" src="${esc(e.image)}" alt="" referrerpolicy="no-referrer" onload="this.classList.toggle('fit', this.naturalWidth / this.naturalHeight > 1.2)" onerror="this.remove()"></div>
  </button>`;
}

// 아빠 PICK 에 늘 넣는 장소(이름이 정확히 같은 장소). 행사 추천과 상관없이 항상 첫 추천으로 나온다.
const PINNED_PLACES = ['고양어린이박물관'];
function pickPlaceSlide(p) {
  S.cache.set(p.id, p);
  return `<button class="car-slide pick" data-place="${esc(p.id)}">
    <div class="pick-bg ${p.image ? '' : 'none'}"${p.image ? ` style="background-image:url('${esc(p.image)}')"` : ''}></div>
    <div class="pick-text">
      <span class="eyebrow">아빠 PICK</span><span class="locchip">${p.region === '서울' ? '' : '경기 '}${esc(p.gu)}${p.dong ? ' ' + esc(p.dong) : ''}</span>
      <h2>${esc(p.name)}</h2>
      <p>${esc(p.hours || p.fee || KIND[p.kind] || '')}</p>
      <div class="badges">${placeBadges(p)}</div>
    </div>
    <div class="pick-img"><img src="${placeImg(p)}" alt="">${p.image ? `<img class="ev" src="${esc(p.image)}" alt="" referrerpolicy="no-referrer" onload="this.classList.toggle('fit', this.naturalWidth / this.naturalHeight > 1.2)" onerror="this.remove()">` : ''}</div>
  </button>`;
}

// 상단 배너: 첫 슬라이드는 브랜드 히어로, 이어서 '아빠 PICK' 추천 행사가 자동으로 넘어간다
let carTimer = null, carHold = null;
function setupCarousel() {
  clearInterval(carTimer);
  const track = $('#carTrack');
  if (!track || track.children.length < 2) return;
  const n = track.children.length, dots = [...document.querySelectorAll('#carDots i')];
  const cur = () => Math.round(track.scrollLeft / track.clientWidth);
  track.addEventListener('scroll', () => dots.forEach((d, i) => d.classList.toggle('on', i === cur())), { passive: true });
  let paused = false, resume, hover = false;
  track.addEventListener('mouseenter', () => { hover = true; });
  track.addEventListener('mouseleave', () => { hover = false; });
  const hold = () => { paused = true; clearTimeout(resume); resume = setTimeout(() => (paused = false), 7000); }; // 손대면 잠시 멈춤
  carHold = hold;
  ['pointerdown', 'touchstart', 'wheel'].forEach(ev => track.addEventListener(ev, hold, { passive: true }));
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  // 시작 화면이 사라진 뒤부터 시간을 세므로, 처음 보이는 건 항상 첫 슬라이드(히어로)다
  let last = Date.now();
  carTimer = setInterval(() => {
    if (document.querySelector('#splash') || paused || hover || document.hidden || S.tab !== 'home' || !detail.hidden || !searchEl.hidden) { last = Date.now(); return; }
    if (Date.now() - last < 4200) return;
    last = Date.now();
    track.scrollTo({ left: ((cur() + 1) % n) * track.clientWidth, behavior: 'smooth' });
  }, 400);
}

function pcardHtml(e) {
  S.cache.set(e.id, e);
  return `<button class="pcard" data-id="${esc(e.id)}">
    <div class="ph">${thumb(e)}<div class="tags">${e.is_free === 1 ? '<span class="tag free">무료</span>' : ''}${e.family ? '<span class="tag kid">아이와</span>' : ''}</div></div>
    <h3>${esc(e.title)}</h3>
    <div class="m">${e.dong ? esc(e.dong) + ' · ' : ''}${whenText(e)}</div>
  </button>`;
}
const placeImg = p => `img/i-${KIND_IMG[p.kind] ?? 'weekend'}.jpg`;
const placeThumb = p => `<img src="${placeImg(p)}" alt="">${p.image ? `<img class="ev" src="${esc(p.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}`;
const placeBadges = p => `<span class="badge kind">${KIND[p.kind] ?? '장소'}</span>${p.free === 1 ? '<span class="badge free">무료</span>' : ''}`;
function placeRow(p) {
  S.cache.set(p.id, p);
  return `<div class="row" data-place="${esc(p.id)}" role="button" tabindex="0">
    <div class="ph">${placeThumb(p)}</div>
    <div class="body">
      <div class="badges">${placeBadges(p)}</div>
      <h3>${esc(p.name)}</h3>
      <div class="meta">${esc(p.region)} ${esc(p.gu)}${p.dist != null ? ' · ' + distText(p) : ''}</div>
      <div class="meta dim">${esc(p.hours || p.fee || p.addr)}</div>
    </div>${heartBtn(p)}</div>`;
}
function placeCard(p) {
  S.cache.set(p.id, p);
  return `<button class="pcard" data-place="${esc(p.id)}">
    <div class="ph">${placeThumb(p)}<div class="tags"><span class="tag">${KIND[p.kind] ?? '장소'}</span>${p.free === 1 ? '<span class="tag free">무료</span>' : ''}</div></div>
    <h3>${esc(p.name)}</h3>
    <div class="m">${esc(p.gu)}${p.dong ? ' ' + esc(p.dong) : ''}${p.dist != null ? ' · ' + distText(p) : ''}</div>
  </button>`;
}
// ---- 구·동 단위로 묶어 보여 주기 ----
const koSort = (a, b) => a.localeCompare(b, 'ko');
// 추천 목록 순서: 내 구 → 서울의 다른 구 → 경기, 같은 구 안에서는 동 가나다 순(동 정보가 없으면 맨 뒤)
const mineFirst = x => (x.gu === S.gu && (x.region ?? '서울') === '서울' ? 0 : 1);
const RG_ORDER = { 서울: 0, 경기: 1 };
const byArea = (a, b) => mineFirst(a) - mineFirst(b) || (RG_ORDER[a.region ?? '서울'] ?? 9) - (RG_ORDER[b.region ?? '서울'] ?? 9)
  || koSort(a.gu, b.gu) || ((a.dong || '') === '') - ((b.dong || '') === '') || koSort(a.dong || '', b.dong || '');
const groupBy = (list, keyFn) => { const m = new Map(); for (const x of list) { const k = keyFn(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); } return m; };
const groupBox = (title, count, rows) => `<div class="gbox"><div class="grp"><b>${title}</b><span>${count}</span></div><div class="list">${rows}</div></div>`;
// 선택한 구의 행사를 동별로. 한 묶음 안에서는 이 기간에 시작하는 행사를 날짜순으로, 이미 진행 중이던 장기 행사는 뒤에 둔다
function groupedEvents(events) {
  const ongoing = e => e.start_date < S.from;
  const scan = [...events].sort((a, b) => ongoing(a) - ongoing(b)
    || (ongoing(a) ? a.end_date.localeCompare(b.end_date) : a.start_date.localeCompare(b.start_date)) || koSort(a.title, b.title));
  const g = groupBy(scan, e => e.dong || '');
  const keys = [...g.keys()].sort((a, b) => (a === '') - (b === '') || koSort(a, b)); // '그 밖의 지역'은 맨 뒤
  return keys.map(k => groupBox(esc(k || '그 밖의 지역'), `${g.get(k).length}건`, g.get(k).map(rowHtml).join(''))).join('');
}
// 가볼 곳: 서울 → 경기, 내 구가 맨 위, 구(시) › 동 순. '가까운 순'이면 묶지 않고 거리순
function groupedPlaces(list) {
  if (S.placeSort === 'near') return `<div class="list">${list.map(placeRow).join('')}</div>`;
  const RG = { 서울: 0, 경기: 1 };
  const g = groupBy(list, p => `${p.region}|${p.gu}|${p.dong || ''}`);
  const mine = k => (k.startsWith('서울|') && k.split('|')[1] === S.gu ? 0 : 1);
  const keys = [...g.keys()].sort((a, b) => {
    const [ra, ga, da] = a.split('|'), [rb, gb, db] = b.split('|');
    return mine(a) - mine(b) || (RG[ra] ?? 9) - (RG[rb] ?? 9) || koSort(ga, gb) || (da === '') - (db === '') || koSort(da, db);
  });
  return keys.map(k => { const [r, gu, d] = k.split('|'); return groupBox(`${r === '서울' ? '' : '경기 '}${esc(gu)} › ${esc(d || '그 밖의 지역')}`, `${g.get(k).length}곳`, g.get(k).map(placeRow).join('')); }).join('');
}
const emptyHtml = (title, msg) => `<div class="empty"><img src="img/empty.jpg" alt=""><b>${title}</b>${msg}</div>`;

/* ---------- 홈 ---------- */
function updatedLabel() {
  if (!S.meta?.generatedAt) return '';
  const d = new Date(new Date(S.meta.generatedAt).getTime() + 9 * 3600 * 1000); // 한국 시간
  return `마지막 업데이트 ${d.getUTCMonth() + 1}.${d.getUTCDate()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
async function renderHome() {
  const [w0, w1] = weekendOf(TODAY);
  const near = nearPoint();
  const rainDays = [...new Set([TODAY, w0, w1])].filter(d => S.weather?.[d]?.status === 'rain');   // 비 예보가 있는 날(오늘·이번 주말)
  const [wk, td, kc, fest, soon, pl, pinnedRes, indoorRes] = await Promise.all([
    api('/api/events', { gu: S.gu, from: w0, to: w1 }),
    api('/api/events', { gu: S.gu, from: TODAY, to: TODAY }),
    api('/api/events', { gu: S.gu, from: TODAY, to: w1, cat: 'kidscafe' }),
    api('/api/events', { gu: S.gu, from: TODAY, to: addDays(TODAY, 13), cat: 'festival' }),
    api('/api/events', { gu: S.gu, from: TODAY, to: addDays(TODAY, 13) }),
    api('/api/places', { near, limit: 12 }).catch(() => ({ places: [], total: 0 })),
    Promise.all(PINNED_PLACES.map(n => api('/api/places', { q: n, limit: 10 }).then(r => r.places.find(p => p.name === n)).catch(() => null))),
    rainDays.length ? api('/api/places', { near, limit: 80 }).catch(() => ({ places: [] })) : Promise.resolve({ places: [] }),
  ]);
  const indoor = indoorRes.places.filter(p => INDOOR.has(p.kind)).sort((a, b) => (a.dist ?? 1e9) - (b.dist ?? 1e9)).slice(0, 10);
  const pinned = pinnedRes.filter(Boolean); // 데이터에 없으면 건너뛴다
  pl.places.sort((a, b) => byArea(a, b) || (a.dist ?? 1e9) - (b.dist ?? 1e9));
  const sc = [['today', 'sun', '오늘'], ['weekend', 'sparkle', '이번 주말'], ['free', 'gift', '무료'], ['kids', 'smile', '아이와'], ['festival', 'flag', '축제']];

  const section = (title, list, more, sub = '', cap = 10) => list.events.length ? `
    <section class="sec">
      <div class="sec-head"><div><h2>${title}</h2>${sub ? `<p class="sec-sub">${sub}</p>` : ''}</div><button class="more" data-go="${more}">더보기${I('chevR')}</button></div>
      <div class="rail">${list.events.slice(0, cap).map(pcardHtml).join('')}</div>
    </section>` : '';

  // 아빠 PICK 선정 — ① 축제 우선 ② 가까운 일정 우선(이번 주말 단기 행사 → 2주 안에 시작 → 오래 진행 중) ③ 아이와 가기 좋은 순, 날짜 빠른 순
  // (예약이 끝난 행사는 제외, 최대 5개)
  const closed = e => e.status && e.status !== '접수중' && e.status !== '안내중';
  const spanDays = e => (Date.parse(e.end_date) - Date.parse(e.start_date)) / 864e5;
  const nearGroup = e => (e.start_date <= w1 && e.end_date >= w0 && spanDays(e) <= 7 ? 0 : e.start_date > w1 ? 1 : 2);
  const pool = [...kc.events.filter(e => e.dow), ...fest.events, ...wk.events, ...soon.events, ...td.events];
  const seenPick = new Set();
  const picks = pool.filter(e => !closed(e) && !seenPick.has(e.id) && seenPick.add(e.id))
    .sort((a, b) => (a.category === 'festival' ? 0 : 1) - (b.category === 'festival' ? 0 : 1)
      || nearGroup(a) - nearGroup(b)
      || b.family - a.family
      || (nearGroup(a) === 2 ? a.end_date.localeCompare(b.end_date) : a.start_date.localeCompare(b.start_date))
      || spanDays(a) - spanDays(b))
    .slice(0, 5)
    .sort(byArea); // 고르는 기준은 그대로(축제 → 가까운 일정), 넘어가는 순서만 구 → 동

  view.innerHTML = `
    <section class="hero-car">
      <div class="car-track" id="carTrack">
        <div class="car-slide hero">
          <img class="hero-img" src="img/hero.jpg" alt="">
          ${wxPill(TODAY)}
          <div class="hero-text">
            <span class="eyebrow">${esc(S.gu)}</span>
            <h2>우리 가족의 주말을<br>지켜주는 히어로</h2>
            <p>오늘 ${td.total}건 · 이번 주말 ${wk.total}건${kc.total ? ` · 키즈카페 ${kc.total}곳` : ''}</p>
          </div>
        </div>
        ${pinned.map(pickPlaceSlide).join('')}${picks.map(pickSlide).join('')}
      </div>
      ${picks.length + pinned.length ? `<div class="car-ctl"><button class="car-btn" data-car="-1" aria-label="이전 배너">${I('back')}</button><div class="car-dots" id="carDots">${['', ...pinned, ...picks].map((_, i) => `<i data-slide="${i}" class="${i === 0 ? 'on' : ''}"></i>`).join('')}</div><button class="car-btn" data-car="1" aria-label="다음 배너">${I('chevR')}</button></div>` : ''}
    </section>
    <section class="sec"><div class="shortcuts">${sc.map(([k, , t]) => `<button data-go="${k}"><span class="tile"><img src="img/i-${k}.jpg" alt=""></span>${t}</button>`).join('')}</div></section>
    <section class="sec whatnow-sec"><button class="whatnow" data-whatnow>${I('sparkle')}<span>오늘 뭐 하지? 하나 골라줘</span></button></section>
    ${section('이번 주말 축제·행사', { events: [...wk.events].sort((a, b) => (a.category === 'festival' ? 0 : 1) - (b.category === 'festival' ? 0 : 1) || byArea(a, b) || a.start_date.localeCompare(b.start_date) || koSort(a.title, b.title)) }, 'weekend', `${weekendWx(w0, w1) ? weekendWx(w0, w1) + ' · ' : ''}축제를 먼저, 구·동 순서로 모았어요`, 20)}
    ${rainDays.length ? rainCard(rainDays, indoor, kc) : ''}
    ${pl.places.length ? `<section class="sec">
      <div class="sec-head"><div><h2>아이와 가볼 만한 곳</h2><p class="sec-sub">${esc(near?.label ?? '')}에서 가까운 12곳 · 구·동 순서</p></div><button class="more" data-tab-go="places">더보기${I('chevR')}</button></div>
      <div class="rail">${pl.places.map(placeCard).join('')}</div></section>` : ''}
    ${section('아이와 가기 좋은 키즈카페', kc, 'kidscafe', rainSoon([TODAY, w0, w1]) ? '비 소식이 있는 날엔 실내가 좋아요' : '날씨와 상관없이 신나게 놀 수 있어요')}
    ${!wk.events.length && !kc.events.length && !pl.places.length ? `<section class="sec">${emptyHtml('지금 등록된 행사가 없어요', `${esc(S.gu)}의 행사를 아직 찾지 못했어요.<br>다른 지역을 골라 보세요.`)}</section>` : ''}
    <p class="foot-note">${updatedLabel()}<br>행사 정보 출처: 서울 열린데이터광장(문화행사), 서울시 공공서비스예약, 우리동네 키움포털, 전국문화축제표준데이터, 한국관광공사<br>일정과 요금은 바뀔 수 있으니 방문 전에 확인해 주세요</p>`;
  setupCarousel();
}

/* ---------- 캘린더 ---------- */
async function renderCal() {
  const first = parse(S.anchor); first.setDate(1);
  let cells = [];
  if (S.weekOnly) {
    const a = parse(S.anchor); a.setDate(a.getDate() - a.getDay());
    for (let i = 0; i < 7; i++) { const d = new Date(a); d.setDate(a.getDate() + i); cells.push(iso(d)); }
  } else {
    const start = new Date(first); start.setDate(1 - first.getDay());
    const rows = Math.ceil((first.getDay() + new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()) / 7);
    for (let i = 0; i < rows * 7; i++) { const d = new Date(start); d.setDate(start.getDate() + i); cells.push(iso(d)); }
  }
  const months = [...new Set(cells.map(c => c.slice(0, 7)))];
  const [cals, list] = await Promise.all([
    Promise.all(months.map(m => api('/api/calendar', { month: m, gu: S.gu, ...filterParams() }))),
    api('/api/events', { gu: S.gu, from: S.from, to: S.to, ...filterParams() }),
  ]);
  const days = Object.assign({}, ...cals.map(c => c.days));
  const curMonth = S.anchor.slice(0, 7);
  const a0 = parse(cells[0]);
  const title = S.weekOnly ? `${a0.getMonth() + 1}월 ${Math.ceil((a0.getDate() + 6) / 7)}주` : `${parse(S.anchor).getFullYear()}년 ${parse(S.anchor).getMonth() + 1}월`;

  const cellHtml = d => {
    const info = days[d], dt = parse(d), inRange = d >= S.from && d <= S.to, multi = S.from !== S.to;
    const cls = ['day', dt.getDay() === 0 ? 'sun' : dt.getDay() === 6 ? 'sat' : '', d === TODAY ? 'today' : '',
      !S.weekOnly && d.slice(0, 7) !== curMonth ? 'out' : '',
      inRange && multi ? 'range' : '', inRange && multi && d === S.from ? 'rs' : '', inRange && multi && d === S.to ? 're' : '',
      inRange && !multi ? 'sel' : ''].join(' ');
    const pt = `<span class="pt">${info?.s || ''}</span>`; // 7일 이하 단기 행사 수만 표시
    return `<button class="${cls}" data-day="${d}"><span class="n">${dt.getDate()}</span>${pt}</button>`;
  };

  const m = modeOf();
  const head = rangeLabel(S.from, S.to);
  view.innerHTML = `
    <div class="quick">
      <button data-quick="today" class="${m === 'today' ? 'on' : ''}">오늘</button>
      <button data-quick="tomorrow" class="${m === 'tomorrow' ? 'on' : ''}">내일</button>
      <button data-quick="weekend" class="${m === 'weekend' ? 'on' : ''}">이번 주말</button>
    </div>
    <div class="cal">
      <div class="cal-head"><h2>${title}</h2>
        <div class="nav"><button class="toggle" data-weektoggle>${S.weekOnly ? '월간' : '주간'}</button>
        <button data-nav="-1" aria-label="이전">${I('back')}</button><button data-nav="1" aria-label="다음">${I('chevR')}</button></div></div>
      <div class="grid">${DOW.map(d => `<div class="dow">${d}</div>`).join('')}${cells.map(cellHtml).join('')}</div>
    </div>
    <section class="sec">
      <div class="chips">
        <button class="chip kid ${S.family ? 'on' : ''}" data-f="family">아이와</button>
        <button class="chip free ${S.free ? 'on' : ''}" data-f="free">무료만</button>
        <span class="sep"></span>
        ${[['', '전체'], ...Object.entries(CAT)].map(([k, v]) => `<button class="chip ${S.cat === k ? 'on' : ''}" data-cat="${k}">${v}</button>`).join('')}
      </div>
      <div class="result-head" style="margin-top:18px"><h2>${head}</h2><span>${esc(S.gu)} · ${list.total}건</span></div>
      ${list.events.length ? groupedEvents(list.events)
        : emptyHtml('이 날은 행사가 없어요', `다른 날짜나 지역을 골라 보세요.${S.family || S.free || S.cat ? '<br>필터를 풀면 더 나올 수 있어요.' : ''}`)}
      ${list.total > list.events.length ? `<p class="foot-note" style="padding-bottom:0">상위 ${list.events.length}건만 보여요. 필터로 좁혀 보세요.</p>` : ''}
    </section>`;
}

/* ---------- 구 지도 ---------- */
const SCALE = ['#ECE6FC', '#D3C6F7', '#B39FF0', '#9479E6', '#6A4FCC'];
async function renderMap() {
  if (!S.mapData) S.mapData = await (await fetch('seoul-map.json')).json();
  const sum = (await api('/api/summary', { from: S.from, to: S.to, ...filterParams() })).gu;
  const max = Math.max(1, ...Object.values(sum).map(v => v.n));
  const fill = n => !n ? '#EDEFF2' : SCALE[Math.min(4, Math.ceil((n / max) * 5) - 1)];
  const { viewBox, districts } = S.mapData;
  const n = sum[S.gu]?.n ?? 0;
  view.innerHTML = `
    <div class="map-sub"><b>${rangeLabel(S.from, S.to)}</b> 기준 구별 행사 수예요. 지역을 눌러 골라 보세요.</div>
    <div class="map-card">
      <svg viewBox="${viewBox}" role="img" aria-label="서울 구 지도">
        <defs><filter id="mapShadow" x="-5%" y="-5%" width="110%" height="115%"><feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#5A43B0" flood-opacity=".22"/></filter>
          <filter id="selGlow" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#6A4FCC" flood-opacity=".45"/></filter></defs>
        <g filter="url(#mapShadow)">${districts.filter(d => d.name !== S.gu).map(d => `<path data-gu="${d.name}" d="${d.d}" fill="${fill(sum[d.name]?.n)}" fill-rule="evenodd"/>`).join('')}</g>
        ${districts.filter(d => d.name === S.gu).map(d => `<path data-gu="${d.name}" d="${d.d}" fill="${fill(sum[d.name]?.n)}" fill-rule="evenodd" class="sel" filter="url(#selGlow)"/>`).join('')}
        ${districts.map(d => { const c = sum[d.name]?.n ?? 0, dark = c / max > .6; return `<text class="${dark ? 'lt' : ''} ${d.name === S.gu ? 'sel' : ''}" x="${d.cx}" y="${d.cy - 1}">${d.name.replace(/구$/, '')}<tspan class="cnt" x="${d.cx}" dy="13">${c || ''}</tspan></text>`; }).join('')}
      </svg>
      <div class="legend">적음 ${SCALE.map(c => `<i style="background:${c}"></i>`).join('')} 많음 <span style="margin-left:auto">회색 = 없음</span></div>
    </div>
    <div class="map-go"><button class="go-btn" data-gotab="cal">${esc(S.gu)} 행사 ${n}건 보기</button></div>
    <section class="sec"><div class="gu-list">${districts.map(d => `<button data-gu="${d.name}" class="${d.name === S.gu ? 'on' : ''}">${d.name}<small>${sum[d.name]?.n ?? 0}건</small></button>`).join('')}</div></section>`;
}

/* ---------- 지도에서 고른 구의 소아청소년과(진료 시간·공휴일·야간) ---------- */
// 법정 공휴일(대체공휴일 포함). 해마다 갱신이 필요하다.
const HOLIDAYS = new Set(['2026-01-01', '2026-02-16', '2026-02-17', '2026-02-18', '2026-03-01', '2026-03-02', '2026-05-05', '2026-05-24', '2026-05-25', '2026-06-03', '2026-06-06', '2026-08-15', '2026-08-17', '2026-09-24', '2026-09-25', '2026-09-26', '2026-10-03', '2026-10-05', '2026-10-09', '2026-12-25',
  '2027-01-01', '2027-02-06', '2027-02-07', '2027-02-08', '2027-02-09', '2027-03-01', '2027-05-05', '2027-05-13', '2027-06-06', '2027-08-15', '2027-08-16', '2027-09-14', '2027-09-15', '2027-09-16', '2027-10-03', '2027-10-04', '2027-10-09', '2027-10-11', '2027-12-25']);
const HDAY = ['월', '화', '수', '목', '금', '토', '일', '공휴일'];
const HFILTERS = [['now', '지금 진료 중'], ['hol', '공휴일 진료'], ['night', '야간 진료'], ['sun', '일요일 진료'], ['sat', '토요일 진료']];
const hhmm = v => `${Number(v.slice(0, 2))}:${v.slice(2)}`;
const hRange = r => (r ? `${hhmm(r[0])}~${hhmm(r[1])}` : '휴진');
const isNight = h => [0, 1, 2, 3, 4].some(i => h.h[i] && h.h[i][1] >= '2000');   // 평일 저녁 8시 이후까지
function hospNow() {
  const d = new Date(), t = pad(d.getHours()) + pad(d.getMinutes());
  return { t, idx: HOLIDAYS.has(iso(d)) ? 7 : (d.getDay() + 6) % 7 };
}
const hospOpen = (h, now) => { const r = h.h[now.idx]; return !!r && now.t >= r[0] && now.t < r[1]; };
const hospMatch = (h, now) => [...S.hosp].every(f => (f === 'now' ? hospOpen(h, now) : f === 'hol' ? !!h.h[7] : f === 'sun' ? !!h.h[6] : f === 'sat' ? !!h.h[5] : isNight(h)));
function hospRow(h, now) {
  const open = hospOpen(h, now), r = h.h[now.idx];
  const state = open ? '<span class="badge open-now">지금 진료 중</span>' : r ? '<span class="badge">진료 시간 아님</span>' : `<span class="badge">오늘 ${now.idx === 7 ? '공휴일 ' : ''}휴진</span>`;
  // 네이버 지도는 접속이 막히는 경우가 있어, 좌표가 있으면 카카오맵(핀 + 길찾기 버튼)으로 연다
  const mapUrl = h.lat && h.lng ? `https://map.kakao.com/link/map/${encodeURIComponent(h.n)},${h.lat},${h.lng}` : `https://map.kakao.com/link/search/${encodeURIComponent('서울 ' + h.n)}`;
  return `<div class="hosp-row">
    <div class="hosp-top"><b>${esc(h.n)}</b>${state}</div>
    <div class="hosp-badges">${h.er ? `<span class="badge er">${esc(h.er)}</span>` : ''}${h.h[7] ? '<span class="badge hol">공휴일 진료</span>' : ''}${h.h[6] ? '<span class="badge">일요일</span>' : ''}${isNight(h) ? '<span class="badge night">야간</span>' : ''}</div>
    <div class="hosp-meta">${esc(h.a)} · 오늘 ${now.idx === 7 ? '(공휴일) ' : ''}${hRange(r)}</div>
    ${h.e ? `<div class="hosp-note">${esc(h.e)}</div>` : ''}
    <details class="hosp-week"><summary>요일별 진료 시간</summary><div>${HDAY.map((n, i) => `<span class="${i === now.idx ? 'today' : ''}"><i>${n}</i>${hRange(h.h[i])}</span>`).join('')}</div></details>
    <div class="hosp-act">${h.t ? `<a href="tel:${esc(h.t.replace(/[^0-9+]/g, ''))}">전화 ${esc(h.t)}</a>` : ''}<a href="${mapUrl}" target="_blank" rel="noopener">지도·길찾기</a></div>
  </div>`;
}
async function renderHosp() {
  if (!S.mapData) S.mapData = await (await fetch('seoul-map.json')).json();
  view.innerHTML = '<section class="sec hosp" id="hospSec"></section>';
  await drawHosp();
}
async function drawHosp() {
  if (!$('#hospSec')) return;
  const gu = S.gu;
  let data;
  try { data = await loadHospitals(gu); } catch { if (S.gu === gu && $('#hospSec')) $('#hospSec').innerHTML = `<div class="sec-head"><div><h2>${esc(gu)} 소아청소년과</h2></div></div>${emptyHtml('병원 정보를 불러오지 못했어요', '잠시 뒤 다시 시도해 주세요.')}`; return; }
  const box = $('#hospSec'); if (!box || S.gu !== gu) return;   // 그 사이 다른 구/탭으로 바뀜
  const now = hospNow();
  const all = data.items, list = all.filter(h => hospMatch(h, now))
    .sort((a, b) => hospOpen(b, now) - hospOpen(a, now) || (!!b.er - !!a.er) || a.n.localeCompare(b.n, 'ko'));
  const openN = all.filter(h => hospOpen(h, now)).length, shown = list.slice(0, 40);
  box.innerHTML = `
    <div class="sec-head"><div><h2>${esc(gu)} 소아청소년과</h2><p class="sec-sub">지금 진료 중 ${openN}곳 · 전체 ${all.length}곳 · 진료 시간표 기준이에요</p></div><button class="hosp-gu" data-gotab="map">지역 바꾸기</button></div>
    <div class="chips" style="margin-bottom:8px">${HFILTERS.map(([k, l]) => `<button class="chip ${S.hosp.has(k) ? 'on' : ''}" data-hf="${k}">${l}</button>`).join('')}</div>
    <div class="result-head"><h2>${S.hosp.size ? '조건에 맞는 곳' : '전체'}</h2><span>${list.length}곳</span></div>
    ${shown.length ? shown.map(h => hospRow(h, now)).join('') : emptyHtml('조건에 맞는 병원이 없어요', '필터를 풀어 보세요.')}
    ${list.length > shown.length ? `<p class="foot-note" style="padding-bottom:0">상위 ${shown.length}곳만 보여요. 필터로 좁혀 보세요.</p>` : ''}
    <p class="foot-note" style="padding-bottom:0">출처: 국립중앙의료원 전국 병·의원 찾기 서비스 · 점심시간·접수마감·임시 휴진은 다를 수 있어요. 방문 전 전화로 꼭 확인하세요.</p>`;
}

/* ---------- 가볼 곳 (상시 운영 장소) ---------- */
async function renderPlaces() {
  const near = nearPoint();
  const [all, list] = await Promise.all([
    api('/api/places', { near, limit: 500 }),
    api('/api/places', { near, region: S.placeRegion, kind: S.placeKind, limit: 200 }),
  ]);
  const kinds = Object.keys(KIND).filter(k => all.places.some(p => p.kind === k));
  const regions = [...new Set(all.places.map(p => p.region))];
  view.innerHTML = `
    <section class="sec">
      <div class="sec-head"><div><h2>가볼 만한 곳</h2><p class="sec-sub">${S.placeSort === 'near' ? `${esc(near?.label ?? '')}에서 가까운 순` : `${esc(S.gu)}를 맨 위에, 구·동별로 모았어요`} · 문 여는 시간과 휴관일을 확인하세요</p></div></div>
      ${regions.length > 1 ? `<div class="chips" style="margin-bottom:8px"><button class="chip ${!S.placeRegion ? 'on' : ''}" data-pregion="">전체 지역</button>${regions.map(r => `<button class="chip ${S.placeRegion === r ? 'on' : ''}" data-pregion="${esc(r)}">${esc(r)}</button>`).join('')}</div>` : ''}
      <div class="chips"><button class="chip ${!S.placeKind ? 'on' : ''}" data-pkind="">전체</button>${kinds.map(k => `<button class="chip ${S.placeKind === k ? 'on' : ''}" data-pkind="${k}">${KIND[k]}</button>`).join('')}</div>
      <div class="seg"><button class="${S.placeSort === 'area' ? 'on' : ''}" data-psort="area">지역별</button><button class="${S.placeSort === 'near' ? 'on' : ''}" data-psort="near">가까운 순</button></div>
      <div class="result-head" style="margin-top:14px"><h2>${S.placeKind ? KIND[S.placeKind] : '전체'}</h2><span>${list.total}곳</span></div>
      ${list.places.length ? groupedPlaces(list.places) : emptyHtml('아직 등록된 곳이 없어요', '다른 분류를 골라 보세요.')}
      <p class="foot-note" style="padding-bottom:0">출처: 서울시 문화공간 정보, 한국관광공사(TourAPI) · 사진 일부는 공공누리 1·3유형 · 운영 시간과 요금은 바뀔 수 있어요</p>
    </section>`;
}

/* ---------- 저장 ---------- */
async function renderSaved() {
  const ids = [...S.saved];
  if (!ids.length) { view.innerHTML = `<section class="sec" style="min-height:60%">${emptyHtml('저장한 곳이 없어요', '마음에 드는 행사나 장소의 하트를 눌러 두면 여기 모여요.')}</section>`; return; }
  const [{ events }, { places }] = await Promise.all([
    api('/api/events', { ids: ids.join(',') }),
    api('/api/places', { ids: ids.join(',') }).catch(() => ({ places: [] })),
  ]);
  const gone = ids.length - events.length - places.length;
  events.sort((a, b) => a.start_date.localeCompare(b.start_date));
  view.innerHTML = `<section class="sec"><div class="result-head"><h2>저장한 목록</h2><span>${events.length + places.length}건</span></div>
    <button class="share-all" data-share-all>${I('share')}저장한 ${events.length + places.length}곳 한 번에 공유하기</button>
    <div class="list">${events.map(rowHtml).join('')}${places.map(placeRow).join('')}</div>
    ${gone > 0 ? `<p class="foot-note">종료되었거나 사라진 행사 ${gone}건은 숨겼어요.</p>` : ''}</section>`;
}

/* ---------- 상세 (전체 화면) ---------- */
const detail = $('#detail'), searchEl = $('#search');

// 축제는 어느 지역·출처든 '무엇을 하는지'를 먼저 보여 주는 축제용 상세로 보여 준다
const isFest = e => e.category === 'festival';
function festFacts(e) {
  const d = new Date(`${e.start_date}T00:00:00`), n = Math.round((d - new Date(`${TODAY}T00:00:00`)) / 864e5);
  const multi = e.end_date && e.end_date !== e.start_date;
  const dd = n > 0 ? `D-${n}` : (multi && e.end_date >= TODAY) || n === 0 ? (n === 0 ? '오늘' : '진행 중') : '종료';
  return `<div class="facts">
    <div><b>날짜</b><span>${multi ? md(e.start_date) + '~' + md(e.end_date) : md(e.start_date)}</span></div>
    <div><b>${multi ? '기간' : '동네'}</b><span>${multi ? Math.round((new Date(e.end_date) - d) / 864e5) + 1 + '일간' : esc(e.dong || e.gu)}</span></div>
    <div><b>남은 날</b><span>${dd}</span></div>
  </div>`;
}
// desc 텍스트(프로그램:/주최·주관:/문의:/· 항목)를 읽기 쉬운 카드로
function festCard(t) {
  const prog = [], bullets = [], text = []; let host = '', tel = '';
  for (const l of t.split('\n').map(x => x.trim()).filter(Boolean)) {
    let m;
    if ((m = l.match(/^프로그램:\s*(.+)/))) prog.push(...m[1].split(/\s*[+,，/ㆍ·]\s*/).map(x => x.replace(/\s*등$/, '').trim()).filter(x => x && x !== '등'));
    else if ((m = l.match(/^주최·주관:\s*(.+)/))) host = m[1];
    else if ((m = l.match(/^문의:\s*(.+)/))) tel = m[1];
    else if (l.startsWith('·')) bullets.push(l.replace(/^·\s*/, ''));
    else text.push(l);
  }
  const phone = (tel.match(/\d{2,4}-\d{3,4}-\d{4}|\d{8,}/) || [])[0] || '';
  const li = b => { const i = b.indexOf(':'); return i > 0 && i < 24 ? `<li><b>${esc(b.slice(0, i))}</b>${esc(b.slice(i + 1).trim())}</li>` : `<li>${esc(b)}</li>`; };
  const html = `<section class="fest-card"><h3>이런 걸 해요</h3>
    ${text.length ? `<p class="fest-text">${esc(text.join('\n'))}</p>` : ''}
    ${prog.length ? `<div class="chips">${prog.map(p => `<span>${esc(p)}</span>`).join('')}</div>` : ''}
    ${bullets.length ? `<ul class="fest-list">${bullets.map(li).join('')}</ul>` : ''}
    ${host || tel ? `<div class="fest-meta">${host ? `<p><b>주최·주관</b>${esc(host)}</p>` : ''}${tel ? `<p><b>문의</b>${phone ? `<a href="tel:${phone.replace(/\D/g, '')}">${esc(tel)}</a>` : esc(tel)}</p>` : ''}</div>` : ''}
  </section>`;
  return { html: prog.length || bullets.length || text.length || host || tel ? html : '', phone };
}
function openDetail(id, push = true) {
  const e = S.cache.get(id); if (!e) return;
  const media = e.image
    ? `<div class="bg" style="background-image:url('${esc(e.image)}')"></div><img class="main" src="${esc(e.image)}" alt="" referrerpolicy="no-referrer" onload="this.parentNode.classList.toggle('wide', this.naturalWidth / this.naturalHeight >= 1.9)" onerror="this.remove()">`
    : `<img class="cover" src="img/i-${catImg(e)}.jpg" alt="">`;
  const map = e.place ? `https://map.kakao.com/link/search/${encodeURIComponent((e.place.includes(e.gu) ? '' : e.gu + ' ') + e.place)}` : '';
  detail.innerHTML = `<div class="screen">
    <div class="d-scroll">
      <div class="d-media">${media}
        <div class="d-nav"><button data-close aria-label="뒤로">${I('back')}</button></div>
      </div>
      <div class="d-body">
        <div class="badges">${badgesHtml(e)}</div>
        <h2>${esc(e.title)}</h2>
        ${isFest(e) ? festFacts(e) : `<div class="facts">
          <div><b>요금</b><span>${e.is_free === 1 ? '무료' : e.is_free === 0 ? '유료' : '정보 없음'}</span></div>
          <div><b>대상</b><span>${esc((e.target || '제한 없음').replace(/\s*\(.*?\)/g, '').slice(0, 9))}</span></div>
          <div><b>상태</b><span>${e.dow_label ? esc(e.dow_label) + ' 한정' : e.status ? esc(e.status) : e.start_date > TODAY ? '예정' : '진행 중'}</span></div>
        </div>`}
        ${isFest(e) ? '<div id="festBox"></div>' : ''}
        <div class="info">
          <div>${I('calendar')}<p><b>일정</b><span>${whenText(e)}${e.time ? ' · ' + esc(e.time) : ''}</span></p></div>
          <div>${I('pin')}<p><b>장소</b><span>${esc(where(e))}</span>${map ? `<a class="mini" target="_blank" rel="noopener" href="${map}">지도 보기</a>` : ''}</p></div>
          ${e.rcpt_start ? `<div>${I('clock')}<p><b>예약 접수</b><span>${md(e.rcpt_start)} ~ ${md(e.rcpt_end)}${e.status ? ' · ' + esc(e.status) : ''}</span></p></div>` : ''}
          ${e.fee && !/^(무료|유료)$/.test(e.fee.trim()) ? `<div>${I('ticket')}<p><b>요금 안내</b><span>${esc(e.fee)}</span></p></div>` : ''}
          ${e.target && (e.target.length > 9 || /\(/.test(e.target)) ? `<div>${I('users')}<p><b>대상 안내</b><span>${esc(e.target)}</span></p></div>` : ''}
        </div>
        <p class="d-desc" id="dDesc" hidden></p>
        <p class="d-note">${e.source === 'manual' || e.source_note ? (e.source_note || '직접 확인해 등록한 정보예요.') : ({ yeyak: '서울시 공공서비스예약 정보(공공누리 1유형) 기준이에요.', yeogijeogi: '서울시 우리동네 키움포털 정보 기준이에요.', 'culture-festival': '전국문화축제표준데이터(공공데이터포털, 지자체 등록) 기준이에요.', 'tourapi-festival': '한국관광공사 TourAPI 정보 기준이에요.' }[e.source] ?? '서울 열린데이터광장(서울시 문화행사 정보) 기준이에요.')}${e.image_license ? ` 사진은 한국관광공사 제공(공공누리 제${e.image_license.slice(-1)}유형).` : ''} 일정·요금·접수 상태는 바뀔 수 있으니 방문 전에 상세 페이지에서 확인해 주세요.</p>
      </div>
    </div>
    <div class="d-bar">
      <button class="sq ${S.saved.has(id) ? 'on' : ''}" data-dheart="${esc(id)}" aria-label="저장">${I('heart')}</button>
      <button class="sq" data-share="${esc(id)}" aria-label="공유">${I('share')}</button>
      ${e.link ? `<a class="cta" target="_blank" rel="noopener" href="${esc(e.link)}">${e.source === 'yeogijeogi' ? '예약하러 가기' : e.source === 'yeyak' ? (e.status === '접수중' ? '예약하러 가기' : '예약 페이지 보기') : '상세 정보 보기'}</a>`
        : map ? `<a class="cta ghost" target="_blank" rel="noopener" href="${map}">지도에서 보기</a>` : `<span class="cta ghost">상세 링크가 없어요</span>`}
    </div></div>`;
  detail.hidden = false;
  loadDesc(e).then(t => {
    if (isFest(e)) {
      const box = $('#festBox'); if (!t || !box) return;
      const c = festCard(t); box.innerHTML = c.html;
      const cta = $('.d-bar .cta.ghost');   // 링크가 없는 축제는 '지도에서 보기' 대신 전화 문의를 큰 버튼으로
      if (c.phone && cta && !e.link) { cta.className = 'cta'; cta.outerHTML = `<a class="cta" href="tel:${c.phone.replace(/\D/g, '')}">전화로 문의하기</a>`; }
      return;
    }
    const el = $('#dDesc'); if (t && el) { el.textContent = t; el.hidden = false; }
  }).catch(() => {});
  if (push) history.pushState({ screen: 'detail' }, '');
}
function openPlace(id, push = true) {
  const p = S.cache.get(id); if (!p) return;
  const near = nearPoint(), dist = p.lat != null && near ? km(near, p) : null;
  const q = encodeURIComponent(`${p.name} ${p.addr}`);
  const map = p.lat != null && p.lng != null ? `https://map.kakao.com/link/map/${encodeURIComponent(p.name)},${p.lat},${p.lng}` : `https://map.kakao.com/link/search/${q}`;
  detail.innerHTML = `<div class="screen">
    <div class="d-scroll">
      <div class="d-media">${p.image ? `<div class="bg" style="background-image:url('${esc(p.image)}')"></div><img class="main" src="${esc(p.image)}" alt="" referrerpolicy="no-referrer" onload="this.parentNode.classList.toggle('wide', this.naturalWidth / this.naturalHeight >= 1.9)" onerror="this.remove()">` : `<img class="cover" src="${placeImg(p)}" alt="">`}
        <div class="d-nav"><button data-close aria-label="뒤로">${I('back')}</button></div>
      </div>
      <div class="d-body">
        <div class="badges">${placeBadges(p)}</div>
        <h2>${esc(p.name)}</h2>
        <div class="facts">
          <div><b>분류</b><span>${KIND[p.kind] ?? '장소'}</span></div>
          <div><b>요금</b><span>${p.free === 1 ? '무료' : p.free === 0 ? '유료' : '문의'}</span></div>
          <div><b>거리</b><span>${dist == null ? '-' : distText({ dist })}</span></div>
        </div>
        <div class="info">
          <div>${I('pin')}<p><b>주소</b><span>${esc(p.addr)}</span><a class="mini" target="_blank" rel="noopener" href="${map}">지도 보기</a></p></div>
          ${p.hours ? `<div>${I('clock')}<p><b>운영 시간</b><span>${esc(p.hours)}</span></p></div>` : ''}
          ${p.closed ? `<div>${I('calendar')}<p><b>휴관일</b><span>${esc(p.closed)}</span></p></div>` : ''}
          ${p.fee ? `<div>${I('ticket')}<p><b>요금 안내</b><span>${esc(p.fee)}</span></p></div>` : ''}
          ${p.stroller ? `<div>${I('users')}<p><b>유모차</b><span>${esc(p.stroller)}</span></p></div>` : ''}
          ${p.tel ? `<div>${I('users')}<p><b>문의</b><a class="mini" style="margin:0;font-size:15px" href="tel:${esc(p.tel)}">${esc(p.tel)}</a></p></div>` : ''}
        </div>
        ${p.desc ? `<p class="d-desc">${esc(p.desc)}</p>` : ''}
        <p class="d-note">${p.source === 'tourapi' || p.imageLicense ? '한국관광공사 TourAPI' : '서울시 문화공간 정보'} 기준이에요.${p.imageLicense ? ` 사진은 한국관광공사 제공(공공누리 제${p.imageLicense.slice(-1)}유형).` : ''} 운영 시간·휴관일·요금은 바뀔 수 있으니 방문 전에 홈페이지나 전화로 확인해 주세요.</p>
      </div>
    </div>
    <div class="d-bar">
      <button class="sq ${S.saved.has(id) ? 'on' : ''}" data-dheart="${esc(id)}" aria-label="저장">${I('heart')}</button>
      <button class="sq" data-share-place="${esc(id)}" aria-label="공유">${I('share')}</button>
      ${p.url ? `<a class="cta" target="_blank" rel="noopener" href="${esc(p.url)}">홈페이지 보기</a>` : `<a class="cta" target="_blank" rel="noopener" href="${map}">지도에서 보기</a>`}
    </div></div>`;
  detail.hidden = false;
  if (push) history.pushState({ screen: 'detail' }, '');
}
/* ---------- 오늘 뭐 하지? — 오늘 날씨·요일만 보고 하나를 골라 준다(아이 나이는 반영하지 않음) ---------- */
const pickSeen = new Set();   // 다시 뽑을 때 같은 곳이 연달아 나오지 않게
const RAIN_OK = new Set(['kidscafe', 'exhibit', 'edu', 'show']);   // 비 오는 날엔 실내에서 할 법한 행사만
async function pickToday() {
  const wx = S.weather?.[TODAY];
  const rain = wx?.status === 'rain', chance = wx?.status === 'chance';
  const extreme = !wx ? null : wx.max >= 32 ? 'hot' : (wx.max <= 2 || wx.min <= -8) ? 'cold' : null;   // 폭염·한파면 실내를 더 권한다
  const [evRes, plRes] = await Promise.all([
    api('/api/events', { gu: S.gu, from: TODAY, to: TODAY }),
    api('/api/places', { near: nearPoint(), limit: 80 }),
  ]);
  const cands = [];
  const climate = (indoorOk, base, onRain) => rain ? onRain : extreme ? (indoorOk ? '날씨가 ' + (extreme === 'hot' ? '무더워서' : '추워서') + ' 실내에서 즐길 수 있는 곳으로 골랐어요' : base) : base;
  for (const e of evRes.events) {
    if (e.status && e.status !== '접수중' && e.status !== '안내중') continue;   // 마감된 예약 행사 제외
    const text = `${e.title} ${e.place ?? ''}`;
    if (!inSeason(text)) continue;
    const indoorOk = RAIN_OK.has(e.category);
    if (rain && !indoorOk) continue;                                             // 비 오는 날엔 실내에서 할 법한 행사만
    let w = (e.category === 'festival' ? 3 : 1) * (e.family ? 2 : 1) * (e.is_free === 1 ? 1.5 : 1) * (e.category === 'kidscafe' ? 1.5 : 1);
    if (extreme) w *= indoorOk ? 2 : 0.3;
    else if (chance && indoorOk) w *= 1.3;
    const seasonal = isSeasonal(text);
    if (seasonal) w *= 2;
    const base = seasonal ? '지금이 제철이에요' : e.category === 'festival' ? '오늘 열리는 축제예요' : e.category === 'kidscafe' ? '날씨 걱정 없이 놀 수 있는 키즈카페예요' : e.is_free === 1 ? '오늘 무료로 즐길 수 있어요' : e.family ? '아이와 함께 가기 좋은 행사예요' : '오늘 열리는 행사예요';
    cands.push({ type: 'event', item: e, w, reason: climate(indoorOk, base, '비 예보가 있어서 실내에서 즐길 수 있는 곳으로 골랐어요') });
  }
  for (const pl of plRes.places) {
    const indoorOk = INDOOR.has(pl.kind);
    if (rain && !indoorOk) continue;
    let w = (rain ? 2.5 : 1.5) * (pl.dist != null && pl.dist < 5 ? 1.5 : 1);
    if (extreme) w *= indoorOk ? 2.5 : 0.4;
    else if (chance && indoorOk) w *= 1.3;
    const seasonal = isSeasonal(pl.name);   // 철 아닌 장소는 목록 단계에서 이미 빠져 있다
    if (seasonal) w *= 2;
    cands.push({ type: 'place', item: pl, w, reason: climate(indoorOk, seasonal ? '지금이 제철이에요' : '아이와 함께 가기 좋은, 가까운 곳이에요', '비 오는 날 가기 좋은 실내 장소예요') });
  }
  let pool = cands.filter(c => !pickSeen.has(c.item.id));
  if (!pool.length) { pickSeen.clear(); pool = cands; }
  if (!pool.length) return null;
  let r = Math.random() * pool.reduce((a, c) => a + c.w, 0), pick = pool[pool.length - 1];
  for (const c of pool) { if ((r -= c.w) <= 0) { pick = c; break; } }
  pickSeen.add(pick.item.id);
  return pick;
}
async function showWhatNow(push) {
  let pick;
  try { pick = await pickToday(); } catch { pick = null; }
  if (!pick) {
    detail.innerHTML = `<div class="screen"><div class="d-scroll"><div class="d-media"><img class="cover" src="img/i-weekend.jpg" alt=""><div class="d-nav"><button data-close aria-label="뒤로">${I('back')}</button></div></div>
      <div class="d-body"><h2>오늘은 딱 맞는 곳을 못 찾았어요</h2><p class="d-desc">${esc(S.gu)}에서 오늘 갈 만한 곳이 없어요. 지역을 바꾸거나 이번 주말 행사를 둘러보세요.</p></div></div></div>`;
  } else {
    const { type, item: x, reason } = pick;
    S.cache.set(x.id, x);
    const media = type === 'event'
      ? (x.image ? `<div class="bg" style="background-image:url('${esc(x.image)}')"></div><img class="main" src="${esc(x.image)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : `<img class="cover" src="img/i-${catImg(x)}.jpg" alt="">`)
      : (x.image ? `<div class="bg" style="background-image:url('${esc(x.image)}')"></div><img class="main" src="${esc(x.image)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : `<img class="cover" src="${placeImg(x)}" alt="">`);
    const title = type === 'event' ? x.title : x.name;
    const meta = type === 'event' ? `${whenText(x)}${x.time ? ' · ' + esc(x.time) : ''}<br>${esc(where(x))}` : `${esc(x.addr || '')}${x.hours ? '<br>' + esc(x.hours) : ''}`;
    detail.innerHTML = `<div class="screen">
      <div class="d-scroll">
        <div class="d-media">${media}<div class="d-nav"><button data-close aria-label="뒤로">${I('back')}</button></div></div>
        <div class="d-body">
          <div class="pick-why">${I('sparkle')}<span>오늘의 추천</span></div>
          <h2>${esc(title)}</h2>
          <p class="pick-reason">${esc(reason)}</p>
          <div class="badges">${type === 'event' ? rowBadges(x) : placeBadges(x)}</div>
          <p class="pick-meta">${meta}</p>
        </div>
      </div>
      <div class="d-bar">
        <button class="cta ghost" data-whatnow-again>다른 곳 골라줘</button>
        <button class="cta" ${type === 'event' ? `data-id="${esc(x.id)}"` : `data-place="${esc(x.id)}"`}>자세히 보기</button>
      </div></div>`;
  }
  detail.hidden = false;
  if (push) history.pushState({ screen: 'detail' }, '');
}
function hideScreens() { detail.hidden = true; searchEl.hidden = true; }
function closeScreen() { if (history.state?.screen) history.back(); else hideScreens(); }
window.addEventListener('popstate', () => {
  if (!detail.hidden && !searchEl.hidden) { detail.hidden = true; return; }
  if (!detail.hidden || !searchEl.hidden) return hideScreens();
  if (tabStack.length) setTabBack(tabStack.pop());
});
function setTabBack(t) { S.tab = t; render(false); }   // 이전 탭으로 복귀(스택·기록은 건드리지 않는다)

/* ---------- 스마트폰 뒤로가기(안드로이드 앱) ---------- */
// 열린 화면 닫기 → 이전 탭 → 홈에서 2번 눌러야 종료
let exitArmed = false;
window.Capacitor?.Plugins?.App?.addListener('backButton', () => {
  if (!detail.hidden || !searchEl.hidden) return closeScreen();
  if (tabStack.length) return history.back();
  if (exitArmed) return window.Capacitor.Plugins.App.exitApp();
  exitArmed = true; toast('한 번 더 누르면 앱이 종료돼요');
  setTimeout(() => (exitArmed = false), 2000);
});

/* ---------- 검색 ---------- */
function openSearch(q = '') {
  searchEl.innerHTML = `<div class="screen">
    <div class="s-top"><button class="icon-btn" data-close aria-label="뒤로">${I('back')}</button>
      <label class="field">${I('search')}<input id="sInput" type="search" placeholder="행사명, 장소로 검색" autocomplete="off" value="${esc(q)}"></label></div>
    <div class="s-scope" id="sScope"></div>
    <div class="s-body" id="sBody"></div></div>`;
  searchEl.hidden = false;
  history.pushState({ screen: 'search' }, '');
  drawScope(); runSearch();
  const input = $('#sInput'); input.focus();
  input.addEventListener('input', debounce(runSearch, 250));
}
function drawScope() {
  $('#sScope').innerHTML = `<button class="chip ${S.searchAll ? '' : 'on'}" data-scope="gu">${esc(S.gu)}</button><button class="chip ${S.searchAll ? 'on' : ''}" data-scope="all">서울 전체</button>`;
}
async function runSearch() {
  const q = ($('#sInput')?.value ?? '').trim(), body = $('#sBody'); if (!body) return;
  if (!q) {
    body.innerHTML = `<div class="empty" style="padding-top:36px"><b>어떤 행사를 찾으세요?</b>행사 이름이나 장소로 검색해 보세요.<br><br>
      <span class="chips" style="justify-content:center;flex-wrap:wrap;margin:0">${['축제', '전시', '체험', '공원', '도서관', '콘서트'].map(k => `<button class="chip" data-kw="${k}">${k}</button>`).join('')}</span></div>`;
    return;
  }
  const [r, pr] = await Promise.all([api('/api/events', { q, all: 1, from: TODAY, to: addDays(TODAY, 365), gu: S.searchAll ? '' : S.gu }), api('/api/places', { q, near: nearPoint(), limit: 6 }).catch(() => ({ places: [] }))]);
  if (($('#sInput')?.value ?? '').trim() !== q) return; // 입력이 바뀌었으면 버림
  const placeHtml = pr.places.length ? `<div class="result-head" style="margin-top:6px"><h2>가볼 만한 곳</h2><span>${pr.places.length}곳</span></div><div class="list" style="margin:0 -16px">${pr.places.map(placeRow).join('')}</div>` : '';
  body.innerHTML = placeHtml + (r.events.length
    ? `<div class="result-head" style="margin-top:6px"><h2>검색 결과</h2><span>${r.total}건</span></div><div class="list" style="margin:0 -16px">${r.events.map(rowHtml).join('')}</div>`
    : pr.places.length ? '' : emptyHtml('검색 결과가 없어요', S.searchAll ? '다른 단어로 찾아 보세요.' : '“서울 전체”로 넓혀 보세요.'));
}

/* ---------- 공유·저장 ---------- */
async function sharePlace(id) {
  const p = S.cache.get(id); if (!p) return;
  const text = `${p.name}\n${p.region} ${p.gu} · ${p.addr}`, url = p.url || `${location.origin}${location.pathname}?p=${encodeURIComponent(id)}`;
  try {
    if (navigator.share) await navigator.share({ title: p.name, text, url });
    else { await navigator.clipboard.writeText(`${text}\n${url}`); toast('복사했어요'); }
  } catch { /* 공유 취소 */ }
}
function toggleSave(id) {
  S.saved.has(id) ? S.saved.delete(id) : S.saved.add(id);
  store.set('saved', [...S.saved]);
  toast(S.saved.has(id) ? '저장했어요' : '저장을 뺐어요');
}
// 저장한 행사·장소를 글 하나로 묶어 카카오톡 등으로 보낸다(앞에서 10개까지, 링크는 항목마다)
async function shareAll() {
  const items = [...S.saved].map(id => S.cache.get(id)).filter(Boolean);
  if (!items.length) return toast('공유할 저장 목록이 없어요');
  const root = `${location.origin}${location.pathname}`;
  const lines = items.sort((a, b) => (a.start_date ?? '9').localeCompare(b.start_date ?? '9')).slice(0, 10).map((x, i) => {
    const isPlace = x.name != null;
    const url = isPlace ? (x.url || `${root}?p=${encodeURIComponent(x.id)}`) : `${root}?d=${encodeURIComponent(x.id)}&g=${encodeURIComponent(x.gu)}`;
    return `${i + 1}. ${isPlace ? x.name : x.title}\n   ${isPlace ? `${x.region} ${x.gu}` : `${rangeLabel(x.start_date, x.end_date)} · ${where(x)}`}\n   ${url}`;
  });
  const text = `[아빠 오늘 어디가] 같이 가요! 저장한 ${items.length}곳${items.length > 10 ? ' 중 10곳' : ''}\n\n${lines.join('\n')}`;
  try {
    if (navigator.share) await navigator.share({ title: '아빠 오늘 어디가', text });
    else { await navigator.clipboard.writeText(text); toast('목록을 복사했어요'); }
  } catch { /* 공유 취소 */ }
}
async function share(id) {
  const e = S.cache.get(id); if (!e) return;
  const text = `${e.title}\n${rangeLabel(e.start_date, e.end_date)} · ${where(e)}`;
  const url = `${location.origin}${location.pathname}?d=${encodeURIComponent(id)}&g=${encodeURIComponent(e.gu)}`;
  try {
    if (navigator.share) await navigator.share({ title: e.title, text, url });
    else { await navigator.clipboard.writeText(`${text}\n${url}`); toast('링크를 복사했어요'); }
  } catch { /* 공유 취소 */ }
}

/* ---------- 헤더·탭·렌더 ---------- */
const TABS = [['home', 'home', '홈'], ['cal', 'calendar', '캘린더'], ['places', 'compass', '가볼 곳'], ['map', 'map', '지도'], ['hosp', 'hospital', '병원'], ['saved', 'heart', '저장']];
function renderChrome() {
  $('#regionBtn').innerHTML = `${I('pin')}${esc(S.gu)}`;
  $('#searchBtn').innerHTML = I('search');
  $('#tabs').innerHTML = TABS.map(([k, ic, t]) => `<button data-tab="${k}" class="${S.tab === k ? 'on' : ''}">${I(ic)}<span>${t}</span></button>`).join('');
}
const SK_ROW = '<div class="sk-item"><i class="sk sk-img"></i><div><b class="sk sk-line w80"></b><b class="sk sk-line w50"></b><b class="sk sk-line w65"></b></div></div>';
const skeleton = tab => tab === 'home'
  ? `<div class="sk sk-hero"></div><div class="sec"><div class="sk-tiles">${'<i class="sk sk-tile"></i>'.repeat(5)}</div></div><div class="sec"><b class="sk sk-line w40"></b><div class="rail">${'<div class="sk sk-card"></div>'.repeat(3)}</div></div>`
  : `<div class="sec">${SK_ROW.repeat(5)}</div>`;

async function render(keepScroll = true) {
  clearInterval(carTimer);
  const y = keepScroll ? view.scrollTop : 0;
  renderChrome();
  if (!keepScroll && S.tab !== 'saved') view.innerHTML = skeleton(S.tab); // 탭·지역을 바꿀 때 빈 화면 대신 뼈대
  try {
    await ({ home: renderHome, cal: renderCal, places: renderPlaces, map: renderMap, hosp: renderHosp, saved: renderSaved }[S.tab])();
  } catch (err) {
    console.error(err);
    view.innerHTML = `<section class="sec">${emptyHtml('불러오지 못했어요', '서버 연결을 확인하고 다시 시도해 주세요.')}</section>`;
  }
  view.scrollTop = y;
}
// 탭을 바꾸면 화면이 옆으로 밀리며 넘어간다(오른쪽 탭이면 왼쪽으로, 왼쪽 탭이면 오른쪽으로)
const tabStack = [];   // 뒤로가기로 돌아갈 이전 탭들
function setTab(t) {
  if (t !== S.tab) { tabStack.push(S.tab); history.pushState({ tab: true }, ''); }
  const from = TABS.findIndex(x => x[0] === S.tab), to = TABS.findIndex(x => x[0] === t);
  if (t === S.tab || from < 0 || to < 0 || matchMedia('(prefers-reduced-motion: reduce)').matches) { S.tab = t; return render(false); }
  const dir = to > from ? 1 : -1, app = $('#app'), r = view.getBoundingClientRect(), ar = app.getBoundingClientRect();
  const ghost = document.createElement('div');   // 떠나는 화면의 복사본
  ghost.className = 'view-ghost'; ghost.innerHTML = view.innerHTML;
  Object.assign(ghost.style, { top: r.top - ar.top + 'px', left: r.left - ar.left + 'px', width: r.width + 'px', height: r.height + 'px' });
  ghost.scrollTop = view.scrollTop; app.appendChild(ghost); ghost.scrollTop = view.scrollTop;
  const opt = { duration: 150, easing: 'cubic-bezier(.22,.8,.3,1)' };
  ghost.animate([{ transform: 'none' }, { transform: `translateX(${-100 * dir}%)` }], opt).finished.then(() => ghost.remove(), () => ghost.remove());
  S.tab = t; render(false);
  view.animate([{ transform: `translateX(${100 * dir}%)` }, { transform: 'none' }], opt);
}
function go(kind) {
  S.family = false; S.free = false; S.cat = '';
  if (kind === 'today') setRange(TODAY, TODAY);
  else if (kind === 'weekend') setRange(...weekendOf(TODAY));
  else if (kind === 'free') { S.free = true; setRange(TODAY, addDays(TODAY, 6)); }
  else if (kind === 'kids') { S.family = true; setRange(...weekendOf(TODAY)); }
  else if (kind === 'festival') { S.cat = 'festival'; setRange(TODAY, addDays(TODAY, 13)); }
  else if (kind === 'kidscafe') { S.cat = 'kidscafe'; setRange(TODAY, weekendOf(TODAY)[1]); }
  setTab('cal');
}
const refreshDetailHeart = id => { const b = detail.querySelector('[data-dheart]'); if (b) b.classList.toggle('on', S.saved.has(id)); };

document.addEventListener('click', e => {
  const t = e.target;
  const heart = t.closest('[data-heart]');
  if (heart) { toggleSave(heart.dataset.heart); heart.classList.toggle('on', S.saved.has(heart.dataset.heart)); if (S.tab === 'saved') render(); return; }
  const dh = t.closest('[data-dheart]');
  if (dh) { toggleSave(dh.dataset.dheart); refreshDetailHeart(dh.dataset.dheart); return; }
  if (t.closest('[data-share-all]')) return shareAll();
  const sh = t.closest('[data-share]'); if (sh) return share(sh.dataset.share);
  const shp = t.closest('[data-share-place]'); if (shp) return sharePlace(shp.dataset.sharePlace);
  if (t.closest('[data-close]')) return closeScreen();
  const cb = t.closest('[data-car]');
  if (cb) {
    carHold?.();
    const tr = $('#carTrack'), n = tr.children.length, i = Math.round(tr.scrollLeft / tr.clientWidth);
    tr.scrollTo({ left: ((i + Number(cb.dataset.car) + n) % n) * tr.clientWidth, behavior: 'smooth' });
    return;
  }
  const dot = t.closest('[data-slide]');
  if (dot) { carHold?.(); const tr = $('#carTrack'); tr.scrollTo({ left: Number(dot.dataset.slide) * tr.clientWidth, behavior: 'smooth' }); return; }
  if (t.closest('[data-whatnow]')) return showWhatNow(true);
  if (t.closest('[data-whatnow-again]')) return showWhatNow(false);
  const pl = t.closest('[data-place]'); if (pl) return openPlace(pl.dataset.place);
  const tg = t.closest('[data-tab-go]'); if (tg) return setTab(tg.dataset.tabGo);
  const ps = t.closest('[data-psort]'); if (ps) { S.placeSort = ps.dataset.psort; return render(); }
  const pk = t.closest('[data-pkind]'); if (pk) { S.placeKind = pk.dataset.pkind; return render(); }
  const pr = t.closest('[data-pregion]'); if (pr) { S.placeRegion = pr.dataset.pregion; return render(); }
  const card = t.closest('[data-id]'); if (card) return openDetail(card.dataset.id);

  const kw = t.closest('[data-kw]');
  if (kw) { $('#sInput').value = kw.dataset.kw; return runSearch(); }
  const sc = t.closest('[data-scope]');
  if (sc) { S.searchAll = sc.dataset.scope === 'all'; drawScope(); return runSearch(); }

  const tab = t.closest('#tabs [data-tab]'); if (tab) return setTab(tab.dataset.tab);
  if (t.closest('#regionBtn')) return setTab('map');
  if (t.closest('#searchBtn')) return openSearch();
  const g = t.closest('[data-go]'); if (g) return go(g.dataset.go);
  const gt = t.closest('[data-gotab]'); if (gt) { if (S.tab === 'map') { setRange(TODAY, TODAY); } return setTab(gt.dataset.gotab); }

  const day = t.closest('[data-day]'); if (day) { setRange(day.dataset.day, day.dataset.day); return render(); }
  const quick = t.closest('[data-quick]');
  if (quick) {
    const q = quick.dataset.quick;
    if (q === 'today') setRange(TODAY, TODAY);
    else if (q === 'tomorrow') setRange(addDays(TODAY, 1), addDays(TODAY, 1));
    else setRange(...weekendOf(TODAY));
    return render();
  }
  const nav = t.closest('[data-nav]');
  if (nav) {
    const n = Number(nav.dataset.nav);
    if (S.weekOnly) S.anchor = addDays(S.anchor, 7 * n);
    else { const d = parse(S.anchor); d.setDate(1); d.setMonth(d.getMonth() + n); S.anchor = iso(d); }
    return render();
  }
  if (t.closest('[data-weektoggle]')) { S.weekOnly = !S.weekOnly; if (S.weekOnly) S.anchor = S.from; return render(); }
  const f = t.closest('[data-f]'); if (f) { S[f.dataset.f] = !S[f.dataset.f]; return render(); }
  const cat = t.closest('[data-cat]'); if (cat) { S.cat = cat.dataset.cat; return render(); }

  const hf = t.closest('[data-hf]');
  if (hf) { const k = hf.dataset.hf, had = S.hosp.has(k); S.hosp.clear(); if (!had) S.hosp.add(k); return drawHosp(); }   // 한 번에 하나만(같은 칩을 다시 누르면 전체)
  const gu = t.closest('[data-gu]');
  if (gu) { // 지도에서 지역을 고르면 가까운 순 기준도 그 지역으로 바뀐다(이전에 '내 위치로'를 눌렀어도 해제)
    const wasGps = !!S.near; S.gu = gu.dataset.gu; S.near = null; store.set('gu', S.gu);
    toast(wasGps ? `${S.gu} 기준으로 바꿨어요(내 위치 기준 해제)` : `${S.gu}로 바꿨어요`); return render();
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && (!detail.hidden || !searchEl.hidden)) closeScreen();
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('.row[data-id]')) { e.preventDefault(); openDetail(e.target.dataset.id); }
});

/* ---------- 시작 화면: 대화하듯 나오는 로딩 ---------- */
const PREP = ['피크닉 도시락 싸는 중', '돗자리 챙기는 중', '아이 양말 짝 맞추는 중', '선크림 바르는 중', '물티슈 넉넉히 넣는 중',
  '애기랑 같이 준비하는 중', '간식 몰래 한 봉지 더 넣는 중', '날씨 보고 우산 챙기는 중', '주차 자리 걱정하는 중', '아이 신발 신기는 중'];
function startSplash() {
  const el = $('#splash'), chat = $('#spChat');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let fast = reduce; // 탭하면 건너뛴다
  el.addEventListener('click', () => { fast = true; });
  const wait = ms => new Promise(r => (fast ? r() : setTimeout(r, ms)));
  const say = (who, text) => {
    const m = document.createElement('div'); m.className = `sp-msg ${who}`;
    m.innerHTML = `<img src="img/avatar-${who}.jpg" alt=""><div class="sp-bubble">${esc(text)}</div>`;
    chat.appendChild(m);
  };
  const items = [...PREP].sort(() => Math.random() - 0.5).slice(0, 3).concat('오늘 갈 곳 찾는 중');
  let list, rows = [];
  const intro = (async () => {
    await wait(250); say('kid', '아빠~ 오늘 어디가?');
    await wait(900); say('dad', '음… 잠깐만! 챙길 게 있어');
    await wait(900);
    list = document.createElement('div'); list.className = 'sp-list'; chat.appendChild(list);
    for (let i = 0; i < items.length; i++) {
      const row = document.createElement('div'); row.className = 'sp-item';
      row.innerHTML = `<i class="ck"></i><span>${esc(items[i])}</span>`; list.appendChild(row); rows.push(row);
      if (i < items.length - 1) { await wait(700); row.classList.add('done'); }
    }
  })();
  return {
    // 실제 데이터 로딩이 끝난 뒤 마지막 항목을 체크하고 닫는다
    async finish() {
      await intro; await wait(450);
      rows.at(-1)?.classList.add('done');
      await wait(350); say('dad', '다 챙겼다! 출발~');
      await wait(750);
      el.classList.add('out'); setTimeout(() => el.remove(), 500);
    },
  };
}

/* ---------- 당겨서 새로고침 ---------- */
// 목록 맨 위에서 아래로 당겼다 놓으면 최신 데이터를 다시 받는다(옆으로 미는 동작은 무시)
function setupPullRefresh() {
  const ptr = document.createElement('div'); ptr.className = 'ptr'; ptr.innerHTML = I('refresh'); $('#app').appendChild(ptr);
  const LIMIT = 64;
  let start = null, dy = 0, busy = false;
  const place = (d, anim) => {
    ptr.style.transition = anim ? 'transform .2s ease, opacity .2s ease' : 'none';
    ptr.style.transform = `translateY(${d - 48}px) rotate(${d * 4}deg)`;
    ptr.style.opacity = Math.min(1, d / LIMIT);
  };
  const reset = () => { start = null; dy = 0; ptr.classList.remove('ready'); place(0, true); };
  view.addEventListener('touchstart', e => {
    if (!busy && view.scrollTop <= 0 && e.touches.length === 1) start = { x: e.touches[0].clientX, y: e.touches[0].clientY, dir: '' };
  }, { passive: true });
  view.addEventListener('touchmove', e => {
    if (!start) return;
    const dx = e.touches[0].clientX - start.x, d = e.touches[0].clientY - start.y;
    if (!start.dir && Math.abs(dx) + Math.abs(d) > 8) start.dir = Math.abs(dx) > Math.abs(d) ? 'x' : 'y';
    if (start.dir === 'x' || d <= 0 || view.scrollTop > 0) { if (dy) reset(); else start = start.dir === 'x' || d < 0 ? null : start; return; }
    dy = Math.min(100, d * 0.5); place(dy, false); ptr.classList.toggle('ready', dy >= LIMIT);
  }, { passive: true });
  view.addEventListener('touchend', async () => {
    if (!start) return;
    if (dy < LIMIT) return reset();
    start = null; busy = true; place(LIMIT * 0.8, true); ptr.classList.add('spin');
    try { clearCache(); await render(); toast('새로 불러왔어요'); }
    finally { busy = false; ptr.classList.remove('spin'); reset(); }
  });
}

/* ---------- 상태바 글자색(안드로이드 앱) ---------- */
// 흰 상단 바 위에서는 어두운 글자, 보라 시작 화면·사진이 위에 오는 상세 화면에서는 흰 글자
let barStyle = '';
function syncBars() {
  const bars = window.Capacitor?.Plugins?.SystemBars; if (!bars) return;
  const style = document.querySelector('#splash:not(.out)') || !detail.hidden ? 'DARK' : 'LIGHT';
  if (style !== barStyle) { barStyle = style; bars.setStyle({ style, bar: 'StatusBar' }).catch(() => {}); }
}
new MutationObserver(syncBars).observe($('#app'), { subtree: true, attributes: true, attributeFilter: ['hidden', 'class'], childList: true });

(async function init() {
  view.addEventListener('scroll', () => $('.top').classList.toggle('scrolled', view.scrollTop > 4), { passive: true });
  setupPullRefresh(); syncBars();
  const splash = startSplash();
  renderChrome();
  view.innerHTML = `<div class="loading"><img src="img/logo.png" alt="">갈 곳을 찾는 중…</div>`;
  const [meta, map] = await Promise.all([api('/api/meta').catch(() => null), fetch('seoul-map.json').then(r => r.json()).catch(() => null), loadWeather()]);
  S.meta = meta; S.mapData = map;
  const qs = new URLSearchParams(location.search);
  if (['home', 'cal', 'places', 'map', 'hosp', 'saved'].includes(qs.get('tab'))) S.tab = qs.get('tab');
  if (qs.get('kind') in KIND) S.placeKind = qs.get('kind');
  if (['서울', '경기'].includes(qs.get('region'))) S.placeRegion = qs.get('region');
  await render(false);
  const d = qs.get('d'); // 공유 링크: ?d=<행사 id>&g=<구>
  if (d) {
    const found = (await loadGu(qs.get('g') || S.gu).catch(() => [])).find(e => e.id === d);
    if (found) { S.cache.set(d, found); openDetail(d, false); }
  }
  const pid = qs.get('p'); // 장소 공유 링크: ?p=<장소 id>
  if (pid) {
    const found = (await api('/api/places', { ids: pid }).catch(() => ({ places: [] }))).places[0];
    if (found) { S.cache.set(pid, found); openPlace(pid, false); }
  }
  if (qs.has('search')) openSearch(qs.get('search'));
  await splash.finish();
})();
