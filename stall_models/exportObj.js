// 攤位模型「匯出 OBJ」按鈕的瀏覽器端實作 — 見 99_website/tools/README.md「GUI 匯出按鈕」。
// 直接讀目前跑在頁面裡的 STALL_MODELS／STALL_MODEL_OVERRIDES／World.shops（保證跟 ISO 畫面畫出來的
// 東西一致），不用開終端機。邏輯是獨立實作，跟 tools/export_stall_models.js 分開維護——這個專案沒有
// bundler，瀏覽器跟 Node 沒辦法共用同一份程式碼（跟 tools/stallGeometryShared.js 的 loadShopsFromGrid()
// 獨立重算 shopFront() 是同樣的既有取捨，不是這裡新增的例外）。輸出格式跟 tools/export_stall_models.js
// 對齊：**一個造型類型一個 .obj 檔**＋一個 overrides.obj（所有真實店鋪的 floor guide／造型覆寫）。
// 只有支援 File System Access API 的瀏覽器（Chrome/Edge）能用；其餘瀏覽器 exportStallModelsToDisk() 會
// throw，呼叫端（index.html 的 bindUI()）負責顯示錯誤訊息、引導改用終端機。

let __objDirHandle = null; // 使用者選過一次「stall_models/obj」資料夾後快取起來，同一頁面 session 不用重選

function __dateStamp() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

function __hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

// 跟 tools/export_stall_models.js 的 buildShopSlots() 同一套排版邏輯（每家店鋪各佔一段 X 插槽，間距
// 15m）——只用在 overrides.obj（多家店鋪擠一個檔案），型別檔案各自獨立一個檔案不需要插槽，offset固定0。
function __buildShopSlotOffsets() {
  const SLOT_SPACING = 15;
  const offsetOf = {};
  World.shops.map(s => s.code).sort().forEach((c, i) => { offsetOf[c] = i * SLOT_SPACING; });
  return offsetOf;
}

// 一個 OBJ「檔案」的內容組合器，回傳 {addBox, build()}；build() 產生 {obj, mtl} 文字內容。
function __newObjFile(headerNote) {
  const verts = [];
  const groups = [];
  const materials = new Map();
  function materialFor(color) {
    const name = color === 'acc' ? 'mat_ACCENT' : color === 'guide' ? 'mat_GUIDE' : color === 'marker' ? 'mat_MARKER' : 'mat_' + color.slice(1);
    if (!materials.has(name)) {
      materials.set(name, color === 'acc' ? [1, 0.55, 0.15] : color === 'guide' ? [0.2, 0.2, 0.24] : color === 'marker' ? [0.9, 0.05, 0.05] : __hexToRgb(color));
    }
    return name;
  }
  function addBox(name, x0, x1, y0, y1, z0, z1, color, offsetX) {
    const a = Math.min(x0, x1) + offsetX, b = Math.max(x0, x1) + offsetX;
    const c = Math.min(y0, y1), d = Math.max(y0, y1);
    const e = Math.min(z0, z1), f = Math.max(z0, z1);
    const base = verts.length;
    [[a, c, e], [b, c, e], [b, c, f], [a, c, f], [a, d, e], [b, d, e], [b, d, f], [a, d, f]].forEach(p => verts.push(p));
    const faces = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]].map(f2 => f2.map(i => base + i + 1));
    groups.push({ name, faces, material: materialFor(color) });
  }
  function build(baseName) {
    let obj = `# 攤位 2.5D 模型 — 由網頁「匯出 OBJ」按鈕產生，來源 99_website/stall_models/js/*.js\n`
      + `# ${headerNote}\n`
      + `# 座標：1 單位=1 公尺，X=沿店面寬度(含插槽位移)、Z=垂直店面方向(0=街道側)、Y=高度(Y-up)。\n`
      + `# group 命名／新增造型規則見 99_website/tools/README.md，改完用 tools/import_stall_models.js 讀回來。\n`
      + `mtllib ${baseName}.mtl\n`;
    verts.forEach(v => { obj += `v ${v[0]} ${v[1]} ${v[2]}\n`; });
    for (const g of groups) {
      obj += `g ${g.name}\nusemtl ${g.material}\n`;
      g.faces.forEach(f => { obj += `f ${f.join(' ')}\n`; });
    }
    let mtl = `# ${baseName}.mtl — 由網頁「匯出 OBJ」按鈕產生\n`;
    for (const [name, rgb] of materials) mtl += `newmtl ${name}\nKd ${rgb[0].toFixed(3)} ${rgb[1].toFixed(3)} ${rgb[2].toFixed(3)}\n`;
    return { obj, mtl, groupCount: groups.length };
  }
  return { addBox, build };
}

