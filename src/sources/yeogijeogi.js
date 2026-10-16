// 여기저기 서울형 키즈카페 — 공원·광장에서 시즌(봄·가을) 주말에만 여는 야외 키즈카페
// 출처: 서울시 우리동네 키움포털(umppa.seoul.go.kr/icare). robots.txt 에서 /icare/ 접근이 허용돼 있다.
// 열린데이터 API 가 없어서 목록 페이지를 읽는다(하루 1회, 6쪽). 화면 구조가 바뀌면 파싱이 실패할 수 있어
// optional 소스로 두었다 — 실패해도 다른 행사 수집·배포는 계속되고 경고만 남는다.
import { clean, decode } from '../seoul-api.js';

export const name = 'yeogijeogi';
export const label = '여기저기 서울형 키즈카페(우리동네 키움포털)';
export const optional = true;

const HOST = 'https://umppa.seoul.go.kr';
const LIST = `${HOST}/icare/user/kidsCafe/BD_selectKidsCafeList.do`;
const UA = 'Mozilla/5.0 (compatible; DadWhereToday/1.0; +family-outing-calendar)';
const DAYS = ['일', '월', '화', '수', '목', '금', '토']; // Date.getDay() 순서
const pad = n => String(n).padStart(2, '0');
const text = s => decode(clean((s ?? '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')));

// "26.4.18(토)~6.21(일)/9.19(토)~10.4(일)" → [{start:'2026-04-18', end:'2026-06-21'}, ...]
// 두 번째 시즌부터는 연도가 생략되므로(예: "/9.19(토)~10.4(일)") 앞 구간의 연도를 이어받는다
export function parsePeriods(s, fallbackYear = new Date().getFullYear()) {
  const out = [];
  let year = fallbackYear;
  for (const seg of s.split('/')) {
    const a = seg.match(/^\s*(?:(\d{2})\.)?(\d{1,2})\.(\d{1,2})/);
    let b = seg.match(/~\s*(?:(\d{2})\.)?(\d{1,2})\.(\d{1,2})/);
    if (!b && a) { const d = seg.match(/~\s*(\d{1,2})\s*\(/); if (d) b = [null, null, a[2], d[1]]; } // "5.16(토)~17(일)" → 같은 달
    if (!a || !b) continue;
    if (a[1]) year = 2000 + Number(a[1]);
    const ey = b[1] ? 2000 + Number(b[1]) : year;
    out.push({ start: `${year}-${pad(a[2])}-${pad(a[3])}`, end: `${ey}-${pad(b[2])}-${pad(b[3])}` });
  }
  return out;
}

// "주말(토, 일)" → 요일 비트마스크 (bit n = Date.getDay() 가 n 인 날). 해석 못 하면 null(제한 없음)
export function parseDays(s) {
  let mask = 0;
  const paren = s.match(/\(([^)]*)\)/)?.[1] ?? s;
  for (const ch of paren) { const i = DAYS.indexOf(ch); if (i >= 0) mask |= 1 << i; }
  if (!mask && /주말/.test(s)) mask = (1 << 0) | (1 << 6);
  return mask && mask !== 127 ? mask : null;
}
const dayLabel = mask => (mask === 65 ? '주말' : DAYS.filter((_, i) => mask & (1 << i)).join('·'));

async function getPage(n) {
  const url = `${LIST}?q_fcltyStle=2002&q_hiddenVal=1&q_rowPerPage=5&q_currPage=${n}`;
  for (let i = 1; i <= 3; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return new TextDecoder('utf-8').decode(await res.arrayBuffer());
    } catch (e) {
      if (i === 3) throw new Error(`키움포털 ${n}쪽: ${e.message}`);
      await new Promise(r => setTimeout(r, 1500 * i));
    }
  }
}

export function parseSites(html) {
  const sites = [];
  for (const b of html.split('<div class="kidscafe_wrap">').slice(1)) {
    const full = text((b.match(/<h3>([\s\S]*?)<\/h3>/) || [])[1]);
    const id = (b.match(/q_fcltyId=([A-Za-z0-9]+)/) || [])[1];
    const f = {};
    for (const m of (b.match(/<dl>([\s\S]*?)<\/dl>/) || ['', ''])[1].matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/g)) f[text(m[1]).replace(/\s/g, '')] = text(m[2]);
    const [g, ...rest] = full.split(' ');
    const gu = /구$/.test(g) ? g : `${g}구`; // 일부 시설은 '서대문'처럼 '구'가 빠져 있다
    if (!id || !g || !rest.length) continue;
    sites.push({
      id, gu, site: rest.join(' '), period: f['운영기간'] ?? '', days: f['운영일'] ?? '', capacity: f['이용정원'] ?? '',
      age: f['이용연령'] ?? '', addr: (f['주소'] ?? '').replace(/^서울특별시\s*/, ''), tel: f['전화번호'] ?? '',
      img: (b.match(/<img src="(\/icare\/upload\/[^"]+)"/) || [])[1] ?? '',
    });
  }
  return sites;
}

export async function fetchEvents(key, today, log) {
  const sites = [], seen = new Set();
  for (let n = 1; n <= 10; n++) {
    const found = parseSites(await getPage(n)).filter(s => !seen.has(s.id));
    if (!found.length) break;
    for (const s of found) { seen.add(s.id); sites.push(s); }
    log(`여기저기 키즈카페 ${sites.length}곳`);
    await new Promise(r => setTimeout(r, 400)); // 서버에 부담을 주지 않도록 간격을 둔다
  }
  if (sites.length < 10) throw new Error(`키움포털에서 읽은 시설이 너무 적음(${sites.length}곳) — 화면 구조 변경 의심`);

  const out = [];
  for (const s of sites) {
    const mask = parseDays(s.days);
    for (const p of parsePeriods(s.period)) {
      if (p.end < today) continue; // 끝난 시즌은 제외
      const link = `${HOST}/icare/user/kidsCafeResve/BD_selectKidsCafeResveCal.do?q_fcltyId=${s.id}&q_fcltyStle=2002`;
      out.push({
        event: {
          id: `yeogijeogi:${s.id}:${p.start}`, source: name,
          title: `여기저기 서울형 키즈카페 · ${s.site}`, category: 'kidscafe', raw_category: '여기저기 서울형 키즈카페',
          gu: s.gu, place: s.addr, start_date: p.start, end_date: p.end, time: '',
          is_free: 0, fee: '아동 1인 5,000원 (보호자 무료)', target: s.age.replace(/\s+/g, ' '),
          family: 1, link, image: s.img ? HOST + s.img : '', lat: null, lng: null,
          ...(mask ? { dow: mask, dow_label: dayLabel(mask) } : {}),
        },
        desc: [
          `공원·광장에서 시즌에만 여는 야외 키즈카페예요. ${s.days ? `운영일: ${s.days}.` : ''}`,
          s.period ? `운영 기간: ${s.period.split('/').join(' / ')}` : '',
          s.capacity ? `이용 정원: ${s.capacity}` : '',
          '예약은 우리동네 키움포털에서 해요. 정원의 일부는 현장 접수로 운영돼요.',
          '날씨·미세먼지에 따라 운영이 달라질 수 있으니 방문 전에 예약 페이지에서 확인해 주세요.',
          s.tel ? `문의: ${s.tel}` : '',
        ].filter(Boolean).join('\n'),
      });
    }
  }
  return out;
}
