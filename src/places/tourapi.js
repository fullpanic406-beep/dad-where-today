// 한국관광공사 TourAPI(국문 관광정보 서비스) — 서울·경기의 아이와 가기 좋은 곳
// 어린이박물관·과학관(천문대)·체험관·안전체험관·동물원/아쿠아리움/곤충/식물원 등을 키워드로 찾아 고른다.
//
// 호출 한도: 개발 계정은 하루 1,000건 안팎이라 ① 검색은 키워드×지역 약 50회로 묶고
// ② 상세(운영 시간·요금)는 수정 시각이 바뀐 것만 새로 받도록 캐시(.cache/tourapi.json)를 쓴다.
// 사진은 공공누리 1·3유형(상업적 이용 가능)인 것만 쓴다. 2·4유형(상업적 이용 금지)은 광고가 붙는 앱에 쓸 수 없다.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from '../env.js';
import { htmlToText, clean } from '../seoul-api.js';

export const name = 'tourapi';
export const label = '한국관광공사 TourAPI(서울·경기 어린이 시설)';
export const optional = true;

const BASE = 'https://apis.data.go.kr/B551011/KorService2';
const REGIONS = { 11: '서울', 41: '경기' };
const TYPES = new Set(['12', '14', '28']); // 관광지·문화시설·레포츠 (축제·쇼핑·음식점·숙박은 제외)
const MAX_CALLS = Number(process.env.TOURAPI_MAX_CALLS) || 800; // 하루 한도(약 1,000건)를 넘지 않도록 상한

const KEYWORDS = ['어린이박물관', '어린이', '키즈', '체험관', '체험마을', '체험장', '안전체험', '안전교육', '소방', '과학관', '과학', '천문대',
  '아쿠아리움', '동물원', '곤충', '공룡', '생태체험', '생태관', '놀이', '로봇', '키자니아', '키즈파크', '대공원', '테마파크', '수목원', '식물원', '체험농장'];

// 걸러낼 말: 숙박·종교·동네 놀이터·도서관·문화원·산책길 등
const EXCLUDE = /호텔|리조트|펜션|캠핑|골프|스키|카지노|온천|사찰|교회|성당|서원|향교|고택|스테이|모텔|어린이공원|어린이꿈공원|도서관|문화원|문화회관|문화센터|스쿨|학원|수영장|둘레길|옛길|코스|탐방로|평화의 ?길|야영장|올레|트레일|글램핑|풀빌라|반려|물놀이장|산림욕장|딸기|깨달음|노동자|별산대|전수교육관/;
// 이름에 들어 있는 말로 종류를 정한다(앞에서부터 먼저 맞는 것)
const KIND = [
  ['safety', /안전체험|안전교육|안전문화|안전관|소방|119|재난|교통안전|생활안전/],
  ['kidsmuseum', /어린이박물관|어린이미술관|어린이회관|어린이과학관|키즈뮤지엄|어린이문화|키자니아|키즈파크|뽀로로/],
  ['science', /과학관|과학박물관|과학체험|천문대|천문과학|로봇|우주/],
  ['nature', /동물원|아쿠아리움|수족관|곤충|공룡|식물원|수목원|자연사|유아숲|생태체험|생태학습|생태관|생태박물관|체험농장|동물체험|동물농장/],
  // '테마파크'·'놀이'만으로는 꽃공원·수영장·전수관까지 걸려서 아이 시설을 가리키는 말로 좁혔다
  ['experience', /체험관|체험마을|체험장|체험학습|체험전시|직업체험|놀이터|놀이공원|놀이마당|놀이정원|놀이구름|놀이동산|키즈|캐릭터|서울어린이대공원|서울대공원|에버랜드|롯데월드/],
];
export const kindOf = title => (EXCLUDE.test(title) ? null : KIND.find(([, re]) => re.test(title))?.[0] ?? null);

const CACHE_FILE = process.env.TOURAPI_CACHE || path.join(ROOT, '.cache', 'tourapi.json');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const first = (o, keys) => { for (const k of keys) { const v = clean(htmlToText(o?.[k] ?? '')); if (v) return v; } return ''; };

