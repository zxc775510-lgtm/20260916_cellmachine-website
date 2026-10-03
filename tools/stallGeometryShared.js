// 共用小工具，export/import 兩支腳本都要用，跟 index.html 的 ev()/drawIsoShop() 用同一套公式語法／
// shopFront() 朝向判定（見 99_website/stall_models/README.md）。只用 Node 內建能力，不需要任何套件。
"use strict";
const fs = require("fs");
const path = require("path");

// 一個造型類型一個檔案（99_website/stall_models/js/<type>.js，見 stall_models/README.md），overrides.js
// 單獨存個別店鋪的獨立造型。loadStallData() 把資料夾內所有檔案串成一份程式碼一次性求值，靠各檔案的
// `var STALL_MODELS = STALL_MODELS || {}` 寫法安全合併（var 允許重複宣告，const 不行）。
// stall_models/obj/ 放匯出的 OBJ／MTL，每次匯出各自一個 `YYYYMMDD_<name>` 資料夾（見 dateStamp()），
// 跟 js/ 分開——js/ 是持續維護、index.html 直接讀的來源，obj/ 是一次性/可重複產生的匯出快照。
const STALL_MODELS_ROOT = path.join(__dirname, "..", "stall_models");
const STALL_MODELS_DIR = path.join(STALL_MODELS_ROOT, "js");
const OBJ_DIR = path.join(STALL_MODELS_ROOT, "obj");
const OVERRIDES_FILE = "overrides.js";
const INDEX_HTML_PATH = path.join(__dirname, "..", "index.html");
const GRID_DATA_PATH = path.join(__dirname, "..", "grid_data.js");

function dateStamp() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

// 同一天同一個 name 匯出第二次以上時，不覆寫也不用問要不要蓋掉，直接照 v1/v2/v3... 排下去（掃現有
// 資料夾裡 `${today}_${name}_v` 開頭、取最大版號 +1；沒有任何一筆就從 v1 開始）。
function nextVersionedFolderName(name) {
  const prefix = `${dateStamp()}_${name}_v`;
  let maxV = 0;
  if (fs.existsSync(OBJ_DIR)) {
    for (const d of fs.readdirSync(OBJ_DIR, { withFileTypes: true })) {
      if (!d.isDirectory() || !d.name.startsWith(prefix)) continue;
      const v = parseInt(d.name.slice(prefix.length), 10);
      if (!isNaN(v)) maxV = Math.max(maxV, v);
    }
  }
  return `${prefix}${maxV + 1}`;
}

// 找 stall_models/obj/ 底下最新的匯出資料夾（依資料夾修改時間，不是名稱字串排序——同一天多次匯出用
// 不同 name 後綴或版號，字串排序不保證新舊），沒有任何匯出過則回傳 null。裡面一個造型類型一個 .obj
// 檔（見 tools/README.md），呼叫端自己 readdir 這個資料夾找要處理哪些檔案。
function findLatestObjFolder() {
  if (!fs.existsSync(OBJ_DIR)) return null;
  const dirs = fs.readdirSync(OBJ_DIR, { withFileTypes: true }).filter(d => d.isDirectory());
  if (dirs.length === 0) return null;
  dirs.sort((a, b) => fs.statSync(path.join(OBJ_DIR, b.name)).mtimeMs - fs.statSync(path.join(OBJ_DIR, a.name)).mtimeMs);
  return path.join(OBJ_DIR, dirs[0].name);
}

function typeFiles() {
  if (!fs.existsSync(STALL_MODELS_DIR)) return [];
  return fs.readdirSync(STALL_MODELS_DIR).filter(f => f.endsWith(".js") && f !== OVERRIDES_FILE).sort();
}

function loadStallData() {
  const overridesPath = path.join(STALL_MODELS_DIR, OVERRIDES_FILE);
  const src = typeFiles().map(f => fs.readFileSync(path.join(STALL_MODELS_DIR, f), "utf8")).join("\n")
    + "\n" + (fs.existsSync(overridesPath) ? fs.readFileSync(overridesPath, "utf8") : "var STALL_MODEL_OVERRIDES = {};");
  return new Function(src + ";return { models: STALL_MODELS, overrides: STALL_MODEL_OVERRIDES }")();
}

function lit(v) { return typeof v === "number" ? v : JSON.stringify(v); }
function pieceStr(p, indent) {
  return `${indent}{ name: ${JSON.stringify(p.name)}, u0: ${lit(p.u0)}, u1: ${lit(p.u1)}, d0: ${lit(p.d0)}, d1: ${lit(p.d1)}, h0: ${lit(p.h0)}, h1: ${lit(p.h1)}, color: ${JSON.stringify(p.color)} },`;
}

