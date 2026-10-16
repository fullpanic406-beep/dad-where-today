// 개발용 정적 서버 (npm start). 실제 배포는 GitHub Pages 가 public/ 을 그대로 서빙한다.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { loadEnv, ROOT } from './src/env.js';

loadEnv();
const PORT = Number(process.env.PORT) || 3000;
const PUBLIC = path.join(ROOT, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
};

http.createServer(async (req, res) => {
  try {
    let rel = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (rel === '/') rel = '/index.html';
    const file = path.normalize(path.join(PUBLIC, rel));
    if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
    const buf = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(buf);
  } catch (e) {
    res.writeHead(e.code === 'ENOENT' || e.code === 'EISDIR' ? 404 : 500); res.end('Not found');
  }
}).listen(PORT, () => console.log(`아빠 오늘 어디가 — http://localhost:${PORT}`));
