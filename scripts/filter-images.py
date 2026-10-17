#!/usr/bin/env python3
"""수집이 끝난 public/data 의 사진에서 체험객·관람객 얼굴(초상권)이 나온 것을 걸러 기본 이미지로 바꾼다.

- 대상: 예약(yeyak)·TourAPI(행사/장소)·서울 문화공간 사진. 서울시 문화행사 포스터·키즈카페 일러스트·직접 등록은 검사하지 않는다.
- 판정: 얼굴 감지(OpenCV YuNet, 점수 0.5 이상) + 사진다움(평평한 색 영역이 25% 미만). 일러스트·포스터의 그림 얼굴은 평평해서 걸러지지 않는다.
- 결과는 .cache/image-judged.json 에 주소별로 저장해 이미지는 한 번만 내려받는다(actions/cache).
- 사람이 정하는 목록: data/image-exclude.json(무조건 제외), data/image-allow.json(무조건 허용).
- 내려받기·감지에 실패한 이미지는 이번 수집에서는 뺀다(다음 수집 때 다시 시도).
사용: python scripts/filter-images.py   (환경변수 DATA_DIR, CACHE_DIR, MODEL 로 경로 변경)
"""
import concurrent.futures as cf, glob, json, os, sys, time, urllib.request

import cv2
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.environ.get('DATA_DIR', os.path.join(ROOT, 'public', 'data'))
CACHE = os.environ.get('CACHE_DIR', os.path.join(ROOT, '.cache'))
MODEL = os.environ.get('MODEL', os.path.join(CACHE, 'yunet.onnx'))
JUDGED = os.path.join(CACHE, 'image-judged.json')
SCOPE_EVENT = {'yeyak', 'tourapi-festival'}
SCOPE_PLACE = {'tourapi', 'seoul-space'}
FACE_SCORE, FLAT_MAX, MAX_BYTES, BUDGET_SEC = 0.5, 0.25, 12_000_000, 15 * 60


def load_list(name):
    p = os.path.join(ROOT, 'data', name)
    try:
        return set(json.load(open(p, encoding='utf-8')))
    except (OSError, ValueError):
        return set()


def full(u):
    return u if u.startswith(('http', 'file:')) else 'https://yeyak.seoul.go.kr' + u


def fetch(u):
    req = urllib.request.Request(full(u), headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=25) as r:
        b = r.read(MAX_BYTES + 1)
    if len(b) < 100 or len(b) > MAX_BYTES:
        raise ValueError('size')
    return b


def judge(b, det):
    im = cv2.imdecode(np.frombuffer(b, np.uint8), cv2.IMREAD_COLOR)
    if im is None:
        raise ValueError('decode')
    sc = 1280 / max(im.shape[:2])
    small = cv2.resize(im, None, fx=sc, fy=sc) if sc < 1 else im
    h, w = small.shape[:2]
    det.setInputSize((w, h))
    _, faces = det.detect(small)
    if faces is None or not any(float(f[14]) >= FACE_SCORE for f in faces):
        return 'ok'
    g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
    g = cv2.resize(g, None, fx=256 / max(g.shape), fy=256 / max(g.shape)).astype(np.float32)
    mu = cv2.blur(g, (5, 5))
    flat = float(((cv2.blur(g * g, (5, 5)) - mu * mu) < 4).mean())
    return 'face' if flat < FLAT_MAX else 'ok'


def main():
    os.makedirs(CACHE, exist_ok=True)
    gu_files = sorted(glob.glob(os.path.join(DATA, 'gu', '*.json')))
    places_file = os.path.join(DATA, 'places.json')
    gu = {f: json.load(open(f, encoding='utf-8')) for f in gu_files}
    places = json.load(open(places_file, encoding='utf-8')) if os.path.exists(places_file) else {'places': []}
    ev_list = [e for d in gu.values() for e in (d if isinstance(d, list) else d.get('events', []))]
    targets = [e for e in ev_list if e.get('image') and e.get('source') in SCOPE_EVENT]
    targets += [p for p in places['places'] if p.get('image') and p.get('source') in SCOPE_PLACE]

    exclude, allow = load_list('image-exclude.json'), load_list('image-allow.json')
    try:
        cache = json.load(open(JUDGED, encoding='utf-8'))
    except (OSError, ValueError):
        cache = {}
    urls = {t['image'] for t in targets}
    todo = [u for u in urls if u not in exclude and u not in allow and u not in cache]
    print(f'[filter-images] 대상 이미지 {len(urls)}장 · 새로 검사 {len(todo)}장 · 제외 목록 {len(exclude)} · 허용 목록 {len(allow)}')

    failed = set()
    if todo:
        if not os.path.exists(MODEL):
            sys.exit(f'[filter-images] 얼굴 감지 모델이 없습니다: {MODEL}')
        t0 = time.time()

        def work(u):
            if time.time() - t0 > BUDGET_SEC:
                return u, None
            try:
                det = cv2.FaceDetectorYN.create(MODEL, '', (320, 320), 0.3, 0.3, 5000)
                return u, judge(fetch(u), det)
            except Exception:
                return u, None

        with cf.ThreadPoolExecutor(8) as ex:
            for n, (u, v) in enumerate(ex.map(work, todo), 1):
                if v is None:
                    failed.add(u)
                else:
                    cache[u] = v
                if n % 100 == 0:
                    print(f'[filter-images] {n}/{len(todo)}', flush=True)
        json.dump(cache, open(JUDGED, 'w', encoding='utf-8'), ensure_ascii=False)

    def blocked(u):
        return u in exclude or (u not in allow and (cache.get(u) == 'face' or u in failed))

    dropped = 0
    for t in targets:
        if blocked(t['image']):
            t['image'] = ''
            for k in ('image_license', 'imageLicense'):
                if k in t:
                    t[k] = ''
            dropped += 1
    for f, d in gu.items():
        json.dump(d, open(f, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    json.dump(places, open(places_file, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    faces = sum(1 for u in urls if cache.get(u) == 'face')
    print(f'[filter-images] 얼굴 감지 {faces}장 · 검사 실패 {len(failed)}장(이번엔 제외) · 기본 이미지로 바꾼 행사·장소 {dropped}건')


if __name__ == '__main__':
    main()
