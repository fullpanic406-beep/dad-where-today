// 한국관광공사 TourAPI 행사·축제(searchFestival2) — 서울
// 서울시 문화행사 API 에는 구청·상인회가 여는 동네 축제가 일정하게 올라오지 않아서(예: 목동로데오 축제는 2022·2023년만 등록)
// 다른 공공 출처로 보완한다. 서울시 API 와 같은 행사는 ingest 가 하나로 합친다.
// 사진은 공공누리 1·3유형(상업적 이용 가능)만 쓴다.
import { readFileSync } from 'node:fs';
import { clean, htmlToText } from '../seoul-api.js';
import { isFamily } from '../classify.js';
import { hasKey, callsUsed, itemsOf, getCache, saveCache, tourCall, cachedSearch } from '../tourapi-client.js';

export const name = 'tourapi-festival';
export const label = '한국관광공사 TourAPI 행사·축제(서울)';
export const optional = true;

const ymd = s => s.replaceAll('-', '');
const iso = s => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
const addDays = (s, n) => { const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const pick = v => clean(htmlToText(v ?? ''));

function categoryOf(title) {
  if (/전시|展|사진전|미술전|갤러리/.test(title)) return 'exhibit';
  if (/콘서트|공연|연극|뮤지컬|음악회|오페라|국악|무용|리사이틀|연주/.test(title)) return 'show';
  if (/체험|교육|워크숍|클래스|캠프|강좌/.test(title)) return 'edu';
  return 'festival';
}

const urlOf = v => {
  const html = clean(v ?? '');
  const href = (html.match(/href=["']([^"']+)["']/) ?? [])[1] ?? htmlToText(html).split(/\s/)[0] ?? '';
  return /^https?:\/\//.test(href) ? href : /^www\./.test(href) ? `http://${href}` : '';
};

export function normalize(x, intro = {}) {
  if (!x.eventstartdate || !x.eventenddate) return null;
  const addr = clean(`${x.addr1} ${x.addr2 ?? ''}`);
  const start = iso(x.eventstartdate), end = iso(x.eventenddate);
  const title = clean(x.title);
  const category = categoryOf(title);
  const fee = pick(intro.usetimefestival), target = pick(intro.agelimit), program = pick(intro.program);
  const lat = parseFloat(x.mapy), lng = parseFloat(x.mapx);
  const licenseOk = ['Type1', 'Type3'].includes(x.cpyrhtDivCd); // 상업적 이용 가능한 사진만
  const host = [pick(intro.sponsor1), pick(intro.sponsor2)].filter(Boolean).join(' · ');
  return {
    event: {
      id: `tourfest:${x.contentid}`, source: name, title, category, raw_category: '행사·축제(TourAPI)',
      gu: addr.split(' ')[1] ?? '', place: pick(intro.eventplace) || clean(x.addr2) || addr,
      start_date: start, end_date: end < start ? start : end, time: pick(intro.playtime).slice(0, 60),
      is_free: fee ? (/무료/.test(fee) && !/\d\s*원/.test(fee) ? 1 : /\d\s*원/.test(fee) ? 0 : null) : null,
      fee: fee.slice(0, 100), target: target.slice(0, 40), family: isFamily({ title, target, category, program }),
      link: urlOf(intro.eventhomepage), image: licenseOk ? clean(x.firstimage) : '', image_license: licenseOk ? x.cpyrhtDivCd : '',
      lat: Number.isFinite(lat) ? lat : null, lng: Number.isFinite(lng) ? lng : null,
    },
    desc: [host && `주최·주관: ${host}`, program && `프로그램: ${program.slice(0, 200)}`, pick(x.tel) && `문의: ${pick(x.tel)}`].filter(Boolean).join('\n').slice(0, 400),
  };
}

export async function fetchEvents(_seoulKey, today, log) {
  let items;
  const fixture = process.env.TOURAPI_FESTIVAL_FIXTURE; // 테스트용: 저장해 둔 목록을 읽는다(호출 없음)
  if (fixture) {
    items = JSON.parse(readFileSync(fixture, 'utf8'));
  } else {
    if (!hasKey()) throw new Error('TOURAPI_KEY 가 없어 TourAPI 행사·축제는 건너뜀');
    items = [];
    const from = ymd(addDays(today, -7)); // 이미 시작했지만 아직 진행 중인 행사도 포함
    for (let page = 1; page <= 5; page++) {
      const b = await cachedSearch(`f|11|${from}|${page}`, 'searchFestival2', { eventStartDate: from, lDongRegnCd: '11', numOfRows: '100', pageNo: String(page) });
      const its = itemsOf(b);
      items.push(...its);
      if (page * 100 >= (b.totalCount ?? 0) || !its.length) break;
    }
  }
  const cur = items.filter(x => x.eventenddate && iso(x.eventenddate) >= today && (x.addr1 ?? '').startsWith('서울'));

  // 상세(요금·공연 시간·주최·누리집): 수정 시각이 같으면 캐시를 쓴다. 한도에 닿으면 상세 없이 기본 정보로 진행한다.
  const details = getCache().details;
  let fresh = 0;
  if (!fixture) {
    try {
      for (const x of cur) {
        const key = `f:${x.contentid}`;
        if (details[key]?.m === x.modifiedtime) continue;
        try {
          details[key] = { m: x.modifiedtime, intro: itemsOf(await tourCall('detailIntro2', { contentId: x.contentid, contentTypeId: '15' }))[0] ?? {} };
          fresh++;
        } catch (e) {
          if (/상한|LIMIT|한도/i.test(e.message)) break;
          throw e;
        }
      }
    } finally {
      saveCache();
    }
  }
  log(`TourAPI 행사 완료: 서울 ${items.length}건 중 진행·예정 ${cur.length}건, 새 상세 ${fresh}건, 호출 누적 ${callsUsed()}회`);
  return cur.map(x => normalize(x, details[`f:${x.contentid}`]?.intro)).filter(Boolean);
}
