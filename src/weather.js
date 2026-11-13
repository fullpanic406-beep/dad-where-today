// 서울 날씨(기상청 단기예보 + 중기예보) → public/data/weather.json
// 앱은 이 파일 하나만 읽는다(외부 날씨 서버를 직접 부르지 않아 첫 화면이 날씨 때문에 멈추지 않는다).
// 키: 공공데이터포털 일반 인증키(KMA_API_KEY, 없으면 HOSP_API_KEY·TOURAPI_KEY 순으로 같은 계정 키를 쓴다).
//     포털에서 '기상청_단기예보 조회서비스'(15084084)와 '기상청_중기예보 조회서비스'(15059468) 활용신청이 되어 있어야 한다.
// 실패하면 이전 파일을 그대로 둔다(종료 코드 0).
// 사용: node src/weather.js
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT, loadEnv } from './env.js';

loadEnv();
const KEY = (process.env.KMA_API_KEY || process.env.HOSP_API_KEY || process.env.TOURAPI_KEY || '').trim();
const OUT = path.join(ROOT, 'public', 'data', 'weather.json');
const NX = 60, NY = 127;                       // 서울(중구) 격자
const MID_LAND = '11B00000', MID_TA = '11B10101'; // 중기 육상: 서울·인천·경기 / 중기 기온: 서울
const PLAY_FROM = 10, PLAY_TO = 18;            // 아이와 나가 노는 시간(앱과 같은 기준)

const pad = n => String(n).padStart(2, '0');
const kst = (d = new Date()) => new Date(d.getTime() + 9 * 3600e3);   // getUTC* 로 한국 시각을 읽는다
const ymd = d => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
const iso = s => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
const addDays = (s, n) => { const d = new Date(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8) + n)); return ymd(d); };

async function call(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(`${url}&dataType=JSON&serviceKey=${encodeURIComponent(KEY)}`, { signal: AbortSignal.timeout(20000) });
      const t = await r.text();
      let j; try { j = JSON.parse(t); } catch { throw new Error(t.slice(0, 120).replace(/\s+/g, ' ')); }
      const h = j.response?.header;
      if (h?.resultCode !== '00') throw new Error(h?.resultMsg || j.OpenAPI_ServiceResponse?.cmmMsgHeader?.errMsg || `HTTP ${r.status}`);
      const it = j.response.body.items?.item;
      return Array.isArray(it) ? it : it ? [it] : [];
    } catch (e) { if (i === 2 || /SERVICE_KEY|등록되지/.test(e.message)) throw e; await new Promise(r => setTimeout(r, 1500 * (i + 1))); }
  }
}

// 단기예보: 하루 8번(02·05·08·11·14·17·20·23시, 약 10분 뒤 공개)
function vilageBase(now = kst()) {
  const t = new Date(now.getTime() - 15 * 60e3);   // 공개 지연 여유
  const h = t.getUTCHours();
  const b = [23, 20, 17, 14, 11, 8, 5, 2].find(x => x <= h);
  if (b == null) return { date: ymd(new Date(t.getTime() - 864e5)), time: '2300' };
  return { date: ymd(t), time: `${pad(b)}00` };
}
const vilage = ({ date, time }) => call(`https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst?pageNo=1&numOfRows=3000&base_date=${date}&base_time=${time}&nx=${NX}&ny=${NY}`);

// 강수량 글자 → mm ("강수없음", "1mm 미만", "1.0mm", "30.0~50.0mm", "50.0mm 이상")
const mmOf = v => { if (!v || /없음/.test(v)) return 0; if (/미만/.test(v)) return 0.5; const n = parseFloat(String(v).replace(/[^\d.~]/g, '').split('~')[0]); return Number.isFinite(n) ? n : 0; };
// 앱의 날씨 아이콘 코드(WMO 방식)로: 0 맑음, 2 구름많음, 3 흐림, 61 비, 71 눈
const codeOf = (pty, sky) => (pty === 3 ? 71 : pty === 1 || pty === 2 || pty === 4 ? 61 : sky === 1 ? 0 : sky === 3 ? 2 : 3);
const codeOfText = wf => (/눈/.test(wf) ? 71 : /비|소나기/.test(wf) ? 61 : /맑/.test(wf) ? 0 : /구름많/.test(wf) ? 2 : 3);
const statusOf = (start, sumMm, maxP) => (start != null || sumMm >= 1 ? 'rain' : maxP >= 60 || sumMm >= 0.1 ? 'chance' : maxP >= 40 ? 'low' : 'dry');

