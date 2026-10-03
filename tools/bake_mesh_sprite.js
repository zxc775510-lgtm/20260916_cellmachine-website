// 把一個 OBJ 網格烘焙成 ISO 貼圖（4 個朝向 S/E/N/W 並排的 sprite sheet，base64 內嵌進 js，無外部圖檔）。
// 規則來源：simulator_setting.md「道具貼圖」；用法與限制見 tools/README.md「網格烘焙成貼圖」。
//   node bake_mesh_sprite.js <obj> <name> [--ppm 128] [--colors red=#e53e3e,wood=#b7844a]
// 輸出 stall_models/props/<name>.js：PROP_SPRITES.<name> = {ppm,cw,ch,ax,ay,sheets:{色名:dataURI}}，並在 index.html 補 <script>。
// 模型座標：Y-up、公尺；前方＝+Z；原點無所謂（腳下中心對齊錨點）。投影跟 isoProject() 同一組公式（x=(c-r)P/2, y=(c+r)P/4-hP/2）。
const fs = require('fs'), path = require('path'), zlib = require('zlib');

const [objFile, name] = process.argv.slice(2);
const opt = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
if (!objFile || !name) { console.error('usage: node bake_mesh_sprite.js <obj> <name> [--ppm 128] [--colors a=#hex,b=#hex]'); process.exit(1); }
const PPM = +opt('ppm', 128), OUTLINE = 3, PAD = 6;
const COLORS = Object.fromEntries(opt('colors', 'red=#e53e3e,wood=#b7844a').split(',').map(s => s.split('=')));
const TONE = { top: 1, south: 0.72, east: 0.52 }; // 同 isoBox() 的三面明暗

// ---- 讀 OBJ（只要 v / vn / f；面一律當三角形扇形展開）----
const V = [], N = [], F = [];
for (const ln of fs.readFileSync(objFile, 'utf8').split(/\r?\n/)) {
  const t = ln.trim().split(/\s+/);
  if (t[0] === 'v') V.push(t.slice(1, 4).map(Number));
  else if (t[0] === 'vn') N.push(t.slice(1, 4).map(Number));
  else if (t[0] === 'f') {
    const ix = t.slice(1).map(s => s.split('/').map(x => x ? +x - 1 : -1)); // [v, vt, vn]
    for (let i = 1; i < ix.length - 1; i++) F.push([ix[0], ix[i], ix[i + 1]]);
  }
}
// 腳下中心置原點：x/z 取 bbox 中心、y 取最低點
const mn = [0, 1, 2].map(k => Math.min(...V.map(v => v[k]))), mx = [0, 1, 2].map(k => Math.max(...V.map(v => v[k])));
const cx = (mn[0] + mx[0]) / 2, cz = (mn[2] + mx[2]) / 2;
// 世界 (r,c,h)：facing 0(S) 前方 +Z→+row、x→col；每多 1 次 (r,c)→(-c,r) 轉 90°
const world = (p, f) => { let r = p[2] - cz, c = p[0] - cx; for (let i = 0; i < f; i++) [r, c] = [-c, r]; return [r, c, p[1] - mn[1]]; };
const proj = ([r, c, h]) => [(c - r) * PPM / 2, (c + r) * PPM / 4 - h * PPM / 2];
const depth = ([r, c, h]) => 0.612 * (r + c) + 0.5 * h; // 視線方向（仰角 30°）上越大越近

// ---- 共同的 cell 尺寸／錨點（4 個朝向取最大範圍）----
let bx0 = 1e9, bx1 = -1e9, by0 = 1e9, by1 = -1e9;
for (let f = 0; f < 4; f++) for (const v of V) { const [x, y] = proj(world(v, f)); bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y); }
const pad = PAD + OUTLINE, cw = Math.ceil(bx1 - bx0) + 2 * pad, ch = Math.ceil(by1 - by0) + 2 * pad, ax = Math.round(pad - bx0), ay = Math.round(pad - by0);

