# 아빠 오늘 어디가

서울 25개 구의 가족 나들이·행사를 캘린더로 보여 주는 모바일 웹앱. 기본 지역은 양천구이고 구 지도에서 바꾼다.
서버 없이 동작한다: **GitHub Actions 가 매주 월·화 수집(서울 25개 구 전체) → 구별 JSON 생성 → GitHub Pages 로 배포**, 앱은 JSON 을 읽어 브라우저에서 필터링한다.

## 구조
```
GitHub Actions (매주 월·화 10:00 KST)
  └ node src/ingest.js ── 서울시 문화행사 + 서울시 공공서비스예약(문화체험·교육) + 여기저기 서울형 키즈카페
        └ public/data/  meta.json · index.json(지도용 요약) · gu/<구>.json · desc/<구>.json
  └ public/ 을 GitHub Pages 로 배포
브라우저: index.json(61KB) + 선택한 구 파일(수십 KB)만 읽는다
```
| 파일 | 역할 |
|---|---|
| `src/ingest.js` | 25개 구 전체 수집 → 구별 파일 저장. 실패·건수 급감 시 아무것도 쓰지 않고 종료 코드 1 |
| `src/sources/seoul-events.js` | 서울시 문화행사 정보(`culturalEventInfo`) |
| `src/sources/yeyak.js` | 서울시 공공서비스예약(`ListPublicReservationCulture`, `...Education`) — 예약 링크·접수 상태 포함 |
| `src/sources/yeogijeogi.js` | 여기저기 서울형 키즈카페(시즌 주말 야외 키즈카페) — 우리동네 키움포털 목록 페이지(robots.txt 에서 `/icare/` 허용). **optional**: 실패해도 나머지는 계속 |
| `src/sources/manual.js` + `data/manual-events.json` | **직접 등록한 행사** — 어느 공공 데이터에도 없지만 공식 공지·보도로 확인한 행사를 적는다. 다른 소스와 겹치면 이쪽 값을 우선 |
| `src/sources/culture-festival.js` | 서울 동네 축제: **전국문화축제표준데이터**(지자체 등록, 공공데이터포털 `tn_pubr_public_cltur_fstvl_api`) — 구·주민센터 축제(양천가족 거리축제 등). 활용신청한 인증키 필요 |
| `src/sources/tourapi-festival.js` | 서울 행사·축제: 한국관광공사 TourAPI `searchFestival2` + 상세(요금·시간·주최) |
| `src/tourapi-client.js` | TourAPI 공통 호출(호출 상한, 검색 18시간 캐시, 상세 캐시) |
| `src/places/seoul-space.js` | 가볼 곳: 서울시 문화공간 정보 중 어린이박물관·과학관·체험관 등(이름·설명 문구로 선별) |
| `src/places/tourapi.js` | 가볼 곳: 한국관광공사 TourAPI — 서울·경기의 어린이박물관·과학관(천문대)·체험관·안전체험관·동물원 등. **TOURAPI_KEY 필요**, 실패해도 이전 데이터를 이어 씀 |
| `src/dong.js`, `data/dong-boundaries.json` | 좌표·문구로 **동** 찾기. 경계는 통계청 SGIS 2018 읍면동(공공누리 1유형)에서 `scripts/build-dong.js` 로 만든 서울 424·경기 563개. 표시 이름은 목1동·목2동 → 목동처럼 숫자를 뗀다 |
| `src/classify.js` | 카테고리 분류, 「아이와」 추정 |
| `public/data.js` | 구별 JSON 로더, 필터·캘린더·지도 집계 |
| `public/app.js` | 모바일 UI (홈·캘린더·구 지도·저장, 상세·검색 전체 화면) |
| `scripts/build-map.js` | 구 경계 GeoJSON → `public/seoul-map.json` |
| `src/hospitals.js` | 서울 소아과 병·의원(국립중앙의료원, 키 `HOSP_API_KEY`) → `public/data/hospitals/<구>.json` (병원 탭) |
| `scripts/set-data-base.js` | 앱 빌드용: 앱이 읽을 데이터 주소를 `public/config.js` 에 기록 |
| `capacitor.config.json`, `android/` | 안드로이드 앱 프로젝트(Capacitor) |
| `.github/workflows/build-android.yml` | 클라우드에서 테스트용 APK 빌드 |
| `.github/workflows/update-and-deploy.yml` | 매주 월·화 수집 + 배포 |

## 로컬에서 실행
```
copy .env.example .env      # SEOUL_API_KEY 를 발급받은 키로 교체
npm run ingest              # 수집 (1~3분)
npm start                   # http://localhost:3000
```
Node 20 이상. 외부 패키지 없음. 인증키: data.seoul.go.kr 회원가입 → 오픈API 인증키 신청(무료).

