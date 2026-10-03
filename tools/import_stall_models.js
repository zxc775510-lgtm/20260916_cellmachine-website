#!/usr/bin/env node
// 讀回從建模軟體編輯過、重新匯出的 OBJ+MTL 資料夾，覆寫 99_website/stall_models/js/*.js（一個造型類型
// 一個檔案，見該資料夾的 README.md）。資料夾裡**一個造型類型一個 .obj 檔**（例如 closed.obj／semi.obj／
// cart.obj）＋一個 overrides.obj（所有真實店鋪的 floor guide／個別店鋪造型覆寫），對應
// export_stall_models.js 的輸出格式。
//
// 支援三種操作，同一次 import 可以混著做：
// ① 改某個 <type>.obj 裡既有 group 的造型/位置/顏色
// ② 在 <type>.obj 或 overrides.obj 裡新增一個從沒出現過的 group（分別變成該類型的新 piece／某家店鋪的
//    新造型覆寫 piece）
// ③ 新增一個檔案名字從沒出現過的 <newtype>.obj（例如複製 semi.obj 改名成 kiosk.obj 再編輯），變成一個
//    全新的造型類型，自動產生 stall_models/js/<newtype>.js＋自動在 index.html 補上對應 <script> 標籤。
//
// 用法：node import_stall_models.js [OBJ 資料夾路徑]——沒給的話自動找 stall_models/obj/ 底下最新的資料夾。
"use strict";
const fs = require("fs");
const path = require("path");
const { loadStallData, saveStallData, toFormula, loadShopsFromGrid, buildShopSlots, matchSlot, ensureStallModelScriptTag, findLatestObjFolder } = require("./stallGeometryShared");

const objDir = process.argv[2] ? path.resolve(process.argv[2]) : findLatestObjFolder();
if (!objDir) { console.error("stall_models/obj/ 底下沒有任何匯出過的資料夾，先跑 node export_stall_models.js，或直接指定資料夾路徑"); process.exit(1); }
if (!fs.existsSync(objDir) || !fs.statSync(objDir).isDirectory()) { console.error("找不到資料夾：" + objDir); process.exit(1); }

// ---- 讀單一 .obj + 同名 .mtl，回傳 {verts, groupsByName}（v/g/o/usemtl/f 解析，g/o 兩種寫法都認——
// 新版 Blender 預設匯出寫 `o 物件名`，不是舊版的 `g 群組名`） ----
function parseObjFile(objPath) {
  const mtlPath = objPath.replace(/\.obj$/i, ".mtl");
  const colorOf = {};
  if (fs.existsSync(mtlPath)) {
    let cur = null;
    for (const line of fs.readFileSync(mtlPath, "utf8").split("\n")) {
      const t = line.trim();
      if (t.startsWith("newmtl ")) cur = t.slice(7).trim();
      else if (t.startsWith("Kd ") && cur) {
        const [r, g, b] = t.slice(3).trim().split(/\s+/).map(Number);
        colorOf[cur] = cur === "mat_ACCENT" ? "acc" : "#" + [r, g, b].map(v => Math.round(v * 255).toString(16).padStart(2, "0")).join("");
      }
    }
  }
  const verts = [];
  const groupsByName = new Map(); // name -> { indices:Set, material }
  let curGroup = null;
  for (const line of fs.readFileSync(objPath, "utf8").split("\n")) {
    const t = line.trim();
    if (t.startsWith("v ")) { verts.push(t.slice(2).trim().split(/\s+/).map(Number)); }
    else if (t.startsWith("g ") || t.startsWith("o ")) { const name = t.slice(2).trim(); curGroup = groupsByName.get(name) || { indices: new Set(), material: null }; groupsByName.set(name, curGroup); }
    else if (t.startsWith("usemtl ") && curGroup) { curGroup.material = t.slice(7).trim(); }
    else if (t.startsWith("f ") && curGroup) { t.slice(2).trim().split(/\s+/).forEach(tok => curGroup.indices.add(parseInt(tok.split("/")[0], 10))); }
  }
  return { verts, groupsByName, colorOf };
}

function aabb(verts, indices) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const i of indices) {
    const [x, y, z] = verts[i - 1];
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
  }
  return { x0, x1, y0, y1, z0, z1 };
}
function colorFor(colorOf, g, fallback) { return (g.material && colorOf[g.material]) || fallback; }
function round2(n) { return Math.round(n * 100) / 100; }

const { models, overrides } = loadStallData();
const shops = loadShopsFromGrid();
const { offsetOf: shopOffsetOf, codes: shopCodes } = buildShopSlots(shops);

let updated = 0, added = 0, newOverrideShops = 0, missing = 0;
const newTypeNames = [];

