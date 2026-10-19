// 지난 행사 거르기: 연도·날짜·시간을 확인해 날짜가 잘못됐거나, 이미 끝났거나, 지난해 자료인 행사를 뺀다.
// 앱 화면(data.js)과 수집 공정(src/ingest.js)이 같이 쓴다. 기준은 한국 시간.
const pad = n => String(n).padStart(2, '0');

// 한국 시간 기준 지금: 오늘 날짜(YYYY-MM-DD)와 자정부터 지난 분
export function kstNow(t = Date.now()) {
  const d = new Date(t + 9 * 3600 * 1000);
  return { today: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`, min: d.getUTCHours() * 60 + d.getUTCMinutes() };
}

// 달력에 있는 날짜인가(2026-02-30 같은 값은 거른다)
function validDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? '');
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

// 시간 글에서 그날 끝나는 시각(분): "10:00~18:00" → 18시(여러 개면 가장 늦은 것, 자정 넘김은 다음 날로),
// 시작 시각만 있으면 마지막 시작 + 2시간, 시각이 없으면 null
export function endMinute(time) {
  const s = String(time ?? '');
  let end = -1, start = -1;
  for (const m of s.matchAll(/(\d{1,2}):(\d{2})\s*[~∼\-–]\s*(\d{1,2}):(\d{2})/g)) {
    const a = +m[1] * 60 + +m[2];
    let b = +m[3] * 60 + +m[4];
    if (b <= a) b += 1440;
    end = Math.max(end, b);
  }
  if (end >= 0) return end;
  for (const m of s.matchAll(/(\d{1,2}):(\d{2})/g)) start = Math.max(start, +m[1] * 60 + +m[2]);
  return start >= 0 ? start + 120 : null;
}

// 행사를 빼야 하는 이유(보여 줘도 되면 '')
export function staleReason(e, now = kstNow()) {
  if (!validDate(e.start_date) || !validDate(e.end_date) || e.start_date > e.end_date) return '날짜 오류';
  if (!/[가-힣A-Za-z0-9]/.test(e.title ?? '')) return '제목 오류';   // 원본 글자가 깨져 "???"만 남은 행사
  if (e.end_date < now.today) return '끝난 행사';
  // 제목에 적힌 연도가 모두 올해보다 이전이면 지난해 자료("2025 건대프리마켓"). "2025-2026 시즌"처럼 올해가 들어 있으면 둔다
  const years = (String(e.title ?? '').match(/(?<!\d)20\d\d(?!\d)/g) ?? []).map(Number);
  if (years.length && Math.max(...years) < +now.today.slice(0, 4)) return '지난해 행사';
  if (e.end_date === now.today) {
    const end = endMinute(e.time);
    if (end != null && end <= now.min) return '오늘 끝남';
  }
  return '';
}