export async function fetchPlaces(_seoulKey, log) {
  const key = (process.env.TOURAPI_KEY || '').trim();
  if (!key) throw new Error('TOURAPI_KEY 가 없어 서울·경기 TourAPI 장소는 건너뜀');
  let calls = 0;

  async function call(op, params) {
    if (calls >= MAX_CALLS) throw new Error(`호출 상한(${MAX_CALLS}회)에 도달`);
    calls++;
    const q = new URLSearchParams({ MobileOS: 'ETC', MobileApp: 'DadWhereToday', _type: 'json', ...params });
    for (let i = 1; i <= 3; i++) {
      try {
        const res = await fetch(`${BASE}/${op}?serviceKey=${key}&${q}`, { signal: AbortSignal.timeout(30000) });
        const text = await res.text();
        if (text.startsWith('<')) throw new Error(text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160)); // 키/한도 오류는 XML 로 온다
        const j = JSON.parse(text);
        const h = j.response?.header;
        if (h?.resultCode && h.resultCode !== '0000') throw new Error(`${h.resultCode} ${h.resultMsg}`);
        return j.response?.body ?? {};
      } catch (e) {
        if (i === 3 || /LIMIT|SERVICE KEY|한도|인증/i.test(e.message)) throw new Error(`${op}: ${e.message.replaceAll(key, '<KEY>')}`);
        await sleep(800 * i);
      }
    }
  }
  const itemsOf = b => { const it = b?.items?.item; return Array.isArray(it) ? it : it ? [it] : []; };

  // 1) 키워드 × 지역(서울·경기) 검색
  const found = new Map();
  for (const kw of KEYWORDS) {
    for (const reg of Object.keys(REGIONS)) {
      for (let page = 1; page <= 4; page++) {
        const b = await call('searchKeyword2', { keyword: kw, lDongRegnCd: reg, numOfRows: '100', pageNo: String(page) });
        const its = itemsOf(b);
        for (const it of its) if (!found.has(it.contentid)) found.set(it.contentid, it);
        if (page * 100 >= (b.totalCount ?? 0) || !its.length) break;
      }
      await sleep(60);
    }
    log(`TourAPI 검색 ${kw} (${found.size}곳, 호출 ${calls})`);
  }

  // 2) 이름·유형으로 아이와 가기 좋은 곳만 선별
  const picks = [...found.values()].filter(x => TYPES.has(x.contenttypeid) && REGIONS[x.lDongRegnCd] && kindOf(x.title))
    .map(x => ({ x, kind: kindOf(x.title) }));

  // 3) 상세(운영 시간·요금·홈페이지·설명): 수정 시각이 같으면 캐시를 쓴다
  const cache = existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, 'utf8')) : {};
  let fresh = 0;
  try {
    for (const { x } of picks) {
      const c = cache[x.contentid];
      if (c && c.m === x.modifiedtime) continue;
      try {
        const common = itemsOf(await call('detailCommon2', { contentId: x.contentid }))[0] ?? {};
        const intro = itemsOf(await call('detailIntro2', { contentId: x.contentid, contentTypeId: x.contenttypeid }))[0] ?? {};
        cache[x.contentid] = { m: x.modifiedtime, common, intro };
        fresh++;
      } catch (e) {
        if (/상한|LIMIT|한도/i.test(e.message)) break; // 한도에 닿으면 남은 곳은 상세 없이 기본 정보로 진행(다음 실행에서 이어서 받음)
        throw e;
      }
      if (fresh % 20 === 0) log(`TourAPI 상세 ${fresh}곳 (호출 ${calls})`);
    }
  } finally {
    // 중간에 실패해도 지금까지 받은 상세는 저장해 두어 다음 실행에서 호출을 아낀다
    mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(cache));
  }
  log(`TourAPI 완료: 선별 ${picks.length}곳, 새 상세 ${fresh}곳, 호출 ${calls}회`);

  // 4) 우리 형식으로 변환
  const out = [];
  for (const { x, kind } of picks) {
    const d = cache[x.contentid] ?? {}, cm = d.common ?? {}, it = d.intro ?? {};
    const addr = clean(`${x.addr1} ${x.addr2 ?? ''}`);
    const lat = parseFloat(x.mapy), lng = parseFloat(x.mapx);
    const fee = first(it, ['usefee', 'usefeeleports']);
    const homepage = (clean(cm.homepage).match(/href=["']([^"']+)["']/) ?? [])[1] ?? clean(htmlToText(cm.homepage)).split(/\s/)[0] ?? '';
    const licenseOk = ['Type1', 'Type3'].includes(x.cpyrhtDivCd); // 상업적 이용 가능한 사진만
    out.push({
      id: 'place:tour:' + x.contentid, source: name, name: clean(x.title).replace(/^\[[^\]]*\]\s*/, ''), kind,
      region: REGIONS[x.lDongRegnCd], gu: (addr.split(' ')[1] ?? ''), addr,
      lat: Number.isFinite(lat) ? lat : null, lng: Number.isFinite(lng) ? lng : null,
      tel: first(it, ['infocenterculture', 'infocenter', 'infocenterleports']) || clean(cm.tel),
      url: /^https?:\/\//.test(homepage) ? homepage : homepage ? `http://${homepage}` : '',
      hours: first(it, ['usetimeculture', 'usetime', 'usetimeleports']),
      closed: first(it, ['restdateculture', 'restdate', 'restdateleports']),
      fee, free: fee ? (/무료/.test(fee) && !/\d\s*원/.test(fee) ? 1 : null) : null,
      stroller: first(it, ['chkbabycarriageculture', 'chkbabycarriage', 'chkbabycarriageleports']),
      image: licenseOk ? clean(x.firstimage) : '', imageLicense: licenseOk ? x.cpyrhtDivCd : '',
      desc: clean(htmlToText(cm.overview)).slice(0, 400),
    });
  }
  return out;
}