// ============================================================
// overrides.obj：shop<code>_<piece> / shop<code>_floorGuide(跳過) / shop<code>_frontMarker(跳過)
// ============================================================
const overridesObjPath = path.join(objDir, "overrides.obj");
if (fs.existsSync(overridesObjPath)) {
  const { verts, groupsByName, colorOf } = parseObjFile(overridesObjPath);
  const consumed = new Set();

  for (const code of Object.keys(overrides)) {
    overrides[code].pieces = overrides[code].pieces.map(p => {
      const gname = `shop${code}_${p.name}`, g = groupsByName.get(gname);
      if (!g) { missing++; console.warn(`[missing] overrides.obj 裡找不到 ${gname}，沿用舊資料`); return p; }
      consumed.add(gname);
      const b = aabb(verts, g.indices), off = shopOffsetOf[code] || 0;
      updated++;
      return {
        name: p.name,
        u0: round2(b.x0 - off), u1: round2(b.x1 - off), d0: round2(b.z0), d1: round2(b.z1),
        h0: round2(b.y0), h1: round2(b.y1), color: colorFor(colorOf, g, p.color),
      };
    });
  }

  for (const [gname, g] of groupsByName) {
    if (consumed.has(gname) || gname.endsWith("_floorGuide") || gname.endsWith("_frontMarker")) continue;
    const m = matchSlot(gname, shopCodes.map(c => "shop" + c));
    if (!m) { console.warn(`[unknown] overrides.obj 的 ${gname} 不是任何已知店鋪插槽底下的 group，略過`); continue; }
    const code = m.prefix.slice(4), off = shopOffsetOf[code] || 0;
    const b = aabb(verts, g.indices);
    if (!overrides[code]) { overrides[code] = { pieces: [] }; newOverrideShops++; }
    overrides[code].pieces.push({
      name: m.rest,
      u0: round2(b.x0 - off), u1: round2(b.x1 - off), d0: round2(b.z0), d1: round2(b.z1),
      h0: round2(b.y0), h1: round2(b.y1), color: colorFor(colorOf, g, "#888888"),
    });
    added++;
    console.log(`[added] overrides.obj 的 ${gname} → 新增店鋪「${code}」的獨立造型 piece「${m.rest}」`);
  }
} else {
  console.warn(`找不到 ${overridesObjPath}，店鋪覆寫（STALL_MODEL_OVERRIDES）維持不動`);
}

// ============================================================
// 每個 <type>.obj：group 名字直接是 piece 名字（不用前綴，檔案本身就是類型），tile_<piece> 是
// repeatAlongU 模板，frontMarker 跳過。檔名不在現有 models 裡＝全新造型類型。
// ============================================================
const objFiles = fs.readdirSync(objDir).filter(f => f.endsWith(".obj") && f !== "overrides.obj");
for (const file of objFiles) {
  const type = file.slice(0, -4);
  const { verts, groupsByName, colorOf } = parseObjFile(path.join(objDir, file));
  const isNewType = !models[type];
  if (isNewType) { models[type] = { demoSize: { W: 4, D: 3 }, pieces: [] }; newTypeNames.push(type); console.log(`[new type] 「${file}」不是既有類型，建立全新造型類型「${type}」（示範尺寸 4m×3m）`); }
  const { W, D } = models[type].demoSize;
  const consumed = new Set();

  models[type].pieces = models[type].pieces.map(p => {
    const g = groupsByName.get(p.name);
    if (!g) { missing++; console.warn(`[missing] ${file} 裡找不到 ${p.name}，沿用舊資料`); return p; }
    consumed.add(p.name);
    const b = aabb(verts, g.indices);
    updated++;
    return {
      name: p.name,
      u0: toFormula(b.x0, W, "W"), u1: toFormula(b.x1, W, "W"),
      d0: toFormula(b.z0, D, "D"), d1: toFormula(b.z1, D, "D"),
      h0: round2(b.y0), h1: round2(b.y1), color: colorFor(colorOf, g, p.color),
    };
  });
  if (models[type].repeatAlongU) {
    models[type].repeatAlongU.template = models[type].repeatAlongU.template.map(p => {
      const gname = `tile_${p.name}`, g = groupsByName.get(gname);
      if (!g) { missing++; console.warn(`[missing] ${file} 裡找不到 ${gname}，沿用舊資料`); return p; }
      consumed.add(gname);
      const b = aabb(verts, g.indices);
      updated++;
      return { name: p.name, u0: round2(b.x0), u1: round2(b.x1), d0: round2(b.z0), d1: round2(b.z1), h0: round2(b.y0), h1: round2(b.y1), color: colorFor(colorOf, g, p.color) };
    });
  }

  for (const [gname, g] of groupsByName) {
    if (consumed.has(gname) || gname === "frontMarker") continue;
    const b = aabb(verts, g.indices);
    if (gname.startsWith("tile_")) {
      const name = gname.slice(5);
      if (!models[type].repeatAlongU) { models[type].repeatAlongU = { spacing: 2.5, template: [] }; console.warn(`[new] ${type} 原本沒有 repeatAlongU，補一個預設 spacing=2.5m，要改請直接編輯 stall_models/js/${type}.js`); }
      models[type].repeatAlongU.template.push({ name, u0: round2(b.x0), u1: round2(b.x1), d0: round2(b.z0), d1: round2(b.z1), h0: round2(b.y0), h1: round2(b.y1), color: colorFor(colorOf, g, "#888888") });
    } else {
      models[type].pieces.push({
        name: gname,
        u0: toFormula(b.x0, W, "W"), u1: toFormula(b.x1, W, "W"),
        d0: toFormula(b.z0, D, "D"), d1: toFormula(b.z1, D, "D"),
        h0: round2(b.y0), h1: round2(b.y1), color: colorFor(colorOf, g, "#888888"),
      });
    }
    added++;
    console.log(`[added] ${file} 的 ${gname} → 新增到 ${type} 的 piece「${gname}」`);
  }
}

saveStallData(models, overrides);
for (const type of newTypeNames) {
  if (ensureStallModelScriptTag(type)) console.log(`[index.html] 已自動補上 <script src="stall_models/js/${type}.js"> 標籤`);
}
console.log(`已覆寫 99_website/stall_models/js/*.js（來源：${objDir}）：更新 ${updated} 個 piece，新增 ${added} 個 piece（含 ${newTypeNames.length} 個全新造型類型、${newOverrideShops} 家新增獨立造型的店鋪），${missing} 個找不到（沿用舊值）。`);
if (newTypeNames.length) console.log(`新造型類型還沒套用到任何店鋪，去 index.html 的 STALL_STRUCTURE 指定要給哪些店鋪用：${newTypeNames.join("、")}`);
