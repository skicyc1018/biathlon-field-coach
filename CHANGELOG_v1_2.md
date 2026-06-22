# CHANGELOG — Biathlon Field Coach v1.2 Cost-Free Auto Board

비용 없는(유료 AI/외부 API 없음) 오프라인 현장형 안정판. 무료 자동 보조 + 지도자 최종 확인 구조.

---

## 1. 수정한 파일 목록

- `index.html` — 제목/홈/버튼 문구 정리, `⚡ 자동 보조 다시 실행`, `◎ 보드 맞춤 보정` 추가, 보드 맞춤 컨트롤 바 추가, 안내 문구 갱신.
- `style.css` — 보드 맞춤 보정 컨트롤(`.fitControls`) 스타일 추가.
- `app.js` — 상태 모델·자동 보조·보드 맞춤 보정·판정 로직·자석 표시·직접 마킹 보드·결과 리포트 정리(아래 상세).
- `manifest.webmanifest` — `name` = "Biathlon Field Coach v1.2 Cost-Free Auto Board", `start_url` = `./index.html?v=12-costfree-stable`.
- `service-worker.js` — 캐시명 `bfc-v1-2-costfree-stable`.
- `1_로컬_테스트_서버.command` — 주소 버전 `?v=12-costfree-stable`, 안내 문구 v1.2로.
- `README_설치_사용.md` — v1.2 Cost-Free Auto Board 기준으로 갱신.

## 2. 새로 만든 파일

- `dev-test.html` — 개발자용 일괄 검증 페이지(여러 사진에 자동 보조 가이드 오버레이, confidence/method 표시, 저장 없음, UI 비노출).
- `AUTO_BOARD_TEST_GUIDE.md` — 테스트 사진/정답/합격 기준 문서.
- `CHANGELOG_v1_2.md` — 본 문서.

## 3. 삭제/제거한 AI/Roboflow/mock 요소

- `mockAIResult`, `applyAIResult`, `runAIDetection` 함수 및 호출부 제거(이전 단계에서 제거 완료, 본 안정판에서 재확인).
- Roboflow / OpenAI / API key / GitHub token 등 비밀키 요구·코드 전무(코드베이스 전체 검색으로 확인).
- "AI 자동분석" 문구 → "⚡ 자동 보조 다시 실행"으로 통일.
- 외부 네트워크/유료 추론 호출 없음.

## 4. 유지한 기능

- 사진 위 직접 마킹, 표준 보드판 직접 마킹.
- 탄착점 이동/삭제/판정 수정, 발수 1~5발.
- 결과 저장(localStorage), 결과 목록, 선수 관리, 데이터 백업/삭제.
- PDF 저장/인쇄, 결과 이미지 공유(navigator.share, 실패 시 안내).
- PWA 오프라인(서비스워커 캐시, 상대경로, 홈 화면 추가).

## 5. 새로 추가/정리한 기능

### 무료 자동 보조 (Phase C)
- `runAutoAssist()`로 통일, 외부 API 호출 없음.
- 보드판 가이드 후보만 표시: 입사 외곽선(얇은 청록), 복사선(밝은 청록), 중심 십자.
- 가짜 탄착점/가짜 자석 생성 안 함. 라벨 "자동 보조 후보(확인 필요)" 항상 표시.
- 자동 보조 실패 시에도 직접 마킹·보정은 정상.

### 보드판 데이터 모델 (Phase B)
- `S.board = { cx, cy, rx, ry, rotation, rStandingNorm:1.0, rProneNorm, confidence, method, needsReview }`.
- `method`: `auto-assist` / `manual-template`. `needsReview`: 지도자 확인 필요 여부.

### 보드 맞춤 보정 UI (Phase D)
- `◎ 보드 맞춤 보정` 모드: 드래그로 중심 이동, 컨트롤로 크게/작게/가로/세로/회전/복사선 안·밖 조정.
- 보정 시 `S.board` 갱신, `needsReview=false`, 판정 즉시 갱신.

### 직접 마킹 보드 (Phase E)
- 검은 원 + 중앙 가로/세로 점선 + ①점선 ②굵은 실선(복사) ③점선 ④외곽(입사).
- 노란 외곽선/빨간 점선/추가 외곽선/홍보 문구 제거.

### 자석 표시 (Phase F)
- 얇은 둘레 원 + 중심 작은 점·십자, 번호는 자석 바깥쪽.
- 명중 = 청록, 불명중 = 빨강. 큰 색상 박스로 자석을 덮지 않음.

### 판정 로직 (Phase G)
- 타원 기준: 자석 좌표를 보드 중심 기준으로 변환 → 회전 역적용 → `x/rx, y/ry` 정규화 거리.
- 자석 반경을 평균 반경으로 정규화하여 보정: `normDistance − magnetRadiusNorm <= 기준반경`.
- 기준반경: 복사 = `rProneNorm`, 입사 = `1.0`. 제로 = 명중 처리(편차/탄착군 분석 우선).
- 사진+보드는 타원 기준, 직접/수동 원형은 기존 원형 기준(폴백).

