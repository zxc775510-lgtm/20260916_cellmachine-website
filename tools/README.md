# 攤位 2.5D 模型 — 建模軟體 round-trip

`99_website/stall_models/js/`（一個造型類型一個檔案，見該資料夾的 `README.md`）定義攤位的方塊造型：
`STALL_MODELS`（共用造型類型，依 `structure` 分組，見 `index.html` 的 `STALL_STRUCTURE`）＋
`STALL_MODEL_OVERRIDES`（個別店鋪的獨立造型，優先於共用造型）。`index.html` 的 `drawIsoShop()` 讀這份
資料畫 ISO 畫面。這裡的工具讓你把造型匯出成 OBJ，拿去 Blender／SketchUp／Rhino 等建模軟體**改造型、幫
某家店鋪加專屬造型、甚至新增全新的造型類型**，改完再匯入回來覆寫 `stall_models/js/` 底下的檔案，不用碰
程式碼。

## 用法（終端機）

```bash
cd 99_website/tools
node export_stall_models.js [name]  # 預設 name=export
node import_stall_models.js         # 沒給路徑就自動抓 obj/ 底下最新匯出的那個資料夾
```

匯出會產生 `stall_models/obj/YYYYMMDD_<name>_v<N>/` 資料夾，裡面**一個造型類型一個 .obj 檔**（例如
`closed.obj`／`semi.obj`／`cart.obj`）＋一個 `overrides.obj`（所有真實店鋪的 floor guide／既有的個別
店鋪造型覆寫）——跟 `stall_models/js/` 的檔案配置直接對齊，一個類型一個檔案，方便你在建模軟體裡只開
你想改的那個類型，不用面對塞了所有東西的一大包。

用建模軟體開你要改的那個 `.obj`（同資料夾的 `.mtl` 會自動一起讀進來），改完存回**同一個資料夾、同樣
檔名**（覆蓋原本的），再跑 `import_stall_models.js`。

## 版本（v1／v2／...）

同一天用同一個 `name` 再匯出一次，**不會覆蓋**，資料夾名稱自動加版號：第一次是 `_v1`，第二次
`_v2`，以此類推（`node export_stall_models.js` 跟網頁「匯出 OBJ」按鈕都是同一套規則）。想覆蓋舊的
就直接把建模軟體存檔的位置指到同一個資料夾即可，這支腳本本身永遠只新增、不刪除。

匯入完重新整理網頁（靜態頁，見專案 `CLAUDE.md`：QGIS 那邊改完要重跑腳本＋重新整理網頁，這裡同理）
就會看到新造型套用在 ISO 畫面上。新增造型類型時，import 腳本會自動在 `stall_models/js/` 底下建新檔案、
自動在 `index.html` 補上對應的 `<script>` 標籤——但還要另外指定哪些店鋪用它才會出現，見下面
「新增全新的造型類型」。

## GUI 匯出按鈕

launcher.pyw（`99_gui_launcher/`）的「攤位模型」選單，以及網頁控制面板同名選單，都有「匯出 OBJ」按鈕，
效果等同 `node export_stall_models.js [name]`：

- **launcher.pyw 版**：直接呼叫 Node，沒有瀏覽器限制，桌面程式本來就有檔案系統權限。
- **網頁版**（`99_website/stall_models/exportObj.js` 的 `exportStallModelsToDisk()`）：用 File System
  Access API 直接在瀏覽器寫檔，讀的是頁面當下跑著的 `World.shops`/`STALL_MODELS`/
  `STALL_MODEL_OVERRIDES`（保證跟畫面一致）。**只支援 Chrome/Edge**（Firefox/Safari 不支援，按下去會
  顯示錯誤，改用 launcher.pyw 版或終端機指令即可）。第一次按會跳出資料夾選擇視窗，選
  `99_website/stall_models/obj/`，同一個分頁 session 內之後不會重複跳出來。
  跟 Node 版是各自獨立的實作（這個專案沒有 bundler，瀏覽器/Node 沒辦法共用同一份程式碼），輸出的 OBJ
  格式相容，`import_stall_models.js` 兩邊產生的檔案都認得。
- **匯入沒有對應的 GUI 按鈕**：匯入是要改寫 `stall_models/js/` 底下、頁面自己載入的來源檔案，在頁面
  跑著的當下讓它自己改寫自己來源的意義不大（改完還是要重新整理才生效），維持終端機／launcher.pyw 操作。

## 座標系統

- 1 單位 = 1 公尺。
- **X** = u，沿店鋪店面寬度方向。型別檔案（`closed.obj` 等）裡每個 group 直接是這個類型自己的一個
  piece，offset 固定 0；`overrides.obj` 裡每家店鋪各佔一段獨立的 X 區間（見下方「每家店鋪的插槽」）。
