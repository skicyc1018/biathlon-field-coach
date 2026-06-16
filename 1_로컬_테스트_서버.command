#!/bin/zsh
cd "$(dirname "$0")"

PORT=8020
if lsof -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  PORT=8021
fi

echo "============================================================"
echo "Biathlon Field Coach v1.0.5 로컬 테스트 서버"
echo "============================================================"
echo "폴더: $(pwd)"
echo "주소: http://127.0.0.1:$PORT/?v=105"
echo ""
echo "이 창을 닫거나 Control+C를 누르면 서버가 종료됩니다."
echo "============================================================"

(sleep 1; open "http://127.0.0.1:$PORT/?v=105") &
python3 -m http.server $PORT
