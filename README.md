# 아빠 오늘 어디가

서울 25개 구의 가족 나들이·행사를 캘린더로 보여 주는 모바일 웹앱. 기본 지역은 양천구이고 구 지도에서 바꾼다.
서버 없이 동작한다: **GitHub Actions 가 매일 수집(서울 25개 구 전체) → 구별 JSON 생성 → GitHub Pages 로 배포**, 앱은 JSON 을 읽어 브라우저에서 필터링한다.

## 구조
```
GitHub Actions (매일 04:00 KST)
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
| `src/classify.js` | 카테고리 분류, 「아이와」 추정 |
| `public/data.js` | 구별 JSON 로더, 필터·캘린더·지도 집계 |
| `public/app.js` | 모바일 UI (홈·캘린더·구 지도·저장, 상세·검색 전체 화면) |
| `scripts/build-map.js` | 구 경계 GeoJSON → `public/seoul-map.json` |
| `scripts/set-data-base.js` | 앱 빌드용: 앱이 읽을 데이터 주소를 `public/config.js` 에 기록 |
| `capacitor.config.json`, `android/` | 안드로이드 앱 프로젝트(Capacitor) |
| `.github/workflows/build-android.yml` | 클라우드에서 테스트용 APK 빌드 |
| `.github/workflows/update-and-deploy.yml` | 매일 수집 + 배포 |

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
4. Actions 탭 → 「행사 업데이트 및 배포」 → Run workflow 로 첫 배포. 이후 매일 자동.

### 알아둘 점
- **해외 IP 접근**: Actions 서버는 해외에 있다. 서울시 API 가 해외 IP 를 막는지는 확인되지 않았다. 첫 실행에서 실패하면 로그에 오류가 남고 배포는 건너뛴다(기존 사이트 유지). 막히는 경우 한국 리전 서버로 옮긴다(`npm run ingest` 를 서버 cron 으로).
- **스케줄 중단**: 저장소에 60일 넘게 활동이 없으면 GitHub 가 스케줄 실행을 자동으로 끌 수 있다. 가끔 Actions 탭을 확인하거나 수동 실행한다.
- 실패 알림은 GitHub 기본 메일(워크플로 실패 시)을 쓴다. 실행 시각은 정확히 04:00 이 아니라 몇 분~수십 분 밀릴 수 있다.

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
- **출시 전에 정할 것**: `capacitor.config.json` 의 `appId`(지금은 임시값 `com.example.dadwheretoday`)는 구글 플레이에 올리면 바꿀 수 없으니 **업로드 전에** 확정한다. 변경 시 `android/` 를 지우고 `npx cap add android` 로 다시 만들고 아이콘을 다시 적용한다. 플레이 업로드용 서명(AAB)과 AdMob 연동은 아직 하지 않았다.

## 데이터 출처·주의
- 서울시 문화행사 정보, 서울시 공공서비스예약 정보(공공누리 1유형: 출처 표시 시 상업적 이용·변경 가능) — 서울 열린데이터광장.
- 여기저기 서울형 키즈카페 — 서울시 우리동네 키움포털(umppa.seoul.go.kr/icare). 열린데이터 API 가 없어 목록 페이지를 하루 1회(6쪽) 읽는다. 장소별 시즌·운영 요일(주말)이 이 페이지에 있다. 화면 구조가 바뀌면 파싱이 깨질 수 있어 실패 시 경고만 남기고 해당 행사만 빠진다. 서비스 약관·이용 정책은 별도로 확인할 것.
- 요일이 정해진 행사(예: 주말에만 운영)는 `dow`(요일 비트마스크)로 저장하고, 조회 기간에 그 요일이 없으면 목록·캘린더·지도 집계에서 뺀다.
- 동·동네 단위 행사는 이 API 에 거의 없다. 공공서비스예약 덕에 양천구 기준 31건(2026-10-16)으로 늘었지만, 주민센터·맘카페 행사는 별도 수집·등록이 필요하다.
- 공공서비스예약의 교육강좌는 성인 대상이 많아 **아이·가족 대상만** 싣는다.
- 「아이와」 표시는 대상·제목 문구 기반 추정이라 틀릴 수 있다.
- 구 경계: southkorea/seoul-maps (KOSTAT 2013). 공개 배포 전 라이선스 확인.
- 날씨: Open-Meteo(키 불필요, 서울 기준). 아이와 노는 시간인 **10~18시** 시간대 예보만 본다(하루 최대 강수확률은 새벽·밤 값이 섞여 쓰지 않음). 시간당 0.5mm 이상이 있거나 구간 합계 1mm 이상이면 '비'(시작 시각 표시), 확률 60% 이상이면 '비 올 수도', 40% 이상이지만 예상 강수가 거의 없으면 '비 걱정 적어요', 그 외 '비 걱정 없어요'. 기준값은 임의로 정한 것이라  의  에서 조정한다. 저장(하트)·선택 지역은 기기 브라우저에만 저장된다.