// 組出所有 OBJ／MTL 檔案內容：{ closed:{obj,mtl}, semi:{...}, cart:{...}, overrides:{...} }。跟
// tools/export_stall_models.js 輸出的格式相容（同一套 group 命名規則，import_stall_models.js 讀哪一份
// 都可以）。ev()／shopFront()／World／STALL_COLOR／STALL_MODELS／STALL_MODEL_OVERRIDES 都是主要
// <script> 區塊（index.html 這個檔案自己）定義的全域，這個檔案雖然先載入，但這個函式要等按鈕按下才會
// 真的執行，那時候全域早就都有了，順序沒問題。
function buildStallObjFiles() {
  const files = {};

  for (const type of Object.keys(STALL_MODELS)) {
    const f = __newObjFile(`造型類型「${type}」，示範尺寸 W=${STALL_MODELS[type].demoSize.W}m D=${STALL_MODELS[type].demoSize.D}m`);
    const m = STALL_MODELS[type], { W, D } = m.demoSize;
    m.pieces.forEach(p => f.addBox(p.name, ev(p.u0, W, D), ev(p.u1, W, D), p.h0, p.h1, ev(p.d0, W, D), ev(p.d1, W, D), p.color, 0));
    if (m.repeatAlongU) m.repeatAlongU.template.forEach(p => f.addBox(`tile_${p.name}`, p.u0, p.u1, p.h0, p.h1, p.d0, p.d1, p.color, 0));
    f.addBox('frontMarker', 0, 0.3, 0, 0.3, 0, 0.3, 'marker', 0);
    files[type] = f.build(type);
  }

  const offsetOf = __buildShopSlotOffsets();
  const ovFile = __newObjFile('個別店鋪的獨立造型＋每家店鋪的地板 guide，見 tools/README.md「每家店鋪的插槽」');
  for (const sh of World.shops) {
    const front = shopFront(sh);
    const colSpan = sh.maxCol - sh.minCol + 1, rowSpan = sh.maxRow - sh.minRow + 1;
    const W = (front === 'S' || front === 'N') ? colSpan : rowSpan;
    const D = (front === 'S' || front === 'N') ? rowSpan : colSpan;
    const off = offsetOf[sh.code];
    ovFile.addBox(`shop${sh.code}_floorGuide`, 0, W, 0, 0.02, 0, D, 'guide', off);
    ovFile.addBox(`shop${sh.code}_frontMarker`, 0, 0.3, 0, 0.3, 0, 0.3, 'marker', off);
    const ov = STALL_MODEL_OVERRIDES[sh.code];
    if (ov) ov.pieces.forEach(p => ovFile.addBox(`shop${sh.code}_${p.name}`, p.u0, p.u1, p.h0, p.h1, p.d0, p.d1, p.color, off));
  }
  files.overrides = ovFile.build('overrides');

  return files;
}

// 同一天同名再匯出不覆寫，v 號自動 +1（跟 tools/export_stall_models.js 的 nextVersionedFolderName() 同一套
// 規則）——用 FileSystemDirectoryHandle 的非同步列舉找出已存在的 `${today}_${name}_v*` 子資料夾。
async function __nextVersionedFolderName(dirHandle, name) {
  const prefix = `${__dateStamp()}_${name}_v`;
  let maxV = 0;
  for await (const key of dirHandle.keys()) {
    if (!key.startsWith(prefix)) continue;
    const v = parseInt(key.slice(prefix.length), 10);
    if (!isNaN(v)) maxV = Math.max(maxV, v);
  }
  return `${prefix}${maxV + 1}`;
}

// 寫到磁碟：第一次呼叫會跳出資料夾選擇視窗，請選 99_website/stall_models/obj/ 這個資料夾（跟終端機腳本
// 輸出同一個地方），之後同一頁面 session 內重複按按鈕不會再跳。回傳寫入的相對路徑字串（給狀態列顯示）。
// 使用者取消選擇資料夾會拋 AbortError，呼叫端自己判斷要不要當成「取消」而不是「失敗」。
async function exportStallModelsToDisk(name) {
  if (!window.showDirectoryPicker) throw new Error('此瀏覽器不支援 File System Access API，請改用終端機執行 node tools/export_stall_models.js（見 tools/README.md）');
  if (!__objDirHandle) {
    __objDirHandle = await window.showDirectoryPicker({ mode: 'readwrite' }); // 請選 99_website/stall_models/obj
  }
  const folderName = await __nextVersionedFolderName(__objDirHandle, name);
  const subDir = await __objDirHandle.getDirectoryHandle(folderName, { create: true });
  const files = buildStallObjFiles();
  for (const [baseName, { obj, mtl }] of Object.entries(files)) {
    for (const [fname, content] of [[`${baseName}.obj`, obj], [`${baseName}.mtl`, mtl]]) {
      const fh = await subDir.getFileHandle(fname, { create: true });
      const w = await fh.createWritable();
      await w.write(content);
      await w.close();
    }
  }
  return `stall_models/obj/${folderName}/`;
}