## GitHub 에 올려 자동화하기
1. 저장소를 만든다. **무료 GitHub Pages 는 공개(public) 저장소에서만** 된다. (비공개로 하려면 유료 플랜이나 Cloudflare Pages 등 다른 호스팅)
2. Settings → Secrets and variables → Actions → `SEOUL_API_KEY` 등록. 이후 로컬의 `api.txt`는 지워도 된다(`.env`·`api.txt`는 `.gitignore`).
3. Settings → Pages → Source 를 **GitHub Actions** 로 설정.
4. Actions 탭 → 「행사 업데이트 및 배포」 → Run workflow 로 첫 배포. 이후 매주 월·화 새벽에 자동(그 사이에는 Run workflow 로 수동 갱신).

### 알아둘 점
- **해외 IP 접근**: Actions 서버는 해외에 있다. 서울시 API 가 해외 IP 를 막는지는 확인되지 않았다. 첫 실행에서 실패하면 로그에 오류가 남고 배포는 건너뛴다(기존 사이트 유지). 막히는 경우 한국 리전 서버로 옮긴다(`npm run ingest` 를 서버 cron 으로).
- **스케줄 중단**: 저장소에 60일 넘게 활동이 없으면 GitHub 가 스케줄 실행을 자동으로 끌 수 있다. 가끔 Actions 탭을 확인하거나 수동 실행한다.
- 실패 알림은 GitHub 기본 메일(워크플로 실패 시)을 쓴다. 실행 시각은 정확히 10:00 이 아니라 몇 분~수십 분 밀릴 수 있다.

## 폰·외부 기기에서 열기
- **같은 와이파이의 폰**: `http://<PC의 IP>:3000` (localhost 는 폰 자신을 가리키므로 안 된다). Windows 방화벽이 막으면 `Set-NetConnectionProfile -InterfaceAlias "Wi-Fi" -NetworkCategory Private` 와 3000번 포트 허용 규칙이 필요하다(관리자 PowerShell, 집 와이파이일 때만).
- **어디서든(권장)**: GitHub Pages 에 올린다. 명령줄로 하면:
  ```
  winget install GitHub.cli        # 설치 후 새 터미널
  gh auth login                    # 브라우저로 로그인
  git init -b main
  git config user.name "이름"       # 커밋 기록에 공개된다. 이메일은 GitHub noreply 주소를 권장
  git config user.email "<id>+<아이디>@users.noreply.github.com"
  git add . && git commit -m "첫 커밋"
  gh repo create <저장소이름> --public --source . --push
  gh secret set SEOUL_API_KEY      # 키를 붙여 넣기
  gh api -X POST repos/<아이디>/<저장소이름>/pages -f build_type=workflow
  gh workflow run "행사 업데이트 및 배포"
  ```
  배포가 끝나면 `https://<아이디>.github.io/<저장소이름>/` 로 어디서든 열린다.

## 안드로이드 앱 만들기 (Capacitor)
웹 코드를 그대로 안드로이드 앱으로 감싼다. `android/` 폴더가 프로젝트다.
- **앱이 읽는 데이터**: 앱 안에는 빌드 시점의 스냅샷이 들어가고, 평소에는 `public/config.js` 의 `APP_DATA_BASE`(배포 주소)에서 매일 갱신되는 최신 데이터를 읽는다. 오프라인이면 스냅샷으로 대체된다.
- **클라우드에서 APK 만들기(Android Studio 불필요)**: 저장소에 올린 뒤 Actions → 「안드로이드 앱 빌드 (테스트용 APK)」 → Run workflow. 끝나면 Artifacts 의 `abba-debug-apk` 를 폰으로 옮겨 설치한다(출처를 알 수 없는 앱 허용 필요). *이 워크플로는 아직 실행해 보지 않았다.*
- **내 PC에서 만들기**: Android Studio 를 한 번 실행해 SDK 를 설치한 뒤
  ```
  node scripts/set-data-base.js https://<아이디>.github.io/<저장소이름>/
  npm run ingest
  npm run cap:sync
  npm run cap:open        # Android Studio 에서 ▶ 실행 또는 Build > Build APK
  ```
- **출시 전에 정할 것**: `capacitor.config.json` 의 `appId`(지금은 확정값 `com.kidswithdaddy`(2026-10-16))는 구글 플레이에 올린 뒤에는 바꿀 수 없다. 플레이 업로드용 서명(AAB)과 AdMob 연동은 아직 하지 않았다.

