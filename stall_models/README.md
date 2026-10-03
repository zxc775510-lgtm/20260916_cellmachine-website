# 攤位 2.5D 模型資料 — 座標系統

這個資料夾分兩半,職責不同,不要混著放:

| 子資料夾 | 內容 | 會不會變動 |
|---|---|---|
| `js/` | `index.html` 直接 `<script src>` 讀的資料來源，**一個造型類型對應一個獨立 js 檔案**（跟 `99_website/agents/*.js` 一個 agent 一個檔案同一個精神，方便單獨改一種造型不用動到其他檔案） | 持續維護，位置固定不動 |
| `obj/` | 匯出給建模軟體編輯用的 OBJ/MTL 快照，每次匯出各自一個 `YYYYMMDD_<name>_v<N>` 資料夾（同一天同名再匯出版號自動 +1，不覆蓋），資料夾裡**一個造型類型一個 .obj 檔**＋一個 `overrides.obj`，跟 `js/` 的檔案配置對齊（見 `tools/README.md`） | 一次性輸出，可重複產生、可刪除 |

`js/` 底下目前這幾個檔案：

| 檔案 | 內容 |
|---|---|
| `js/closed.js` | `structure: 'closed'`（鐵門封閉）的造型 |
| `js/semi.js` | `structure: 'semi'`（半開放，預設值）的造型 |
| `js/cart.js` | `structure: 'cart'`（臨時攤位／移動攤販）的造型 |
| `js/overrides.js` | 個別店鋪的獨立造型（`STALL_MODEL_OVERRIDES`），見下方「個別店鋪的獨立造型」 |

新增造型類型會在 `js/` 底下多一個檔案（例如 `js/kiosk.js`），由 `tools/import_stall_models.js` 自動產生
＋自動在 `index.html` 補上對應的 `<script>` 標籤，見 `tools/README.md`「新增造型類型」，不用手動加檔案。

## 共用寫法（每個類型檔案都一樣）

沒有 bundler/ES module（這專案堅持 file:// 雙擊可開的靜態頁設計），幾個檔案共用同一個全域變數
`STALL_MODELS` 靠 `var`（不是 `const`——`const` 在多個 `<script>` 檔案間重複宣告會直接噴
`SyntaxError`，`var` 才能安全地在每個檔案裡「補一筆到同一個共用物件上」）：

```js
var STALL_MODELS = STALL_MODELS || {};
STALL_MODELS.closed = { demoSize: {...}, pieces: [...] };
```

`index.html` 依序 `<script src="stall_models/js/closed.js">`／`semi.js`／`cart.js`／`overrides.js`／以及
任何新增的類型檔案，載入順序不影響結果（`drawIsoShop()` 是畫面每幀才呼叫，不是載入當下就讀）。

## 座標系統

供 `tools/export_stall_models.js`／`import_stall_models.js`／`index.html` 的 `drawIsoShop()` 共用：

- 每家店鋪有自己的 footprint：寬 `W`（沿店面方向，公尺）× 深 `D`（垂直店面方向，公尺），由
  `World.shops` 的 bounding box 算出來，不同店鋪 `W`/`D` 不同——所以座標不能寫死公尺數，用「跟 `W`/`D`
  的相對關係」表示。
- `u` ∈ 沿店面寬度方向、`d` ∈ 垂直店面方向（`d=0`＝街道／走道那一側，`d=D`＝店鋪後方，離街道最遠）、
  `h`＝絕對高度(公尺)，不隨 `W`/`D` 縮放（人/家具的物理高度不該因為店鋪大小變形）。
- `u0/u1/d0/d1` 每個值可以是「數字」（絕對公尺，例如牆厚 0.1 固定不隨店鋪大小變）或「字串公式」
  （可用變數 `W`、`D`，例如 `"W/2-0.15"` 表示置中，`"W-0.1"` 表示貼右/後緣），算法見 `index.html` 的
  `ev()`。
- `color`：色碼字串，或特殊字串 `'acc'`——代表「依店鋪目前營業狀態變色」（`STALL_COLOR`，blank 用灰），
  不是固定色；匯出成 OBJ 時 `'acc'` 對應材質 `mat_ACCENT`（示意色，實際顏色要看模擬當下的營業狀態）。
- `pieces`：靜態方塊清單，位置/大小相對整個店鋪 footprint，每家店只出現一次。
- `repeatAlongU`：可選，一組沿 `u` 軸重複排列的方塊（例如臨時攤位的桌子），`template` 裡的 `u0/u1` 是
  相對「每個重複單位中心點」的公尺偏移量（不隨 `W`/`D` 縮放），重複幾次、間距多少由 `spacing`（公尺，
  兩個中心點的目標間距）決定，實際次數＝`index.html` 算 `max(1, floor(W/spacing))`，不寫在這份資料裡
  （這是「怎麼排」的邏輯，不是「長什麼樣子」的資料，見 `simulator_setting.md` 攤位 8-bit 模型
  一節）。
- `demoSize`：只給 `tools/export_stall_models.js`／`import_stall_models.js` 用——匯出成 OBJ 時，公式
  （`"W-0.1"` 之類）要換算成具體公尺數才有東西可以畫/量，這個示範尺寸就是換算用的假想店鋪大小，跟任何
  一家真實店鋪的實際大小無關；`index.html` 的 `drawIsoShop()` 完全不讀這個欄位，畫圖永遠用該店鋪自己
  真正的 `W`/`D`。

## 個別店鋪的獨立造型

`js/overrides.js` 的 `STALL_MODEL_OVERRIDES`：key＝店鋪 `code`（`display_code`），優先於
`STALL_MODELS`（見 `index.html` 的 `drawIsoShop()`：`STALL_MODEL_OVERRIDES[sh.code] ||
STALL_MODELS[STALL_STRUCTURE[sh.code]]`）——覆寫的店鋪**整組替換**，不會再套用共用造型，也不會疊加。
座標一律絕對公尺（就這一家店鋪自己的 `u`/`d`/`h` 座標系，不需要 `W`/`D` 公式——只有一家在用，不用跟著
別家的大小縮放），沒有 `repeatAlongU`（單一店鋪不需要「重複排列」）。

## 建模軟體 round-trip

不要手動改 `js/` 底下的檔案（想直接手改也可以，格式照抄現有的就好，只是不會被建模軟體驗證過）——用
`tools/export_stall_models.js`（或 launcher.pyw／網頁控制面板的「匯出 OBJ」按鈕，見 `tools/README.md`
「GUI 匯出按鈕」）產生 `obj/YYYYMMDD_<name>_v<N>/` 底下的 OBJ（一個類型一個檔案）給 Blender/SketchUp/
Rhino 編輯，改完用 `tools/import_stall_models.js` 讀回來覆寫 `js/` 底下對應的檔案。完整操作流程、三種
操作範例（改造型／幫店鋪加專屬造型／新增全新類型）、版本規則、已知限制見 `../tools/README.md`。

## 道具貼圖（`props/`）

`props/<name>.js`：`tools/bake_mesh_sprite.js` 從 OBJ 網格烘焙出的 ISO 貼圖（曲面道具，不是方塊），由腳本自動
產生與在 `index.html` 補 `<script>`，不要手改，見 `../tools/README.md`「網格烘焙成貼圖」。目前：`chair.js`
（`obj/99_obj_exsample/red_chair.obj`）。
