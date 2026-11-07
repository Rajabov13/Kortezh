# Подготовка своей модели машины для игры.
# Использование: bash tools/models/buildm.sh <папка-с-scene.gltf> <id-машины> [auto|0|1] [целевое-число-треугольников]
#   auto/0/1 — где перёд машины: определить автоматически, оставить как есть или развернуть на 180°.
# Результат: site/models/<id>.glb. Затем добавьте запись в site/models/models.json.
# Нужны: Node.js, python3; пакеты ставятся сами (npm install в этой папке).
set -e
D=$(cd "$(dirname "$0")" && pwd); ROOT=$(cd "$D/../.." && pwd); SRC=$(cd "$1" && pwd); ID=$2; FLIP=${3:-auto}; T=${4:-220000}
cd "$D"; [ -d node_modules ] || npm install --no-audit --no-fund @gltf-transform/cli@4 @gltf-transform/core@4 @gltf-transform/extensions@4 @gltf-transform/functions@4 meshoptimizer >/dev/null
GT="$D/node_modules/.bin/gltf-transform"; W=$(mktemp -d)
node prep.mjs "$SRC/scene.gltf" "$W/raw.glb" "$FLIP"
TRIS=$(node -e "
const {NodeIO}=require('@gltf-transform/core');const {ALL_EXTENSIONS}=require('@gltf-transform/extensions');
new NodeIO().registerExtensions(ALL_EXTENSIONS).read('$W/raw.glb').then(d=>{let t=0;for(const m of d.getRoot().listMeshes())for(const p of m.listPrimitives()){const i=p.getIndices();t+=(i?i.getCount():p.getAttribute('POSITION').getCount())/3}console.log(Math.round(t))})")
R=$(python3 -c "print(min(1,round($T/$TRIS*1.15,3)))")
if [ "$R" = "1" ]; then SIMP="--simplify false"; else SIMP="--simplify true --simplify-ratio $R --simplify-error 0.002 --simplify-lock-border true"; fi
"$GT" optimize "$W/raw.glb" "$W/opt.glb" --compress false --texture-compress webp --texture-size 1024 --join false --palette false --instance false --flatten false $SIMP >/dev/null
"$GT" draco "$W/opt.glb" "$ROOT/site/models/$ID.glb" --quantization-volume scene --quantize-position 16 >/dev/null
rm -rf "$W"
echo "$ID: треугольников было $TRIS, коэффициент $R, файл $(du -k "$ROOT/site/models/$ID.glb" | cut -f1) КБ"