## 데이터 출처·주의
- 서울시 문화행사 정보, 서울시 공공서비스예약 정보(공공누리 1유형: 출처 표시 시 상업적 이용·변경 가능) — 서울 열린데이터광장.
- 여기저기 서울형 키즈카페 — 서울시 우리동네 키움포털(umppa.seoul.go.kr/icare). 열린데이터 API 가 없어 목록 페이지를 하루 1회(6쪽) 읽는다. 장소별 시즌·운영 요일(주말)이 이 페이지에 있다. 화면 구조가 바뀌면 파싱이 깨질 수 있어 실패 시 경고만 남기고 해당 행사만 빠진다. 서비스 약관·이용 정책은 별도로 확인할 것.
- **목록은 구·동 단위로 묶는다**: 행사·장소에 `dong` 을 붙인다(직접 적은 값 → 좌표로 찾은 동(같은 구일 때만) → 글에 그 구의 동 이름이 있으면 그 동). 행사는 약 95%, 장소는 거의 전부에 붙고 못 찾으면 '그 밖의 지역'. 경계가 2018년 기준이라 최근 바뀐 동 구역과 어긋날 수 있다.
- **서울 전체 행사·축제 보완**: 서울시 문화행사 API 는 구청·상인회가 여는 동네 축제를 일정하게 싣지 않는다(예: 목동로데오 패션거리 문화축제는 2022·2023년만 등록, 2024·2025년은 빠짐). 그래서 ① 서울시 문화행사 ② 전국문화축제표준데이터 ③ TourAPI 행사 세 곳을 합치고, 같은 구·겹치는 기간·비슷한 제목이면 하나로 합친다(앞 소스 우선, 빈 항목만 채움). 그래도 어디에도 등록되지 않은 행사는 나오지 않으므로 `data/manual-events.json` 에 직접 등록한다(항목 설명은 `src/sources/manual.js` 맨 위). 값을 추측하지 말고 공식 공지·보도로 확인한 내용만, 출처는 `source_note` 에 적는다. 파일을 고쳐 올리면 배포 때 반영되고, 끝난 행사는 자동으로 빠진다. 양천구청 게시판은 `robots.txt` 로 자동 수집이 막혀 있어 쓰지 않는다.
- 인증키 `TOURAPI_KEY`(깃허브 Secrets 포함)는 공공데이터포털 계정 키 하나로 TourAPI 와 전국문화축제표준데이터에 같이 쓴다. 다만 각 API 마다 '활용신청'이 따로 필요하다(`DATA_GO_KR_KEY` 로 다르게 지정할 수도 있음).
- **가볼 곳(상시 운영 장소)**: 서울시 문화공간 정보 + 한국관광공사 TourAPI(공공데이터포털 인증키 `TOURAPI_KEY`, 로컬은 `.env`, 깃허브는 Secrets). 제목 문구로 아이와 가기 좋은 곳만 골랐고(어린이박물관·과학관·체험관·안전체험관·자연·생태), 숙박·동네 놀이터·도서관·산책길은 뺀다. 같은 시설이 두 소스에 있으면 합친다.
  - **호출 한도**: TourAPI 개발 계정은 하루 1,000건 안팎(페이지 표기). 검색 약 55회 + 상세(운영 시간·요금) 2회×곳 수인데, 상세는 수정 시각이 같으면 `.cache/tourapi.json` 을 재사용하고 CI 에서는 `actions/cache` 로 이어 쓴다. `TOURAPI_MAX_CALLS`(기본 800)로 상한을 둔다. 한도에 닿거나 실패하면 이전 배포의 장소 데이터를 유지한다.
  - **사진 이용**: 공공누리 1·3유형(상업적 이용 가능)인 사진만 쓴다. 2·4유형(상업적 이용 금지)은 광고가 붙는 앱에 쓸 수 없어 제외한다. 3유형은 변경 금지이므로 사진을 자르거나 가공하지 않는 화면 구성인지 출시 전에 확인할 것.
  - 운영 시간·요금·휴관일은 제공기관 입력값이라 비어 있거나 틀릴 수 있다.
- 요일이 정해진 행사(예: 주말에만 운영)는 `dow`(요일 비트마스크)로 저장하고, 조회 기간에 그 요일이 없으면 목록·캘린더·지도 집계에서 뺀다.
- 동·동네 단위 행사는 이 API 에 거의 없다. 공공서비스예약 덕에 양천구 기준 31건(2026-10-16)으로 늘었지만, 주민센터·맘카페 행사는 별도 수집·등록이 필요하다.
- 공공서비스예약의 교육강좌는 성인 대상이 많아 **아이·가족 대상만** 싣는다.
- 「아이와」 표시는 대상·제목 문구 기반 추정이라 틀릴 수 있다.
- 구 경계: southkorea/seoul-maps (KOSTAT 2013). 공개 배포 전 라이선스 확인.
- 날씨: Open-Meteo(키 불필요, 서울 기준). 아이와 노는 시간인 **10~18시** 시간대 예보만 본다(하루 최대 강수확률은 새벽·밤 값이 섞여 쓰지 않음). 시간당 0.5mm 이상이 있거나 구간 합계 1mm 이상이면 '비'(시작 시각 표시), 확률 60% 이상이면 '비 올 수도', 40% 이상이지만 예상 강수가 거의 없으면 '비 걱정 적어요', 그 외 '비 걱정 없어요'. 기준값은 임의로 정한 것이라 `public/app.js` 의 `loadWeather` 에서 조정한다. 저장(하트)·선택 지역은 기기 브라우저에만 저장된다.
