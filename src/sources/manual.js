// 직접 등록한 행사 (data/manual-events.json)
// 공공 데이터 어디에도 올라오지 않았지만 공식 공지·보도로 확인한 행사를 사람이 적어 넣는 곳이다.
// 다른 소스와 겹치면(같은 구·겹치는 기간·비슷한 제목) 이쪽 값을 우선하고 빈 항목만 다른 소스가 채운다.
//
// 항목: title(필수), gu(필수, 25개 구 중 하나), start_date(필수, YYYY-MM-DD), end_date, category(festival|show|exhibit|edu|etc),
//       place, time, free(true/false), fee, target, family(true/false), link, image, desc, source_note(출처·확인 사항)
// 끝난 행사는 자동으로 빠진다. 값을 추측해서 넣지 말고, 확인한 내용만 적는다(모르는 항목은 비워 둔다).
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from '../env.js';
import { GU } from '../gu.js';

export const name = 'manual';
export const label = '직접 등록한 행사';
export const optional = true;

const FILE = path.join(ROOT, 'data', 'manual-events.json');
const CATS = new Set(['festival', 'show', 'exhibit', 'edu', 'etc']);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function fetchEvents(_key, today) {
  if (!existsSync(FILE)) return [];
  const list = JSON.parse(readFileSync(FILE, 'utf8'));
  if (!Array.isArray(list)) throw new Error('manual-events.json 은 배열이어야 합니다');
  const out = [];
  list.forEach((x, i) => {
    const where = `manual-events.json ${i + 1}번째(${x?.title ?? '제목 없음'})`;
    if (!x.title || !GU.includes(x.gu) || !DATE.test(x.start_date ?? '')) throw new Error(`${where}: title·gu(25개 구)·start_date(YYYY-MM-DD)가 필요합니다`);
    const end = DATE.test(x.end_date ?? '') ? x.end_date : x.start_date;
    if (end < today) return; // 끝난 행사는 제외
    const category = CATS.has(x.category) ? x.category : 'etc';
    out.push({
      event: {
        id: 'manual:' + createHash('sha1').update(`${x.title}|${x.start_date}`).digest('hex').slice(0, 12),
        source: name, title: x.title.trim(), category, raw_category: '직접 등록',
        gu: x.gu, place: (x.place ?? '').trim(), start_date: x.start_date, end_date: end < x.start_date ? x.start_date : end,
        time: (x.time ?? '').trim(), is_free: x.free === true ? 1 : x.free === false ? 0 : null, fee: (x.fee ?? '').trim(),
        target: (x.target ?? '').trim(), family: x.family ? 1 : 0, link: (x.link ?? '').trim(), image: (x.image ?? '').trim(),
        source_note: (x.source_note ?? '').trim(), lat: null, lng: null,
      },
      desc: (x.desc ?? '').trim().slice(0, 600),
    });
  });
  return out;
}
