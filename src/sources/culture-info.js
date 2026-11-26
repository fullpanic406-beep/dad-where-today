// 한국문화정보원 한눈에보는문화정보조회서비스(공공데이터포털, apis.data.go.kr/B553457/cultureinfo) — 서울
// 문화체육관광부·산하기관·문화포털에 올라온 공연·전시·교육/체험·축제. 서울시 문화행사 API 에 없는
// 국립 기관·공연장의 어린이·가족 프로그램을 보완한다. 아이와 갈 만한 것(isFamily)·아동/가족·행사/축제만 담는다.
// 키: CULTURE_INFO_KEY(.env·GitHub secret). 같은 행사는 ingest 가 앞 소스와 합친다.
import { clean, htmlToText } from '../seoul-api.js';
import { dongOf } from '../dong.js';
import { GU } from '../gu.js';

export const name = 'culture-info';
export const label = '한국문화정보원 한눈에보는문화정보(서울)';
export const optional = true;

const BASE = 'https://apis.data.go.kr/B553457/cultureinfo';
const ymd = s => s.replaceAll('-', '');
const iso = s => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
const addDays = (s, n) => { const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const text = v => clean(htmlToText(htmlToText(v ?? ''))); // &amp;lt; 처럼 두 번 감싼 글자가 있어 두 번 푼다
const https = u => (u ?? '').replace(/^http:\/\/(www\.)?culture\.go\.kr/, 'https://www.culture.go.kr');

function itemsOf(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => {
    const o = {};
    for (const f of m[1].matchAll(/<(\w+)>([\s\S]*?)<\/\1>/g)) o[f[1]] = f[2];
    return o;
  });
}

async function call(op, params) {
  const key = process.env.CULTURE_INFO_KEY;
  const qs = new URLSearchParams({ serviceKey: key, ...params });
  const r = await fetch(`${BASE}/${op}?${qs}`, { signal: AbortSignal.timeout(30000) });
  const body = await r.text();
  const code = (body.match(/<resultCode>(\w+)<\/resultCode>/) ?? [])[1];
  if (!r.ok || (code && code !== '00')) throw new Error(`${op} 응답 오류 ${r.status} ${code ?? ''} ${(body.match(/<resultMsg>([^<]*)/) ?? [])[1] ?? body.slice(0, 80)}`);
  return body;
}

const REALM = { '교육/체험': 'edu', '전시': 'exhibit', '행사/축제': 'festival', '아동/가족': 'show' };
const categoryOf = realm => REALM[realm] ?? (/미술|사진/.test(realm) ? 'exhibit' : 'show');

function guOf(x) {
  const sg = clean(x.sigungu);
  if (GU.includes(sg)) return sg;
  const fromAddr = clean(x.placeAddr).split(' ').find(w => GU.includes(w));
  if (fromAddr) return fromAddr;
  const d = dongOf(parseFloat(x.gpsY), parseFloat(x.gpsX));
  return d?.region === '서울' && GU.includes(d.gu) ? d.gu : '';
}

export function normalize(x, d = {}) {
  if (!x.startDate || !x.endDate) return null;
  const v = { ...x, ...d };
  const title = text(v.title), category = categoryOf(clean(v.realmName));
  const fee = text(v.price), program = text(v.contents1);
  const lat = parseFloat(v.gpsY), lng = parseFloat(v.gpsX);
  const start = iso(v.startDate), end = iso(v.endDate);
  return {
    event: {
      id: `cultinfo:${v.seq}`, source: name, title, category, raw_category: clean(v.realmName),
      gu: guOf(v), place: text(v.place) || clean(v.placeAddr),
      start_date: start, end_date: end < start ? start : end, time: '',
      is_free: fee ? (/무료/.test(fee) && !/[1-9][\d,]*\s*원/.test(fee) ? 1 : /[1-9][\d,]*\s*원/.test(fee) ? 0 : null) : null,
      fee: fee.slice(0, 100), target: '', family: kidOf(v) ? 1 : 0,
      link: /^https?:\/\//.test(clean(v.url)) ? clean(v.url) : '', image: https(clean(v.imgUrl || v.thumbnail)),
      lat: Number.isFinite(lat) ? lat : null, lng: Number.isFinite(lng) ? lng : null,
    },
    desc: [program && program.slice(0, 300), text(v.phone) && `문의: ${text(v.phone)}`].filter(Boolean).join('\n').slice(0, 400),
  };
}

