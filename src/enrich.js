// 보강 파일(data/enrich.json) 적용: 공공 API 원본에 없는 시간·요금·링크·포스터·상세 내용을, 사람이 출처를 확인해 적어 둔 값으로 덧씌운다.
// 행사 원본은 매 수집마다 다시 받아오지만 이 파일은 저장소에 남으므로 확인한 내용이 계속 유지된다.
//
// 항목 형식:
//   { "gu": "양천구", "title": "양천가족 거리축제",      // title 은 행사 제목에 '포함'되면 일치(띄어쓰기·괄호 무시)
//     "start_date": "2026-10-25",                       // (선택) 같은 이름 행사가 여러 회차일 때 구분
//     "set": { "time": "", "fee": "", "is_free": 1, "link": "", "image": "", "place": "", "target": "" },   // 값이 있는 칸만 덮어쓴다
//     "desc": "프로그램: …\n· 항목: 설명",               // (선택) 상세 설명을 통째로 바꾼다('이런 걸 해요' 카드에 나온다)
//     "note": "구청 공지·기사 ○○ 확인(2026-10-16)",       // 상세 화면 아래 안내 문구(무엇을 근거로 했는지)
//     "sources": ["https://…"] }                         // 근거 주소(화면에는 안 나오고 기록용)
import { existsSync, readFileSync } from 'node:fs';

const norm = s => String(s ?? '').replace(/[\s()\[\]·\-_,.:!~]/g, '').toLowerCase();
const KEYS = ['time', 'fee', 'is_free', 'link', 'image', 'place', 'target'];

export function applyEnrich(events, descs, file, log = console.log) {
  if (!existsSync(file)) return { applied: 0, unmatched: [] };
  let list;
  try { list = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { log(`[enrich] 읽지 못해 건너뜀: ${e.message}`); return { applied: 0, unmatched: [] }; }
  let applied = 0; const unmatched = [];
  for (const en of list) {
    if (!en?.title || !en.gu) continue;
    const t = norm(en.title);
    const hits = events.filter(e => e.gu === en.gu && norm(e.title).includes(t) && (!en.start_date || e.start_date === en.start_date));
    if (!hits.length) { unmatched.push(`${en.gu} ${en.title}`); continue; }
    for (const e of hits) {
      for (const k of KEYS) if (en.set?.[k] !== undefined && en.set[k] !== '') e[k] = en.set[k];
      if (en.desc) descs[e.id] = en.desc;
      if (en.note) e.source_note = en.note;
      e.enriched = true; applied++;
    }
  }
  log(`[enrich] 보강 ${applied}건 적용${unmatched.length ? ` · 일치하는 행사 없음(종료·제목 변경 가능): ${unmatched.join(', ')}` : ''}`);
  return { applied, unmatched };
}