### 결과 리포트 (Phase H)
- 항목: 선수, 일시, 구분, 발수, 세트, 명중 수, 명중률, 좌우/상하 평균 편차, 탄착군 크기, 중앙 평균 거리, 자동 보조 사용 여부, 지도자 수정 여부, 메모, 이미지.
- 결과지 버튼(홈/분석/PDF/공유/닫기)은 모달 최상단 sticky로 항상 노출, 하단 메뉴에 가리지 않음.

## 5-1. 좌표계 통일 핫픽스 (Claude 코드 리뷰 반영)

기존에는 `S.board`만 원본 이미지 좌표, `S.points/S.center/S.rProne/S.rStanding`는 화면(CSS) 좌표라 화면 채움·리사이즈·회전 시 탄착점이 사진에서 어긋났다. 이를 모두 **콘텐츠 좌표**(사진=원본 이미지 픽셀, 직접 마킹=논리 1000 정사각)로 통일했다.

- 변환 함수 추가: `screenToImage`, `imageToScreen`, `imageRadiusToScreen`, `screenRadiusToImage`, `viewTransform`(단일 배율, 왜곡 없음).
- `S.points`(x,y,r), `S.center`, `S.rProne`, `S.rStanding`를 콘텐츠 좌표로 저장. 그릴 때만 `imageToScreen`으로 변환.
- 클릭/이동/근접 탐색은 화면↔콘텐츠 변환을 적용(히트 테스트 허용오차는 화면 28px 유지).
- 자동 보조/보드 맞춤 성공 시 `syncBoardToBaseline()`으로 `S.center = (board.cx,board.cy)`, `S.rStanding = (rx+ry)/2`, `S.rProne = rStanding*rProneNorm`를 **초안**으로 채움(`needsReview=true` 유지, "자동 보조 후보(확인 필요)" 표시).
- **위험한 기본값 제거:** 기준이 없을 때 `isHit`가 모두 명중 처리하던 동작을 폐기. `pointStatus()`가 `'hit' | 'miss' | 'unknown'`을 반환하고, 기준이 없으면 `unknown`(화면에 "?", 리포트에 "판정 전")으로 표시하며 절대 자동 명중하지 않음.
- 판정은 `S.board`가 있으면 타원 기준(중심 이동 → rotation 역적용 → x/rx,y/ry 정규화 → 자석 반경 정규화 보정, `normDistance − magnetRadiusNorm <= 기준반경`). 복사=`rProneNorm`, 입사=`1.0`. 보드가 없으면 원형 fallback 유지.
- 사격 구분 변경 시 기존 점 판정이 재계산되고, "구분 변경으로 판정 재계산됨" 안내를 잠깐 표시.
- `file://`에서는 서비스워커 등록을 건너뜀(아래 9 참고).

## 9. file:// 실행 금지

`index.html`을 `file://`로 직접 열면 PWA 서비스워커가 등록되지 않고 오프라인 캐시/일부 기능이 동작하지 않는다. 반드시 **로컬 서버**(`1_로컬_테스트_서버.command`) 또는 **GitHub Pages(https)** 로 열 것. (코드에서도 `location.protocol==='file:'`이면 서비스워커 등록을 건너뛴다.)

## 6. 테스트 방법

1. `1_로컬_테스트_서버.command` 실행 → 브라우저 자동 열림(`?v=12-costfree-stable`).
2. 분석 → 사진 업로드 → 자동 보조 후보(확인 필요) 가이드 확인.
3. 후보가 틀리면 `◎ 보드 맞춤 보정`으로 이동/크기/회전/복사선 맞춤, 또는 ①/②/④ 기준선 보정.
4. `＋ 직접 마킹`으로 탄착점 입력 → 이동/삭제/판정 수정 → 저장 → 리포트 확인.
5. `보드판 직접 마킹`에서 사진 없이 동일 동작 확인.
6. 일괄 검증: `dev-test.html`에서 여러 사진의 가이드/confidence/method 확인.
7. 오프라인: 홈 화면 추가 후 네트워크 차단 → 앱 실행/직접 마킹/결과 확인.

## 7. 아직 남은 한계

- 순수 JS 자동 보조는 조명/원근/가림/배경 잡음에서 외곽선·복사선이 틀릴 수 있음 → **보조 수준**이며 지도자 보정 필요.
- 편차/거리/탄착군 크기는 픽셀(px) 단위(실거리 환산 없음).
- 자석 반경은 화면 기준 고정값(기본 14px) 근사. 사진 배율에 따라 수동 점 보정 권장.
- 자석 자동 후보 탐지는 본 안정판에서 미구현(가짜 데이터 방지).

## 8. GitHub 업로드 파일 목록

- `index.html`
- `style.css`
- `app.js`
- `manifest.webmanifest`
- `service-worker.js`
- `icons/` (icon-192.png, icon-512.png)
- `README_설치_사용.md`
- `dev-test.html` (개발자 검증용, UI 비노출)
- `AUTO_BOARD_TEST_GUIDE.md`
- `CHANGELOG_v1_2.md`

> 자동 push 하지 않습니다. 위 파일을 직접 업로드하세요.