// 每個造型類型寫回自己的檔案（99_website/stall_models/<type>.js）；既有檔案的話保留它原本
// `var STALL_MODELS...` 那行以前的說明註解（型別描述、規則來源），只換掉資料本體；全新類型
// （檔案原本不存在，見 import_stall_models.js「新增造型類型」）給一個通用預設註解。
function saveStallData(models, overrides) {
  if (!fs.existsSync(STALL_MODELS_DIR)) fs.mkdirSync(STALL_MODELS_DIR, { recursive: true });
  for (const type of Object.keys(models)) {
    const filePath = path.join(STALL_MODELS_DIR, `${type}.js`);
    const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
    const header = existing.includes("var STALL_MODELS")
      ? existing.split("var STALL_MODELS")[0]
      : `// ${type} — 由建模軟體匯入自動產生，規則來源：99_website/stall_models/README.md。造型描述請自行補在這行。\n`;
    const m = models[type];
    let body = `var STALL_MODELS = STALL_MODELS || {};\nSTALL_MODELS.${type} = {\n  demoSize: { W: ${m.demoSize.W}, D: ${m.demoSize.D} },\n  pieces: [\n${m.pieces.map(p => pieceStr(p, "    ")).join("\n")}\n  ],\n`;
    if (m.repeatAlongU) {
      body += `  repeatAlongU: {\n    spacing: ${m.repeatAlongU.spacing},\n    template: [\n${m.repeatAlongU.template.map(p => pieceStr(p, "      ")).join("\n")}\n    ],\n  },\n`;
    }
    body += `};\n`;
    fs.writeFileSync(filePath, header + body);
  }
  const overrideKeys = Object.keys(overrides);
  const overridesBody = overrideKeys.length === 0 ? "" : overrideKeys.map(code => {
    const o = overrides[code];
    return `  ${JSON.stringify(code)}: {\n    pieces: [\n${o.pieces.map(p => pieceStr(p, "      ")).join("\n")}\n    ],\n  },`;
  }).join("\n");
  fs.writeFileSync(path.join(STALL_MODELS_DIR, OVERRIDES_FILE),
    `// 個別店鋪的獨立造型 — 規則來源：99_website/stall_models/README.md「個別店鋪的獨立造型」。\n`
    + `// key＝店鋪 code（display_code），優先於 STALL_MODELS（見 index.html drawIsoShop()），整組替換、不疊加共用造型。\n`
    + `// 由 tools/export_stall_models.js／import_stall_models.js 維護。\n`
    + `var STALL_MODEL_OVERRIDES = {\n${overridesBody}\n};\n`);
}

// 新造型類型的檔案（stall_models/<type>.js）寫好後，index.html 還要有對應的 <script> 標籤才會被瀏覽器
// 載入——自動幫忙補這一行（插在 overrides.js 那行之前），不用使用者手動編輯 index.html。
// 回傳 true＝有新增，false＝本來就有（不重複加）或找不到錨點（印警告，維持不變）。
function ensureStallModelScriptTag(type) {
  const tag = `<script src="stall_models/js/${type}.js"></script>`;
  const anchor = `<script src="stall_models/js/${OVERRIDES_FILE}"></script>`;
  let html = fs.readFileSync(INDEX_HTML_PATH, "utf8");
  if (html.includes(tag)) return false;
  if (!html.includes(anchor)) { console.warn(`在 index.html 裡找不到 ${anchor}，沒辦法自動加入 ${tag}，請手動加一行`); return false; }
  fs.writeFileSync(INDEX_HTML_PATH, html.replace(anchor, `${tag}\n${anchor}`));
  return true;
}

// 數字或公式字串（可用 W、D）求值，跟 index.html 的 ev() 是同一個邏輯。
function ev(v, W, D) { return typeof v === "number" ? v : new Function("W", "D", "return (" + v + ")")(W, D); }

// 把「絕對公尺數」反推成跟 span（W 或 D）的相對公式，越靠近 0／span／span/2 就用越簡單的寫法——
// 這是啟發式，不是精確反解（一般幾何編輯本來就无法無歧義還原成參數化公式，見 tools/README.md 的限制說明）。
function toFormula(value, span, varName) {
  const r = n => Math.round(n * 100) / 100;
  const dz = Math.abs(value), ds = Math.abs(span - value), dh = Math.abs(span / 2 - value);
  if (dz <= ds && dz <= dh) return r(value);
  if (ds <= dh) { const d = r(span - value); return d === 0 ? varName : (d > 0 ? `${varName}-${d}` : `${varName}+${-d}`); }
  const d = r(value - span / 2); return d === 0 ? `${varName}/2` : `${varName}/2${d > 0 ? "+" : ""}${d}`;
}

