// 앱 빌드용: public/config.js 의 데이터 주소를 설정한다.
// 사용: npm run set:data-base -- https://아이디.github.io/저장소이름/   (비우면 웹 모드)
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
let base = (process.argv[2] || process.env.DATA_BASE_URL || '').trim();
if (base && !/^https:\/\//.test(base)) { console.error('https:// 로 시작하는 주소가 필요합니다'); process.exit(1); }
if (base && !base.endsWith('/')) base += '/';
writeFileSync(path.join(root, 'public', 'config.js'), `// 자동 생성 — scripts/set-data-base.js
window.APP_DATA_BASE = ${JSON.stringify(base)};
`);
console.log(`[config] APP_DATA_BASE = ${base || '(웹 모드: 비움)'}`);
