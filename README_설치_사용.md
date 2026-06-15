# Biathlon Field Coach v1.0.1

## 수정 핵심
- GitHub Pages에서 CSS/JS가 로딩되지 않는 문제를 해결했습니다.
- 모든 경로를 `./style.css`, `./app.js`처럼 상대경로로 수정했습니다.
- PWA 설치용 `manifest.webmanifest`, `service-worker.js`, 아이콘 파일을 포함했습니다.

## GitHub 업로드 방법
저장소 첫 화면에 아래 파일들이 바로 보여야 합니다.

- index.html
- style.css
- app.js
- manifest.webmanifest
- service-worker.js
- icons/icon-192.png
- icons/icon-512.png
- README_설치_사용.md

폴더 하나 안에 또 폴더가 들어가는 형태로 올리면 안 됩니다.

## iPhone/iPad 설치
1. Safari에서 GitHub Pages 링크를 엽니다.
2. 공유 버튼을 누릅니다.
3. 홈 화면에 추가를 누릅니다.
4. 이후 앱 아이콘으로 실행합니다.

## v1.0.1 기능
- 선수 등록
- 제로/복사/입사 선택
- 1~5발 선택
- 사진 촬영/업로드
- 중앙점 지정
- 탄착점 추가/이동/삭제
- 자석을 덮지 않는 중심 십자 표시
- 선수별 저장
- 결과지 출력/PDF 저장
- 데이터 백업
