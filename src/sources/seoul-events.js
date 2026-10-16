// 서울시 문화행사 정보 (culturalEventInfo)
import { createHash } from 'node:crypto';
import { fetchAll, clean, day } from '../seoul-api.js';
import { categoryOf, isFamily } from '../classify.js';

export const name = 'seoul';
export const label = '서울시 문화행사 정보';

export function normalize(r) {
  const start = day(r.STRTDATE) || day((r.DATE || '').split('~')[0]);
  const end = day(r.END_DATE) || day((r.DATE || '').split('~')[1]) || start;
  if (!start || !r.GUNAME || !r.TITLE) return null;

  const cult = (r.HMPG_ADDR || '').match(/cultcode=(\d+)/)?.[1];
  const id = 'seoul:' + (cult ?? createHash('sha1').update(`${r.TITLE}|${start}|${r.PLACE}`).digest('hex').slice(0, 16));
  const category = categoryOf(r.CODENAME);
  const target = clean(r.USE_TRGT);
  const lat = parseFloat(r.LAT), lng = parseFloat(r.LOT);
  return {
    event: {
      id, source: name, title: clean(r.TITLE), category, raw_category: clean(r.CODENAME),
      gu: clean(r.GUNAME), place: clean(r.PLACE),
      start_date: start, end_date: end < start ? start : end, time: clean(r.PRO_TIME),
      is_free: r.IS_FREE === '무료' ? 1 : r.IS_FREE === '유료' ? 0 : null, fee: clean(r.USE_FEE), target,
      family: isFamily({ title: r.TITLE, target, category, program: r.PROGRAM }),
      link: clean(r.HMPG_ADDR || r.ORG_LINK), image: clean(r.MAIN_IMG),
      lat: Number.isFinite(lat) ? lat : null, lng: Number.isFinite(lng) ? lng : null,
    },
    desc: clean(r.PROGRAM || r.ETC_DESC).slice(0, 600),
  };
}

export async function fetchEvents(key, today, log) {
  const { rows } = await fetchAll(key, 'culturalEventInfo', log);
  const out = [];
  for (const r of rows) {
    const n = normalize(r);
    if (!n || n.event.end_date < today) continue; // 종료된 행사는 제외
    if (n.event.end_date > '2099-12-31') n.event.end_date = '2099-12-31'; // 입력 오류(예: 2626년) 보정
    out.push(n);
  }
  return out;
}