// 아이와 갈 만한 것만: 아동/가족 분야, 제목이 뚜렷이 아이·가족 대상인 것, 진짜 축제(세미나·공모·모집·상영회 안내 제외)
// classify.js 의 isFamily 는 '놀이'·'체험' 같은 약한 말도 보지만 이 출처엔 성인 공연·강좌가 많아 강한 말만 쓴다.
const KID = /어린이|유아|가족|아이와|키즈|인형극|그림책|(?<!잔혹)동화/;
const JUNK = /세미나|포럼|공모|모집|컨퍼런스|콘퍼런스|설명회|입주|상영회|할인 안내|행사 안내|지원사업/;
const FEST = /축제|페스타|페스티벌|한마당|빛초롱|청계천의 빛|마켓|장터/;
const KID_PLACE = /어린이|상상나라|키즈/;                                  // 노원어린이극장·서울상상나라 등
const HANDS_ON = /체험|만들기|놀이|탐험|과학교실|실험/;                    // 박물관·과학관·미술관 체험(성인·청소년 대상은 뺀다)
const NOT_KID = /성인|청소년|시니어|어르신|직장인|교사|대학생|중장년|노인/;
const kidOf = x => {
  const t = text(x.title);
  if (x.realmName === '아동/가족' || KID.test(t) || KID_PLACE.test(text(x.place))) return true;
  return ['교육/체험', '전시'].includes(x.realmName) && HANDS_ON.test(t) && !NOT_KID.test(t);
};
const wanted = x => !JUNK.test(text(x.title)) && (kidOf(x) || (x.realmName === '행사/축제' && FEST.test(text(x.title))));

export async function fetchEvents(_seoulKey, today, log) {
  if (!process.env.CULTURE_INFO_KEY) throw new Error('CULTURE_INFO_KEY 가 없어 한눈에보는문화정보는 건너뜀');
  const from = ymd(today), to = ymd(addDays(today, 90));
  const list = [];
  for (let page = 1; page <= 40; page++) {
    const xml = await call('period2', { from, to, PageNo: String(page), numOfrows: '100', sortStdr: '1' });
    const its = itemsOf(xml);
    list.push(...its);
    const total = +((xml.match(/<totalCount>(\d+)/) ?? [])[1] ?? 0);
    if (!its.length || page * 100 >= total) break;
  }
  const seoul = list.filter(x => x.area === '서울' && iso(x.endDate ?? '') >= today);
  const pick = seoul.filter(wanted);
  // 상세(요금·누리집·주소·소개): 고른 것만 부른다. 하나가 실패해도 목록 정보로 진행한다.
  const out = [];
  let detailed = 0;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  for (const x of pick) {
    let d = {};
    for (let t = 0; t < 4; t++) { // 초당 호출 제한(429)이 있어 한 건씩 쉬어 가며 부르고, 걸리면 더 쉬고 다시
      await wait(t ? 1500 * t : 350);
      try { d = itemsOf(await call('detail2', { seq: x.seq }))[0] ?? {}; detailed++; break; } catch { /* 다시 시도, 끝내 실패하면 목록 값만 */ }
    }
    const r = normalize(x, d);
    if (r) out.push(r);
  }
  log(`한눈에보는문화정보: 전국 ${list.length}건 중 서울 ${seoul.length}건, 아이와 갈 만한 것 ${pick.length}건(상세 ${detailed}건)`);
  return out;
}
