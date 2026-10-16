// 앱 빌드용: 이미 배포된 사이트의 data/ 를 받아 public/data 에 저장한다(앱 안에 넣는 오프라인 스냅샷).
// 공공 API 를 다시 호출하지 않으므로 호출 한도를 쓰지 않고, 앱 스냅샷이 사이트 데이터와 항상 같다.
// 사용: node scripts/fetch-live-data.js https://아이디.github.io/저장소이름/
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
let base = (process.argv[2] || process.env.DATA_BASE_URL || '').trim();
if (!/^https:\/\//.test(base)) { console.error('https:// 로 시작하는 배포 주소가 필요합니다'); process.exit(1); }
if (!base.endsWith('/')) base += '/';

const out = path.join(root, 'public', 'data');
const get = async rel => {
  const r = await fetch(`${base}data/${rel}`);
  if (!r.ok) throw new Error(`${rel} → HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
};
const save = (rel, buf) => {
  const f = path.join(out, decodeURIComponent(rel));
  mkdirSync(path.dirname(f), { recursive: true });
  writeFileSync(f, buf);
};

const indexBuf = await get('index.json');
const { gu } = JSON.parse(indexBuf.toString('utf8'));
save('index.json', indexBuf);
let n = 1;
for (const rel of ['meta.json', 'places.json', ...gu.flatMap(g => [`gu/${encodeURIComponent(g)}.json`, `desc/${encodeURIComponent(g)}.json`])]) {
  save(rel, await get(rel)); n++;
}
console.log(`[live-data] ${base}data/ 에서 ${n}개 파일을 받았습니다`);