- **Z** = d，垂直店面方向，**0 = 街道／走道那一側，越大越往店鋪內部**。
- **Y** = h，絕對高度（公尺，Y-up），不隨店鋪大小縮放。
- 顏色：`acc` 這個特殊值代表「畫的時候依店鋪當下營業狀態變色」（`STALL_COLOR`，見
  `simulator_setting.md`），匯出成 OBJ 時對應材質 `mat_ACCENT`（示意的橘色，不是最終顏色）。
  其餘 group 的顏色就是實際色碼，材質名是 `mat_<不含#的hex碼>`。

## 每家店鋪的插槽（僅 overrides.obj）

`overrides.obj` 塞了所有真實店鋪的資料，每家店鋪各佔一段沿 X 軸排開的「插槽」（間距 15m），避免全部
疊在原點看不清楚——這只是匯出時的排版方便，跟 `stall_models/js/` 的實際資料無關，import 會自動扣掉
這個位移換算回本地座標。每家店鋪的插槽裡固定有兩個「視覺參考、不是真的幾何資料」的輔助物件，import
會直接忽略（不管有沒有動過都不會被讀進資料）：

- `shop<code>_floorGuide`：那家店鋪**真實**的 footprint 大小（灰色薄板），給你在上面搭造型的比例參考。
- `shop<code>_frontMarker`：紅色小方塊，標記 `u=0,d=0` 的街角，方便辨認哪個方向朝街。

型別檔案（`closed.obj`／`semi.obj`／`cart.obj`／...）裡也有一個 `frontMarker`（同樣紅色小方塊，同樣的
用途），但因為型別檔案只有一個插槽（offset=0），不用管位移。

## 三種操作

### 1. 改既有造型（closed／semi／cart）

開對應的 `<type>.obj`，直接搬動/縮放/改色既有 group（例如 `closed.obj` 裡的 `door`）。**不要重新命名
group**，import 靠名字對應回 `stall_models/js/<type>.js` 的 piece，改名字會被當成「新增的 piece」處理
（見下一節），不是「更新」。

靜態 piece（`closed`/`semi`）的座標會從「匯出時用的示範尺寸」（`demoSize`，見各類型檔案裡的欄位，例如
`closed`/`semi` 是 4m×3m）反推回跟 `W`/`D` 的相對公式（例如 `"W-0.1"`），是**啟發式**（越靠近 0／滿版
／置中，就換算成越簡單的公式），不是精確反解——因為同一份造型要套用到大小不一的好幾家店鋪，公式才是
真正被存起來、被 `drawIsoShop()` 用的東西，OBJ 裡的具體公尺數只是換算的中介值。改完看一下
`stall_models/js/<type>.js` 印出來的公式合不合理，數值本身一定是對的，公式寫法不合理就手動微調（不用
重跑 export/import，改完存檔、重新整理網頁即可）。`cart` 的桌子（`tile_*`）是重複排列的模板，見下面
「repeatAlongU」，座標直接是絕對公尺，不用公式換算。

### 2. 幫某家店鋪加專屬造型（每一家可以長得不一樣）

開 `overrides.obj`，在該店鋪的插槽裡（`floorGuide` 旁邊）新增 group，命名 `shop<code>_<你取的名字>`
（`<code>` 是圖例/地圖上看到的店鋪編號，例如 `shop V_umbrella`要寫成 `shopV_umbrella`，中間不能有
空格）。跑 import 後會寫進 `stall_models/js/overrides.js` 的 `STALL_MODEL_OVERRIDES[code]`，**這家店鋪
從此完全改用你畫的造型，不再套用 `STALL_STRUCTURE` 指定的共用類型**（例如 V 本來是 `cart`，加了覆寫
之後 V 的桌子就不會再出現，只會顯示你畫的東西——如果想「在桌子之外多加一把傘」，要把桌子的造型也一起
複製進這個店鋪的覆寫裡，覆寫是整組替換，不是疊加）。座標一律絕對公尺（這家店鋪自己的 u/d/h，不用
公式，因為只有這一家在用）。要幫已經有覆寫的店鋪再加一個 piece，一樣在它的插槽裡新增 group 即可，
import 會自動認得是「幫這家店加新 piece」還是「這家店第一次加覆寫」。

### 3. 新增全新的造型類型

複製一份現有的 `.obj`（例如 `semi.obj`），**改檔名**（例如改成 `kiosk.obj`，`.mtl` 也一起複製改名），
用建模軟體開，改造型（座標不用管插槽/位移，直接照上面「座標系統」的 u/d/h 慣例編輯就好：X=u 從 0
開始、Z=d 街道側=0、Y=h=0 是地面）。import 看到一個檔名不在現有類型清單裡的 `.obj`，會：

1. 在 `stall_models/js/` 底下自動建一個新檔案 `<新類型名>.js`（`demoSize` 預設 4m×3m，之後可以自己去這
   個檔案手動調整），檔案裡每個 group 都收進去當一個新 piece。