const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
function renderFrame(f, rgb) { // → RGBA Buffer cw×ch
  const col = new Uint8Array(cw * ch * 4), zb = new Float32Array(cw * ch).fill(-1e9);
  for (const tri of F) {
    const w = tri.map(t => world(V[t[0]], f));
    let n = [0, 0, 0]; // 法線取三個頂點 vn 平均（Rhino 輸出朝外）；沒有 vn 就用叉積
    if (tri.every(t => t[2] >= 0)) tri.forEach(t => { const m = N[t[2]]; n = n.map((x, k) => x + m[k]); });
    else { const a = tri.map(t => V[t[0]]), u = [0, 1, 2].map(k => a[1][k] - a[0][k]), v = [0, 1, 2].map(k => a[2][k] - a[0][k]); n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; }
    let [nr, nc, nh] = [n[2], n[0], n[1]]; for (let i = 0; i < f; i++) [nr, nc] = [-nc, nr];
    const best = Math.max(nh, nr, nc);
    const tone = best === nh ? TONE.top : best === nr ? TONE.south : TONE.east;
    const c3 = rgb.map(x => Math.round(x * tone));
    const P = w.map(p => { const [x, y] = proj(p); return [x + ax, y + ay, depth(p)]; });
    const x0 = Math.max(0, Math.floor(Math.min(...P.map(p => p[0])))), x1 = Math.min(cw - 1, Math.ceil(Math.max(...P.map(p => p[0]))));
    const y0 = Math.max(0, Math.floor(Math.min(...P.map(p => p[1])))), y1 = Math.min(ch - 1, Math.ceil(Math.max(...P.map(p => p[1]))));
    const den = (P[1][1] - P[2][1]) * (P[0][0] - P[2][0]) + (P[2][0] - P[1][0]) * (P[0][1] - P[2][1]);
    if (Math.abs(den) < 1e-9) continue;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5;
      const l0 = ((P[1][1] - P[2][1]) * (px - P[2][0]) + (P[2][0] - P[1][0]) * (py - P[2][1])) / den;
      const l1 = ((P[2][1] - P[0][1]) * (px - P[2][0]) + (P[0][0] - P[2][0]) * (py - P[2][1])) / den, l2 = 1 - l0 - l1;
      if (l0 < -1e-4 || l1 < -1e-4 || l2 < -1e-4) continue;
      const z = l0 * P[0][2] + l1 * P[1][2] + l2 * P[2][2], i = y * cw + x;
      if (z <= zb[i]) continue;
      zb[i] = z; col.set([...c3, 255], i * 4);
    }
  }
  // 外輪廓：透明像素距不透明像素 ≤OUTLINE 就塗黑（同 isoBox 的 #0b0d12 黑框）
  const a = i => col[i * 4 + 3], out = Buffer.from(col);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    if (a(y * cw + x)) continue;
    near: for (let dy = -OUTLINE; dy <= OUTLINE; dy++) for (let dx = -OUTLINE; dx <= OUTLINE; dx++) {
      const X = x + dx, Y = y + dy;
      if (X >= 0 && Y >= 0 && X < cw && Y < ch && dx * dx + dy * dy <= OUTLINE * OUTLINE && a(Y * cw + X)) { out.set([11, 13, 18, 255], (y * cw + x) * 4); break near; }
    }
  }
  return out;
}

// ---- PNG 編碼（RGBA 8-bit，內建 zlib，不加依賴）----
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const b = Buffer.concat([Buffer.from(t), d]), o = Buffer.alloc(4); o.writeUInt32BE(d.length); const c = Buffer.alloc(4); c.writeUInt32BE(crc(b)); return Buffer.concat([o, b, c]); };
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const sheets = {};
for (const [cn, h] of Object.entries(COLORS)) {
  const sheet = Buffer.alloc(cw * 4 * ch * 4);
  for (let f = 0; f < 4; f++) {
    const fr = renderFrame(f, hex(h));
    let opaque = 0;
    for (let y = 0; y < ch; y++) { fr.copy(sheet, (y * cw * 4 + f * cw) * 4, y * cw * 4, (y + 1) * cw * 4); }
    for (let i = 3; i < fr.length; i += 4) if (fr[i]) opaque++;
    if (!opaque) throw new Error(`frame ${f} (${cn}) 是空的：OBJ 讀不到面，或座標超出範圍`); // 自我檢查
  }
  sheets[cn] = 'data:image/png;base64,' + png(cw * 4, ch, sheet).toString('base64');
}

const root = path.join(__dirname, '..');
const outDir = path.join(root, 'stall_models', 'props'); fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, name + '.js');
fs.writeFileSync(outFile, `// 由 tools/bake_mesh_sprite.js 從 ${path.basename(objFile)} 烘焙，不要手改（要改就重跑）。四格並排：S/E/N/W 朝向（前方＝椅子面對的方向）。
// 錨點 (ax,ay)＝腳下中心在單格內的像素位置；ppm＝烘焙時每公尺像素數。
var PROP_SPRITES = PROP_SPRITES || {};
PROP_SPRITES.${name} = ${JSON.stringify({ ppm: PPM, cw, ch, ax, ay, sheets })};
`);
const html = path.join(root, 'index.html'), tag = `<script src="stall_models/props/${name}.js"></script>`;
let s = fs.readFileSync(html, 'utf8');
if (!s.includes(tag)) { s = s.replace('<script src="stall_models/js/overrides.js"></script>', m => m + '\n' + tag); fs.writeFileSync(html, s); console.log('index.html 補上 <script>'); }
console.log(`OK ${path.relative(root, outFile)}  cell ${cw}x${ch}  ppm ${PPM}  colors ${Object.keys(COLORS)}  (${(fs.statSync(outFile).size / 1024).toFixed(0)} KB)`);
