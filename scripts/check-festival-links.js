// 배포된 사이트의 축제 행사 링크가 열리는지 이 컴퓨터(국내 IP)에서 점검해 data/dead-links.json 에 저장한다
// 사용: node scripts/check-festival-links.js   → 결과 파일을 커밋·푸시하면 다음 수집부터 해당 축제가 삭제된다
// 404·410·5xx·접속 실패만 '안 열림'으로 본다. 로봇 차단(401·403·405·429)·인증서/HTTP 형식 오류는 열리는 것으로 본다.
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from '../src/env.js';
import { GU } from '../src/gu.js';

const SITE = 'https://fullpanic406-beep.github.io/dad-where-today/data';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36';

const alive = async url => {
  let last = '';
  for (let t = 0; t < 3; t++) {
    try {
      const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(12000), headers: { 'user-agent': UA } });
      await r.body?.cancel();
      if (r.status !== 404 && r.status !== 410 && r.status < 500) return [true, r.status];
      last = `HTTP ${r.status}`;
    } catch (err) {
      const code = String(err.cause?.code ?? '');
      if (/^(UNABLE_TO|CERT_|DEPTH_ZERO|SELF_SIGNED|ERR_TLS|ERR_SSL|HPE_)/.test(code) || /protocol/.test(String(err.cause?.message ?? ''))) return [true, code || 'protocol'];
      last = code || err.message;
    }
  }
  return [false, last];
};

const events = [];
for (const g of GU) events.push(...await (await fetch(`${SITE}/gu/${encodeURIComponent(g)}.json`)).json());
const fests = events.filter(e => e.category === 'festival' && e.link);
const byLink = new Map();
for (const e of fests) if (!byLink.has(e.link)) byLink.set(e.link, e.title);

// 접속 자체가 안 되는 경우(HTTP 응답 없음)는 그 사이트 메인도 안 열리면 점검 불가로 보고 삭제하지 않는다(사이트 점검·일시 장애일 수 있음)
const hostUp = new Map();
const siteOpens = async url => {
  const origin = new URL(url).origin;
  if (!hostUp.has(origin)) hostUp.set(origin, alive(origin + '/').then(([ok, why]) => ok || /^HTTP /.test(why)));
  return hostUp.get(origin);
};
const dead = [], skipped = [], links = [...byLink];
for (let i = 0; i < links.length; i += 8) {
  await Promise.all(links.slice(i, i + 8).map(async ([link, title]) => { const [ok, why] = await alive(link); if (ok) return; if (!/^HTTP /.test(why) && !(await siteOpens(link))) skipped.push({ link, title, why }); else dead.push({ link, title, why }); }));
}
dead.sort((a, b) => a.title.localeCompare(b.title, 'ko'));
// 절반 넘게 실패하면 이 컴퓨터 네트워크 문제로 보고 저장하지 않는다
if (links.length && dead.length / links.length > 0.5) { console.error(`중단: ${links.length}건 중 ${dead.length}건 실패 — 네트워크를 확인하세요.`); process.exit(1); }
writeFileSync(path.join(ROOT, 'data', 'dead-links.json'), JSON.stringify({ checkedAt: new Date().toISOString(), checked: links.length, links: dead }, null, 2));
console.log(`축제 링크 ${links.length}건 점검, 안 열림 ${dead.length}건`);
for (const d of dead) console.log(` - ${d.title} | ${d.link} | ${d.why}`);
if (skipped.length) console.log(`사이트 자체가 안 열려 판단 보류(삭제 안 함) ${skipped.length}건`);
for (const d of skipped) console.log(` ? ${d.title} | ${d.link} | ${d.why}`);