2. 自動在 `index.html` 補上對應的 `<script src="stall_models/js/<新類型名>.js">` 標籤，不用手動加。

**新類型建好後預設沒有任何店鋪在用**，要讓它出現在模擬器裡，去 `index.html` 的 `STALL_STRUCTURE` 把想
套用的店鋪 code 指到這個新類型名字（例如 `H: 'kiosk'`），存檔、重新整理網頁——這一步沒辦法自動化，因為
只有你知道要把新造型套到哪家店。

### repeatAlongU（cart 的桌子）

`cart` 的桌子是「一個模板方塊組，沿店面寬度重複排列，間距/次數由店鋪寬度決定」，不是每家店都存一份
——匯出只給你**一個模板單位**（`cart.obj` 裡的 `tile_*`），改完套用到所有 cart 攤位的每一張桌子。模板
座標直接是絕對公尺（相對重複單位「中心點」的偏移量，例如 `-0.35~0.35`），不用 W/D 公式換算。`spacing`
（桌子間距，公尺）不在 OBJ 幾何裡，這支腳本不會動它；想改間距直接改 `stall_models/js/cart.js` 的
`repeatAlongU.spacing`。新造型類型如果也想要「重複排列」的效果，新建 group 時命名
`tile_<piece名字>`，import 會自動幫它建一個 `repeatAlongU`（預設 spacing=2.5m，之後自己去對應的類型
檔案調）。

## 限制

- 只匯出/匯入方塊（AABB），沒有斜面、圓角、非矩形造型——`isoBox()` 本來就只會畫矩形量體的三個可見
  面（南/東/頂），複雜造型在等角 8-bit 風格下也看不出差異，不值得做。
- 公式反推是啟發式，見上面「改既有造型」——複雜編輯偶爾會猜錯，猜錯了自己去對應的類型檔案微調
  公式寫法即可，這不是精確反解問題，一般幾何編輯本來就無法無歧義還原成參數化公式。
- 新造型類型建好後不會自動套用到任何店鋪，需要手動編輯 `index.html` 的 `STALL_STRUCTURE` 一行。
- 店鋪覆寫是整組替換共用造型，不是疊加——見上面「幫某家店鋪加專屬造型」。
- 網頁版 GUI 匯出按鈕只支援 Chrome/Edge，且不能匯入（見上面「GUI 匯出按鈕」）；launcher.pyw 版沒有
  這個限制。

## 網格烘焙成貼圖（曲面道具，例如網路下載的椅子 OBJ）

方塊（AABB）round-trip（上面各節）處理不了曲面網格。這類道具改走另一條路：離線烘焙成 ISO 貼圖，
執行時只貼圖。這是「造型全程式畫」的唯一例外，見 `simulator_setting.md`「道具貼圖」。

```bash
cd 99_website/tools
node bake_mesh_sprite.js ../stall_models/obj/99_obj_exsample/red_chair.obj chair --colors red=#e53e3e,wood=#b7844a
```

- 輸入：Y-up、公尺的三角網格（`v`／`vn`／`f`，四邊形以上自動切三角）；前方＝+Z；腳下中心自動對齊錨點。
  OBJ 沒有顏色（無 `.mtl` 也行），顏色由 `--colors` 指定，一個顏色一張 sheet。
- 輸出：`stall_models/props/<name>.js`（`PROP_SPRITES.<name>`＝`{ppm,cw,ch,ax,ay,sheets}`，PNG 以 base64
  內嵌），並自動在 `index.html` 補 `<script>`。同名重跑直接覆蓋。四格並排依序是 S/E/N/W 朝向。
- 參數：`--ppm`（每公尺像素，預設 128；ISO 縮放最大 40 px/m，128 已足夠）。
- 用法：分區零件寫 `{ sprite: { name: 'chair', color: 'red', at: [u, d, 0], rot: 0 } }`（`at`＝腳下中心，本地公尺；
  `rot` 選朝向格，預設 0），見 `index.html` 的 `stool()`。
- 自我檢查：任一朝向烘出空圖會直接丟錯（OBJ 讀不到面、座標跑掉）。
- 限制：貼圖整張用中心點排序，椅子塞進桌子底下之類的貼身遮擋可能不對；明暗是依法線主軸分三階，曲面會有
  階梯感（刻意跟 `isoBox` 的 8-bit 風格一致）；`rot` 的 4 個朝向對繞 Y 軸對稱的物件（圓凳）看不出差異。

**GUI 按鈕**：`99_gui_launcher/launcher.pyw`「攤位模型」分頁最下面的「OBJ 烘焙成貼圖」——瀏覽選 OBJ（名稱自動取檔名，
可改）、填顏色（`色名=#hex,...`）、按「烘焙貼圖」，完成後直接在面板顯示每個顏色 4 個朝向的預覽。等同上面的指令。