// 讀 grid_data.js，依 code 分組算每家店鋪的 bounding box／朝街方向(front)／店面寬深(W/D)——
// 跟 index.html 的 computeStallGroups()＋shopFront()＋drawIsoShop() 的 W/D 算法對齊，供匯出畫 floor guide、
// 匯入換算新增的「單一店鋪造型」用（見 tools/README.md）。純讀取，不改地圖資料本身。
function loadShopsFromGrid() {
  const GRID_DATA = new Function(fs.readFileSync(GRID_DATA_PATH, "utf8") + ";return GRID_DATA")();
  const ROWS = GRID_DATA.gridRows, COLS = GRID_DATA.gridCols, cells = GRID_DATA.cells;
  const isAisleOrEntry = (r, c) => {
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return false;
    const v = cells[r][c];
    return v === "aisle" || v === "entry";
  };
  const shops = {};
  for (const idStr of Object.keys(GRID_DATA.stalls)) {
    const s = GRID_DATA.stalls[idStr];
    const g = shops[s.code] || (shops[s.code] = { code: s.code, minRow: s.row, maxRow: s.row, minCol: s.col, maxCol: s.col });
    g.minRow = Math.min(g.minRow, s.row); g.maxRow = Math.max(g.maxRow, s.row);
    g.minCol = Math.min(g.minCol, s.col); g.maxCol = Math.max(g.maxCol, s.col);
  }
  for (const code of Object.keys(shops)) {
    const g = shops[code];
    const n = { N: 0, S: 0, W: 0, E: 0 };
    for (let c = g.minCol; c <= g.maxCol; c++) { if (isAisleOrEntry(g.minRow - 1, c)) n.N++; if (isAisleOrEntry(g.maxRow + 1, c)) n.S++; }
    for (let r = g.minRow; r <= g.maxRow; r++) { if (isAisleOrEntry(r, g.minCol - 1)) n.W++; if (isAisleOrEntry(r, g.maxCol + 1)) n.E++; }
    const front = ["S", "E", "N", "W"].reduce((b, k) => n[k] > n[b] ? k : b, "S");
    const colSpan = g.maxCol - g.minCol + 1, rowSpan = g.maxRow - g.minRow + 1;
    g.front = front;
    g.W = (front === "S" || front === "N") ? colSpan : rowSpan;
    g.D = (front === "S" || front === "N") ? rowSpan : colSpan;
  }
  return shops; // { code: {code,minRow,maxRow,minCol,maxCol,front,W,D} }
}

// 排版用的「插槽」清單：一個 OBJ 檔（overrides.obj）裡塞了所有真實店鋪的 floor guide／覆寫造型，每家
// 店鋪各佔一段沿 X 軸排開的插槽（見 tools/README.md「排版與插槽」），避免全部疊在原點——跟
// stall_models/js/ 的實際資料無關，import 只是靠它反推「這個 group 屬於哪家店鋪、要扣掉多少位移」。
// 各造型類型現在各自一個檔案（見 tools/README.md「一個類型一個檔案」），檔案裡只有那個類型自己的東西，
// 不用插槽、位移固定是 0。
// export/import 兩支腳本都要呼叫這個函式、且要在「套用這次匯入結果之前」的舊資料上呼叫，插槽順序才會
// 跟匯出時一致（新增的店鋪覆寫沒有插槽，位移＝0）。
const SLOT_SPACING = 15; // 公尺，比目前看過最大的店鋪（C，3×7m）還寬，足夠不重疊
function buildShopSlots(shops) {
  const codes = Object.keys(shops).sort();
  const offsetOf = {};
  codes.forEach((c, i) => { offsetOf[c] = i * SLOT_SPACING; });
  return { offsetOf, codes, SLOT_SPACING };
}

// 依「最長前綴優先」比對 group 名稱屬於哪個插槽，回傳 {prefix, rest}（rest＝扣掉 "<prefix>_" 後剩下的部分）
// 或 null（沒對到任何已知前綴）。overrides.obj 專用（比對 shop code），型別檔案不需要這個——見上面說明。
function matchSlot(name, prefixes) {
  let best = null;
  for (const p of prefixes) {
    if (name.startsWith(p + "_") && (!best || p.length > best.length)) best = p;
  }
  return best ? { prefix: best, rest: name.slice(best.length + 1) } : null;
}

module.exports = { loadStallData, saveStallData, ev, toFormula, loadShopsFromGrid, buildShopSlots, matchSlot, ensureStallModelScriptTag, dateStamp, nextVersionedFolderName, findLatestObjFolder, STALL_MODELS_DIR, OBJ_DIR };
