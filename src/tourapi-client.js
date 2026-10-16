// 한국관광공사 TourAPI 공통 호출 — 키·재시도·하루 호출 상한·캐시를 한곳에서 관리한다.
// 개발 계정은 하루 1,000건 안팎이라 ① 검색 목록은 필요한 필드만 18시간 저장하고 ② 상세는 수정 시각이 같으면 재사용한다.
// 장소·행사 수집기가 같은 호출 횟수(상한)와 캐시 파일(.cache/tourapi.json)을 함께 쓴다.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from './env.js';

const BASE = 'https://apis.data.go.kr/B551011/KorService2';
const CACHE_FILE = process.env.TOURAPI_CACHE || path.join(ROOT, '.cache', 'tourapi.json');
const MAX_CALLS = Number(process.env.TOURAPI_MAX_CALLS) || 800; // 하루 한도(약 1,000건)를 넘지 않도록 상한
const SEARCH_TTL = 18 * 3600 * 1000;
let calls = 0, cache = null;

const sleep = ms => new Promise(r => setTimeout(r, ms));
export const hasKey = () => !!(process.env.TOURAPI_KEY || '').trim();
export const callsUsed = () => calls;
export const itemsOf = b => { const it = b?.items?.item; return Array.isArray(it) ? it : it ? [it] : []; };

export function getCache() {
  if (cache) return cache;
  let raw = {};
  try { if (existsSync(CACHE_FILE)) raw = JSON.parse(readFileSync(CACHE_FILE, 'utf8')); } catch { raw = {}; }
  if (!raw.details && !raw.search) raw = { details: raw, search: {} }; // 예전 형식({contentid: …})이면 상세 캐시로 옮긴다
  cache = { details: raw.details ?? {}, search: raw.search ?? {} };
  return cache;
}
export function saveCache() {
  mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
  writeFileSync(CACHE_FILE, JSON.stringify(getCache()));
}

export async function tourCall(op, params) {
  const key = (process.env.TOURAPI_KEY || '').trim();
  if (!key) throw new Error('TOURAPI_KEY 가 없음');
  if (calls >= MAX_CALLS) throw new Error(`호출 상한(${MAX_CALLS}회)에 도달`);
  calls++;
  const q = new URLSearchParams({ MobileOS: 'ETC', MobileApp: 'DadWhereToday', _type: 'json', ...params });
  for (let i = 1; i <= 3; i++) {
    try {
      const res = await fetch(`${BASE}/${op}?serviceKey=${key}&${q}`, { signal: AbortSignal.timeout(30000) });
      const text = await res.text();
      if (text.startsWith('<')) throw new Error(text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160)); // 키·한도 오류는 XML 로 온다
      const j = JSON.parse(text);
      const h = j.response?.header;
      if (h?.resultCode && h.resultCode !== '0000') throw new Error(`${h.resultCode} ${h.resultMsg}`);
      return j.response?.body ?? {};
    } catch (e) {
      if (i === 3 || /LIMIT|SERVICE KEY|한도|인증/i.test(e.message)) throw new Error(`${op}: ${e.message.replaceAll(key, '<KEY>')}`);
      await sleep(800 * i);
    }
  }
}

// 검색 목록: 쓰는 필드만 남겨 18시간 저장 → 같은 날 반복 실행에서 호출을 아낀다
const KEEP = ['contentid', 'contenttypeid', 'title', 'addr1', 'addr2', 'mapx', 'mapy', 'lDongRegnCd', 'firstimage', 'cpyrhtDivCd', 'modifiedtime', 'tel', 'eventstartdate', 'eventenddate'];
export async function cachedSearch(cacheKey, op, params) {
  const hit = getCache().search[cacheKey];
  if (hit && Date.now() - hit.t < SEARCH_TTL) return hit.body;
  const b = await tourCall(op, params);
  const body = { totalCount: b.totalCount, items: { item: itemsOf(b).map(it => Object.fromEntries(KEEP.filter(k => it[k] !== undefined).map(k => [k, it[k]]))) } };
  getCache().search[cacheKey] = { t: Date.now(), body };
  await sleep(60);
  return body;
}
