// 서울시 문화공간 정보(culturalSpaceInfo) 중 아이와 가기 좋은 곳(어린이박물관·과학관·체험관·자연사박물관 등)
// 박물관·미술관·문화원 등 1,096곳 중 이름·설명 문구로 어린이·가족 대상 시설만 고른다(휴리스틱).
import { createHash } from 'node:crypto';
import { fetchAll, clean, htmlToText } from '../seoul-api.js';

export const name = 'seoul-space';
export const label = '서울시 문화공간(어린이·체험 시설)';
export const optional = true;

const SKIP_TYPE = /도서관|공연장|문화예술회관|문화원/; // 장소 목록이 흐려지지 않도록 제외
// 이름에 들어 있는 말로 종류를 정한다(앞에서부터 먼저 맞는 것)
const KIND = [
  ['safety', /안전체험|소방|119|재난|교통안전/],
  ['kidsmuseum', /어린이박물관|어린이미술관|상상나라|어린이회관/],
  ['science', /과학관|과학박물관|과학전시|로봇|퓨처랩|생명과학/],
  ['nature', /자연사|곤충|동물|생태|공룡|식물/],
  ['experience', /체험관|체험장|체험전시|체험박물관|체험센터|놀이/],
];

export function classify(r) {
  const nm = r.FAC_NAME ?? '', desc = htmlToText(r.FAC_DESC);
  let kind = KIND.find(([, re]) => re.test(nm))?.[0];
  const kidWords = (desc.match(/어린이|아이들|유아|가족|청소년/g) || []).length;
  const score = (kind ? 3 : 0) + Math.min(kidWords, 4) + (/어린이|키즈|아이/.test(nm) ? 2 : 0);
  if (!kind && kidWords >= 2 && /박물관|전시관|체험/.test(nm + r.SUBJCODE)) kind = 'museum';
  return kind && score >= 3 ? kind : null;
}

const fix = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
const url = u => { const t = clean(u); return !t ? '' : /^https?:\/\//.test(t) ? t : `http://${t}`; };

export async function fetchPlaces(key, log) {
  const { rows } = await fetchAll(key, 'culturalSpaceInfo', log);
  const out = [];
  for (const r of rows) {
    if (SKIP_TYPE.test(r.SUBJCODE)) continue;
    const kind = classify(r);
    if (!kind) continue;
    let lat = fix(r.X_COORD), lng = fix(r.Y_COORD); // 이 API 는 X_COORD 가 위도, Y_COORD 가 경도
    if (lat && lng && lat > 100 && lng < 100) [lat, lng] = [lng, lat];
    if (!(lat > 33 && lat < 39 && lng > 124 && lng < 132)) lat = lng = null;
    const fee = clean(r.ENTR_FEE) === '0' ? '무료' : clean(r.ENTR_FEE);
    out.push({
      id: 'place:sp:' + createHash('sha1').update(`${r.FAC_NAME}|${r.ADDR}`).digest('hex').slice(0, 10),
      source: name, name: clean(r.FAC_NAME), kind, region: '서울', gu: clean(r.GNGU),
      addr: clean(r.ADDR), lat, lng, tel: clean(r.PHNE), url: url(r.HOMEPAGE),
      hours: clean(r.OPENHOUR), closed: clean(r.CLOSEDAY), fee,
      free: r.ENTRFREE === '무료' || fee === '무료' ? 1 : r.ENTRFREE === '유료' ? 0 : null,
      image: clean(r.MAIN_IMG), desc: htmlToText(r.FAC_DESC).slice(0, 400),
    });
  }
  return out;
}