async function shortTerm() {
  const latest = vilageBase();
  const today = ymd(kst());
  // 오늘 최저·최고(TMN 06시·TMX 15시)는 새벽 2시 발표에만 확실히 들어 있어 같이 받아 겹친다(최신 발표가 우선)
  const early = { date: today, time: '0200' };
  const runs = latest.date === today && latest.time !== '0200' ? [early, latest] : [latest];
  const cell = new Map();   // "날짜|시각|항목" → 값
  for (const b of runs) {
    try { for (const x of await vilage(b)) cell.set(`${x.fcstDate}|${x.fcstTime}|${x.category}`, x.fcstValue); }
    catch (e) { if (b === latest) throw e; }   // 새벽 발표를 못 받아도 최신 발표로 진행
  }
  const days = {};
  const dates = [...new Set([...cell.keys()].map(k => k.split('|')[0]))].sort();
  for (const d of dates) {
    const hrs = [], temps = [];
    for (let h = 0; h < 24; h++) {
      const g = c => cell.get(`${d}|${pad(h)}00|${c}`);
      if (g('TMP') != null) temps.push(Number(g('TMP')));
      if (h < PLAY_FROM || h >= PLAY_TO || g('POP') == null) continue;
      hrs.push({ hr: h, p: Number(g('POP')), mm: mmOf(g('PCP')), code: codeOf(Number(g('PTY') ?? 0), Number(g('SKY') ?? 1)) });
    }
    if (!hrs.length && !temps.length) continue;
    const tmn = cell.get(`${d}|0600|TMN`), tmx = cell.get(`${d}|1500|TMX`);
    const maxP = Math.max(0, ...hrs.map(h => h.p)), sumMm = hrs.reduce((a, h) => a + h.mm, 0);
    const start = hrs.find(h => h.mm >= 0.5)?.hr;
    days[iso(d)] = {
      code: (hrs.find(h => h.hr === 13) ?? hrs[0])?.code ?? 0,
      max: Math.round(tmx != null ? Number(tmx) : Math.max(...temps)), min: Math.round(tmn != null ? Number(tmn) : Math.min(...temps)),
      status: statusOf(start, sumMm, maxP), start: start ?? hrs.find(h => h.mm >= 0.1)?.hr, maxP, sumMm: Math.round(sumMm * 10) / 10, src: 'short',
    };
  }
  return days;
}

// 중기예보: 하루 2번(06·18시). 발표일 기준 n일 뒤 값(rnSt{n}Am/Pm, wf{n}Am/Pm, taMin{n}/taMax{n})
async function midTerm() {
  const t = new Date(kst().getTime() - 30 * 60e3), h = t.getUTCHours();
  const tmFc = h >= 18 ? `${ymd(t)}1800` : h >= 6 ? `${ymd(t)}0600` : `${ymd(new Date(t.getTime() - 864e5))}1800`;
  const [land] = await call(`https://apis.data.go.kr/1360000/MidFcstInfoService/getMidLandFcst?pageNo=1&numOfRows=10&regId=${MID_LAND}&tmFc=${tmFc}`);
  const [ta] = await call(`https://apis.data.go.kr/1360000/MidFcstInfoService/getMidTa?pageNo=1&numOfRows=10&regId=${MID_TA}&tmFc=${tmFc}`).catch(() => [null]);
  const days = {};
  for (let n = 1; n <= 10; n++) {
    const am = land?.[`rnSt${n}Am`] ?? land?.[`rnSt${n}`], pm = land?.[`rnSt${n}Pm`] ?? land?.[`rnSt${n}`];
    if (am == null && pm == null) continue;
    const wf = `${land[`wf${n}Am`] ?? ''} ${land[`wf${n}Pm`] ?? land[`wf${n}`] ?? ''}`;
    const maxP = Math.max(Number(am ?? 0), Number(pm ?? 0));
    const wet = /비|눈|소나기/.test(wf);
    days[iso(addDays(tmFc.slice(0, 8), n))] = {
      code: codeOfText(land[`wf${n}Pm`] ?? land[`wf${n}`] ?? wf),
      max: ta?.[`taMax${n}`] != null ? Math.round(Number(ta[`taMax${n}`])) : null, min: ta?.[`taMin${n}`] != null ? Math.round(Number(ta[`taMin${n}`])) : null,
      status: wet && maxP >= 60 ? 'rain' : wet || maxP >= 60 ? 'chance' : maxP >= 40 ? 'low' : 'dry', start: undefined, maxP, sumMm: 0, src: 'mid',
    };
  }
  return days;
}

if (!KEY) { console.log('[weather] 공공데이터포털 키가 없어 건너뜁니다(이전 파일 유지)'); process.exit(0); }
try {
  const short = await shortTerm();
  const mid = await midTerm().catch(e => { console.log(`[weather] 중기예보 실패(단기예보만 씀): ${e.message}`); return {}; });
  const days = { ...mid, ...short };   // 겹치는 날은 단기예보가 더 정확
  for (const [d, w] of Object.entries(days)) if (w.max == null || w.min == null) delete days[d];   // 기온 없는 날은 표시하지 않는다
  if (!Object.keys(short).length) throw new Error('단기예보 자료가 비어 있음');
  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), source: '기상청', days }));
  console.log(`[weather] ${Object.keys(days).length}일치 저장(단기 ${Object.keys(short).length} · 중기 ${Object.keys(mid).length})`);
} catch (e) {
  console.log(`[weather] 실패, 이전 파일 유지: ${e.message}`);
}
