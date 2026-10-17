// 서울 소아청소년과 병·의원(국립중앙의료원 전국 병·의원 찾기 서비스) → public/data/hospitals/<구>.json
// 진료 시간(월~일·공휴일), 전화, 좌표, 응급의료기관 등급. 키(HOSP_API_KEY)가 없거나 호출이 실패하면 이전 파일을 그대로 둔다.
// 사용: node src/hospitals.js
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT, loadEnv } from './env.js';

loadEnv();

const URL_BASE = 'http://apis.data.go.kr/B552657/HsptlAsembySearchService/getHsptlMdcncListInfoInqire';
const OUT = path.join(ROOT, 'public', 'data', 'hospitals');
const KEY = (process.env.HOSP_API_KEY || '').trim();
const PAGE = 1000;

const tag = (s, t) => { const m = s.match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`)); return m ? m[1].trim().replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'") : ''; };

async function page(n) {
  const q = new URLSearchParams({ Q0: '서울특별시', QD: 'D002', numOfRows: String(PAGE), pageNo: String(n) });
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(`${URL_BASE}?${q}&serviceKey=${encodeURIComponent(KEY)}`, { signal: AbortSignal.timeout(40000) });
      const t = await r.text();
      if (!t.includes('<resultCode>00</resultCode>')) throw new Error(tag(t, 'resultMsg') || `HTTP ${r.status}`);
      return { total: Number(tag(t, 'totalCount')), items: [...t.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => m[1]) };
    } catch (e) { if (i === 2) throw e; await new Promise(r => setTimeout(r, 1500 * (i + 1))); }
  }
}

if (!KEY) { console.log('[hospitals] HOSP_API_KEY 가 없어 건너뜁니다(이전 데이터 유지)'); process.exit(0); }
try {
  const first = await page(1);
  const rows = [...first.items];
  for (let n = 2; n <= Math.ceil(first.total / PAGE); n++) rows.push(...(await page(n)).items);

  const byGu = {}, seen = new Set();
  for (const it of rows) {
    const id = tag(it, 'hpid');
    const kind = tag(it, 'dutyDivNam');
    if (!id || seen.has(id) || /한방|치과/.test(kind)) continue;
    seen.add(id);
    const addr = tag(it, 'dutyAddr'), gu = addr.match(/서울특별시\s+(\S+구)/)?.[1];
    if (!gu) continue;
    const h = [1, 2, 3, 4, 5, 6, 7, 8].map(d => { const s = tag(it, `dutyTime${d}s`), c = tag(it, `dutyTime${d}c`); return s && c ? [s, c] : null; });
    const er = tag(it, 'dutyEmclsName');
    // 진료과목을 여러 개 등록한 의원이 섞여 있어, 소아과 간판(이름·안내문에 소아/어린이/아동)이거나 종합병원·응급의료기관인 곳만 남긴다
    const ped = /소아|어린이|아동/.test(tag(it, 'dutyName') + tag(it, 'dutyInf') + tag(it, 'dutyEtc')) || kind === '종합병원' || (er && er !== '응급의료기관 이외');
    if (!ped) continue;
    (byGu[gu] ??= []).push({
      id, n: tag(it, 'dutyName'), a: addr.replace(/^서울특별시\s+/, ''), t: tag(it, 'dutyTel1'),
      lat: Number(tag(it, 'wgs84Lat')) || null, lng: Number(tag(it, 'wgs84Lon')) || null,
      h, k: kind, ...(er && er !== '응급의료기관 이외' ? { er } : {}), e: tag(it, 'dutyEtc').replace(/\s+/g, ' ').slice(0, 90),
    });
  }
  const total = Object.values(byGu).reduce((a, v) => a + v.length, 0);
  if (total < 300) throw new Error(`병원 수가 너무 적습니다(${total}곳) — 이전 데이터를 유지합니다`);
  mkdirSync(OUT, { recursive: true });
  const updated = new Date().toISOString();
  for (const [gu, items] of Object.entries(byGu)) writeFileSync(path.join(OUT, `${gu}.json`), JSON.stringify({ updated, items }));
  console.log(`[hospitals] 서울 소아과 진료 병·의원 ${total}곳 · ${Object.keys(byGu).length}개 구`);
} catch (e) {
  console.warn('[hospitals] 실패 — 이전 데이터를 유지합니다:', e.message);
}
