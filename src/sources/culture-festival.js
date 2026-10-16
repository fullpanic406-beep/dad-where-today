// 전국문화축제표준데이터(공공데이터포털, 한국관광공사·지자체 등록, tn_pubr_public_cltur_fstvl_api) — 서울
// 구청·주민센터·상인회가 여는 동네 축제(양천가족 거리축제, 용왕산 달빛거리 축제 등)가 이 데이터에 많다.
// 서울시 문화행사 API 에는 일정하게 올라오지 않아서 보완한다. 갱신은 분기·매월 초 병합이라 최신성은 떨어질 수 있다.
// 공공데이터포털 인증키(TourAPI 와 같은 키)가 이 API 의 '활용신청'을 마친 계정이어야 한다.
import { createHash } from 'node:crypto';
import https from 'node:https';
import { clean, htmlToText } from '../seoul-api.js';
import { isFamily } from '../classify.js';

export const name = 'culture-festival';
export const label = '전국문화축제표준데이터(서울)';
export const optional = true;

const BASE = 'https://api.data.go.kr/openapi/tn_pubr_public_cltur_fstvl_api';
// fetch 는 연결 대기가 약 10초로 짧아 해외 서버에서 시간 초과(UND_ERR_CONNECT_TIMEOUT)가 났다 → https 모듈로 40초까지 기다린다
const getText = (url, ms = 40000) => new Promise((resolve, reject) => {
  const req = https.get(url, { timeout: ms }, res => {
    const chunks = [];
    res.on('data', c => chunks.push(c));
    res.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString('utf8') }));
  });
  req.on('timeout', () => req.destroy(Object.assign(new Error('응답 시간 초과'), { code: 'ETIMEDOUT' })));
  req.on('error', reject);
});
const keyOf = () => (process.env.DATA_GO_KR_KEY || process.env.TOURAPI_KEY || '').trim();
const pick = v => clean(htmlToText(v ?? ''));

function categoryOf(title) {
  if (/전시|展|사진전|미술전/.test(title)) return 'exhibit';
  if (/콘서트|음악회|공연|연극|뮤지컬|국악|버스킹/.test(title)) return 'show';
  return 'festival';
}
const urlOf = v => { const t = clean(v ?? ''); return /^https?:\/\//.test(t) ? t : /^www\./.test(t) ? `http://${t}` : ''; };

export function normalize(x) {
  const addr = clean(x.rdnmadr || x.lnmadr);
  const start = (x.fstvlStartDate ?? '').slice(0, 10), end = (x.fstvlEndDate ?? '').slice(0, 10) || start;
  const title = pick(x.fstvlNm);
  if (!addr.startsWith('서울') || !title || !/^\d{4}-\d{2}-\d{2}$/.test(start)) return null;
  const program = pick(x.fstvlCo);
  const lat = parseFloat(x.latitude), lng = parseFloat(x.longitude);
  const category = categoryOf(title);
  const host = [pick(x.mnnstNm), pick(x.auspcInsttNm)].filter((v, i, a) => v && a.indexOf(v) === i).join(' · ');
  const key = createHash('sha1').update(`${title}|${start}|${x.opar}`).digest('hex').slice(0, 14);
  return {
    event: {
      id: `fstvl:${key}`, source: name, title, category, raw_category: '문화축제(표준데이터)',
      gu: addr.split(' ')[1] ?? '', place: pick(x.opar).slice(0, 80), start_date: start, end_date: end < start ? start : end,
      time: '', is_free: null, fee: '', target: '', family: isFamily({ title, target: '', category, program }),
      link: urlOf(x.homepageUrl), image: '',
      lat: Number.isFinite(lat) ? lat : null, lng: Number.isFinite(lng) ? lng : null,
    },
    desc: [host && `주최·주관: ${host.slice(0, 120)}`, program && `프로그램: ${program.slice(0, 220)}`, pick(x.phoneNumber) && `문의: ${pick(x.phoneNumber)}`, pick(x.relateInfo)].filter(Boolean).join('\n').slice(0, 450),
  };
}

export async function fetchEvents(_seoulKey, today, log) {
  const key = keyOf();
  if (!key) throw new Error('공공데이터포털 인증키(TOURAPI_KEY)가 없어 전국문화축제표준데이터는 건너뜀');
  const all = [];
  for (let page = 1; page <= 10; page++) {
    let body;
    for (let i = 1; i <= 4; i++) {
      try {
        const { status, text } = await getText(`${BASE}?serviceKey=${key}&pageNo=${page}&numOfRows=1000&type=json`);
        if (status === 403 || text.includes('SERVICE_KEY_IS_NOT_REGISTERED')) throw new Error('이 API 의 활용신청이 안 된 인증키입니다(등록되지 않은 서비스키)');
        const j = JSON.parse(text);
        if (j.header?.resultCode && j.header.resultCode !== '00') throw new Error(`${j.header.resultCode} ${j.header.resultMsg}`);
        body = j.body; break;
      } catch (e) {
        const why = e.cause?.code ? ` (${e.cause.code})` : '';
        if (i === 4 || /활용신청|인증|LIMIT|한도/.test(e.message)) throw new Error((e.message + why).replaceAll(key, '<KEY>'));
        await new Promise(r => setTimeout(r, 2500 * i));
      }
    }
    const it = body?.items?.item;
    const list = Array.isArray(it) ? it : it ? [it] : [];
    all.push(...list);
    log(`문화축제 ${all.length} / ${body?.totalCount ?? '?'}`);
    if (all.length >= Number(body?.totalCount ?? 0) || !list.length) break;
  }
  const horizon = new Date(`${today}T00:00:00Z`); horizon.setUTCDate(horizon.getUTCDate() + 400);
  const limit = horizon.toISOString().slice(0, 10);
  return all.map(normalize).filter(n => n && n.event.end_date >= today && n.event.start_date <= limit);
}
