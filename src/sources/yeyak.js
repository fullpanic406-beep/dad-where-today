// 서울시 공공서비스예약 — 문화체험(ListPublicReservationCulture) + 교육(ListPublicReservationEducation)
// 공공누리 1유형(출처 표시 시 상업적 이용·변경 가능). 예약 페이지 링크(SVCURL)로 바로 연결된다.
import { fetchAll, clean, day, decode, htmlToText } from '../seoul-api.js';
import { isFamily } from '../classify.js';

export const name = 'yeyak';
export const label = '서울시 공공서비스예약';

// MINCLASSNM → 앱 카테고리
function categoryOf(min, title) {
  if (min === '서울형키즈카페') return 'kidscafe'; // 행사가 아니라 상시 운영 장소라 따로 노출
  if (/전시/.test(min)) return 'exhibit';
  if (min === '문화행사') return /축제/.test(title) ? 'festival' : 'show';
  return 'edu'; // 교육체험·산림여가·공원탐방·농장체험·교육강좌
}

// DTLCONT 는 앞부분이 공통 이용 안내문이라 "3. 상세내용" 뒤부터만 쓴다
function descOf(html) {
  const t = htmlToText(html);
  const i = t.indexOf('3. 상세내용');
  const body = (i >= 0 ? t.slice(i + '3. 상세내용'.length) : t).replace(/^[\s:]+/, '');
  return body.replace(/○\s*/g, '· ').slice(0, 700).trim();
}

export function normalize(r, service) {
  const title = decode(clean(r.SVCNM));
  const start = day(r.SVCOPNBGNDT), end = day(r.SVCOPNENDDT) || start;
  if (!start || !r.AREANM || !title) return null;
  const category = service === 'education' ? 'edu' : categoryOf(r.MINCLASSNM, title);
  const target = clean(r.USETGTINFO);
  const pay = clean(r.PAYATNM);
  const lat = parseFloat(r.Y), lng = parseFloat(r.X);
  return {
    event: {
      id: `yeyak:${r.SVCID}`, source: name, title, category, raw_category: clean(r.MINCLASSNM),
      gu: clean(r.AREANM), place: clean(r.PLACENM),
      start_date: start, end_date: end < start ? start : end, time: '',
      is_free: pay.startsWith('무료') ? 1 : pay.startsWith('유료') ? 0 : null, fee: pay, target,
      family: isFamily({ title, target, category, program: '' }),
      link: clean(r.SVCURL), image: clean(r.IMGURL),
      lat: Number.isFinite(lat) ? lat : null, lng: Number.isFinite(lng) ? lng : null,
      status: clean(r.SVCSTATNM), rcpt_start: day(r.RCPTBGNDT), rcpt_end: day(r.RCPTENDDT),
    },
    desc: descOf(r.DTLCONT),
  };
}

export async function fetchEvents(key, today, log) {
  const out = [];
  for (const [service, api] of [['culture', 'ListPublicReservationCulture'], ['education', 'ListPublicReservationEducation']]) {
    const { rows } = await fetchAll(key, api, log);
    for (const r of rows) {
      const n = normalize(r, service);
      if (!n || n.event.end_date < today) continue;
      // 교육강좌는 성인 대상 강좌가 대부분이라 아이·가족 대상만 싣는다
      if (service === 'education' && !n.event.family) continue;
      out.push(n);
    }
  }
  return out;
}
