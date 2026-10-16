// 서울 열린데이터광장 OpenAPI 공통 호출 (페이지 순회 + 재시도). 이 API는 http(8088)만 지원한다.
const BASE = 'http://openapi.seoul.go.kr:8088';

async function getPage(key, service, start, end, tries = 3) {
  const url = `${BASE}/${key}/json/${service}/${start}/${end}/`;
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      const text = await res.text();
      if (text.startsWith('<')) throw new Error(text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
      const json = JSON.parse(text);
      const info = json[service];
      if (!info) throw new Error(JSON.stringify(json).slice(0, 200));
      const code = info.RESULT?.CODE;
      if (code === 'INFO-200') return { total: 0, rows: [] }; // 해당 범위에 데이터 없음
      if (code && code !== 'INFO-000') throw new Error(`${code} ${info.RESULT.MESSAGE}`);
      return { total: info.list_total_count, rows: info.row ?? [] };
    } catch (e) {
      if (i === tries) throw new Error(`${service} ${start}-${end}: ${e.message}`);
      await new Promise(r => setTimeout(r, 1500 * i));
    }
  }
}

export async function fetchAll(key, service, log = () => {}) {
  const page = key === 'sample' ? 5 : 1000; // 인증키는 1회 최대 1000건, sample 은 5건
  const first = await getPage(key, service, 1, page);
  const rows = [...first.rows];
  if (key !== 'sample') {
    for (let s = page + 1; s <= first.total; s += page) {
      rows.push(...(await getPage(key, service, s, Math.min(s + page - 1, first.total))).rows);
      log(`${service} ${Math.min(s + page - 1, first.total)} / ${first.total}`);
    }
  }
  return { total: first.total, rows };
}

export const clean = s => (s ?? '').toString().replace(/\s+/g, ' ').trim();
export const day = s => (s ?? '').toString().slice(0, 10);

const ENT = { nbsp: ' ', quot: '"', amp: '&', lt: '<', gt: '>', apos: "'", ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’',
  hellip: '…', middot: '·', ndash: '–', mdash: '—', bull: '•', times: '×', rarr: '→', larr: '←' };
export const decode = s => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, g) => {
  if (g[0] === '#') { const n = g[1].toLowerCase() === 'x' ? parseInt(g.slice(2), 16) : parseInt(g.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
  return ENT[g.toLowerCase()] ?? m;
});
// HTML → 줄바꿈이 살아 있는 일반 텍스트
export const htmlToText = h => decode((h ?? '')
  .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h\d)>/gi, '\n').replace(/<[^>]+>/g, ''))
  .replace(/[ \t ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{2,}/g, '\n').trim();
