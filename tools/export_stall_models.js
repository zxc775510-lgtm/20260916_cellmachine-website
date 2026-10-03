#!/usr/bin/env node
// 把 99_website/stall_models/js/*.js 匯出成 OBJ+MTL，拿去 Blender/SketchUp/Rhino 等建模軟體編輯造型、
// 新增全新的造型類型、或幫個別店鋪畫獨立造型。輸出到 99_website/stall_models/obj/YYYYMMDD_<name>_v<N>/
// （name 沒給預設 "export"；同一天同名再匯出一次不覆寫，v 號自動 +1，見 tools/README.md「版本」）。
// 資料夾裡**一個造型類型一個 .obj 檔**（跟 stall_models/js/ 的檔案配置對齊），另外一個 overrides.obj
// 放所有真實店鋪的 floor guide／既有的個別店鋪造型覆寫。
// 用法：node export_stall_models.js [name，預設 export]
// 編輯完用 tools/import_stall_models.js 讀回來覆寫 stall_models/js/*.js，完整規則見 tools/README.md。
"use strict";
const fs = require("fs");
const path = require("path");
const { loadStallData, ev, loadShopsFromGrid, buildShopSlots, dateStamp, nextVersionedFolderName, OBJ_DIR } = require("./stallGeometryShared");

const NAME = process.argv[2] || "export";
const folderName = nextVersionedFolderName(NAME);
const outDir = path.join(OBJ_DIR, folderName);
fs.mkdirSync(outDir, { recursive: true });

const { models, overrides } = loadStallData();
const shops = loadShopsFromGrid();
const { offsetOf: shopOffsetOf } = buildShopSlots(shops);

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

// 一個 OBJ「檔案」的內容組合器：每個造型類型呼叫一次（offset=0，因為自己一個檔案，不會跟別人疊在一起），
// overrides.obj 再呼叫一次（帶店鋪插槽位移）。回傳 {obj, mtl}，呼叫端自己寫檔。
function buildFile(headerNote) {
  const verts = [];
  const groups = [];
  const materials = new Map();
  function materialFor(color) {
    const name = color === "acc" ? "mat_ACCENT" : color === "guide" ? "mat_GUIDE" : color === "marker" ? "mat_MARKER" : "mat_" + color.slice(1);
    if (!materials.has(name)) {
      materials.set(name, color === "acc" ? [1, 0.55, 0.15] : color === "guide" ? [0.2, 0.2, 0.24] : color === "marker" ? [0.9, 0.05, 0.05] : hexToRgb(color));
    }
    return name;
  }
  // 一個方塊＝8頂點＋6個四邊形面（不只畫看得到的3面——匯出給建模軟體看，全部面都給，方便旋轉檢視/量體積）。
  // OBJ 座標：X=u+位移（沿店面寬度）、Z=d（0=街道側，越大越往店內）、Y=h（絕對高度，公尺，Y-up）。
  function addBox(name, x0, x1, y0, y1, z0, z1, color, offsetX) {
    const [a, b] = [Math.min(x0, x1) + offsetX, Math.max(x0, x1) + offsetX];
    const [c, d] = [Math.min(y0, y1), Math.max(y0, y1)];
    const [e, f] = [Math.min(z0, z1), Math.max(z0, z1)];
    const base = verts.length;
    [[a, c, e], [b, c, e], [b, c, f], [a, c, f], [a, d, e], [b, d, e], [b, d, f], [a, d, f]].forEach(p => verts.push(p));
    const faces = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]].map(f => f.map(i => base + i + 1));
    groups.push({ name, faces, material: materialFor(color) });
  }
  return { verts, groups, materials, addBox };
}

function writeFile(baseName, headerNote, { verts, groups, materials }) {
  let obj = `# 攤位 2.5D 模型 — 由 export_stall_models.js 自動產生，來源 99_website/stall_models/js/*.js\n`
    + `# ${headerNote}\n`
    + `# 座標：1 單位=1 公尺，X=沿店面寬度(含插槽位移)、Z=垂直店面方向(0=街道側)、Y=高度(Y-up)。\n`
    + `# group 命名／新增造型規則見 99_website/tools/README.md，改完用 import_stall_models.js 讀回來。\n`
    + `mtllib ${baseName}.mtl\n`;
  verts.forEach(v => { obj += `v ${v[0]} ${v[1]} ${v[2]}\n`; });
  for (const g of groups) {
    obj += `g ${g.name}\nusemtl ${g.material}\n`;
    g.faces.forEach(f => { obj += `f ${f.join(" ")}\n`; });
  }
  fs.writeFileSync(path.join(outDir, `${baseName}.obj`), obj);

  let mtl = `# ${baseName}.mtl — 由 export_stall_models.js 自動產生\n`;
  for (const [name, rgb] of materials) mtl += `newmtl ${name}\nKd ${rgb[0].toFixed(3)} ${rgb[1].toFixed(3)} ${rgb[2].toFixed(3)}\n`;
  fs.writeFileSync(path.join(outDir, `${baseName}.mtl`), mtl);
}

// ---- 一個造型類型一個檔案：示範尺寸下的完整造型＋一個街角標記(frontMarker，紅色，u=d=0角)，offset=0 ----
const typeSummaries = [];
for (const type of Object.keys(models)) {
  const f = buildFile();
  const { W, D } = models[type].demoSize, m = models[type];
  m.pieces.forEach(p => f.addBox(p.name, ev(p.u0, W, D), ev(p.u1, W, D), p.h0, p.h1, ev(p.d0, W, D), ev(p.d1, W, D), p.color, 0));
  if (m.repeatAlongU) {
    // 只匯出一個代表性的重複單位（template），編輯完 import 只會更新這個模板，見 tools/README.md「repeatAlongU」。
    m.repeatAlongU.template.forEach(p => f.addBox(`tile_${p.name}`, p.u0, p.u1, p.h0, p.h1, p.d0, p.d1, p.color, 0));
  }
  f.addBox("frontMarker", 0, 0.3, 0, 0.3, 0, 0.3, "marker", 0);
  writeFile(type, `造型類型「${type}」，示範尺寸 W=${models[type].demoSize.W}m D=${models[type].demoSize.D}m`, f);
  typeSummaries.push(`${type}.obj（${f.groups.length} 個 group）`);
}

// ---- overrides.obj：每家真實店鋪的地板 guide（真實 W×D）＋街角標記＋既有的個別造型覆寫（如果有） ----
const overridesFile = buildFile();
for (const code of Object.keys(shops).sort()) {
  const sh = shops[code], off = shopOffsetOf[code];
  overridesFile.addBox(`shop${code}_floorGuide`, 0, sh.W, 0, 0.02, 0, sh.D, "guide", off);
  overridesFile.addBox(`shop${code}_frontMarker`, 0, 0.3, 0, 0.3, 0, 0.3, "marker", off);
  const ov = overrides[code];
  if (ov) ov.pieces.forEach(p => overridesFile.addBox(`shop${code}_${p.name}`, p.u0, p.u1, p.h0, p.h1, p.d0, p.d1, p.color, off));
}
writeFile("overrides", "個別店鋪的獨立造型＋每家店鋪的地板 guide，見 tools/README.md「每家店鋪的插槽」", overridesFile);

console.log(`寫入 stall_models/obj/${folderName}/：${typeSummaries.join("、")}、overrides.obj（${overridesFile.groups.length} 個 group，${Object.keys(shops).length} 家店鋪）`);
console.log(`EXPORTED_TO:stall_models/obj/${folderName}/`); // 機器可讀的最後一行，給 launcher.pyw 解析路徑用，不要移除或改格式
