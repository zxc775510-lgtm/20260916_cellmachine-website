// Cell（市場網格空間本身）— 規則來源：agent_setting.md「Space Class」
// Space Class 存成陣列：World.cellSpace，跟 World.cellType 一樣是 ROWS×COLS 的 2D 陣列，每一格自己的 Attribute。
// 已實作的 Attribute：corridorFrontage（臨走道／入口的邊數比例）、occupiedBy／mobility（椅子，見下方）、passCost、density、visibility。orientation 尚未實作，見文件 Known Implementation Gaps。
// 判斷邏輯（怎麼用這個數值）不寫在這裡——放在 Vendor (New) 的 Site Fertility Weighting（website/agents/vendorNew.js），Cell 只提供量化值。
const Cell = {
  // 建立 World.cellSpace：只有攤位格（stallslot）算 corridorFrontage，其餘格型（牆/設施/入口/走道）用不到，存 null。
  buildCellSpace() {
    const space = [];
    for (let r = 0; r < World.ROWS; r++) {
      const row = [];
      for (let c = 0; c < World.COLS; c++) {
        const t = World.cellType[r][c];
        // 走道格：occupiedBy＝QGIS 標定「有資格擺椅的店鋪 code」（ERA_DATA，固定不變、不改寫）；椅子是否擺出見下方 chairCount。
        // 攤位格：zone 是桌面／設備 → noEnter（行人不進）；zone 是用餐區 → 自己這家店的椅子（occupiedBy＝[自己的 code]，用餐區一律有椅子）。
        if (t === 'stallslot') {
          const zone = (ERA_DATA.cells[r + ',' + c] || {})['zone_' + this.SIM_ERA];
          row.push({ corridorFrontage: this.frontageOf(r, c), noEnter: this.NO_ENTER_ZONES.includes(zone),
            occupiedBy: zone === '用餐區' ? [World.stallAtRC[r + ',' + c].code] : [] });
        } else row.push(t === 'aisle' ? { occupiedBy: (ERA_DATA.cells[r + ',' + c] || {}).occupiedBy || [] } : null);
      }
      space.push(row);
    }
    return space;
  },

  // Human 的 Passability／Visit Rule 讀的空間資料：模擬用 2026 年的 zone；桌面與設備格客人不進去（站在外面的走道／用餐區格服務）。
  SIM_ERA: '2026',
  NO_ENTER_ZONES: ['桌面空間', '工作桌面混合', '工作設備區'],
  noEnter(r, c) { const cs = World.cellSpace[r][c]; return !!cs && !!cs.noEnter; },

  // Visit Rule：這格能「到訪」的店鋪＝站的位置、上下左右相鄰的攤位格所屬店鋪（站在店面前），加上擺椅時段內椅子延伸出來的店面（occupiedBy）。
  shopsReach(r, c) {
    const out = [];
    for (const [dr, dc] of [[0, 0], ...World.DIRS4]) {
      const s = World.stallAtRC[(r + dr) + ',' + (c + dc)];
      if (s && !out.includes(s.shop)) out.push(s.shop);
    }
    const cs = World.cellSpace[r][c];
    if (cs && cs.occupiedBy && this.chairsOut())
      for (const code of cs.occupiedBy) { const sh = World.shopByCode[code]; if (sh && !out.includes(sh)) out.push(sh); }
    return out;
  },

  // 店鋪現在佔的格子＝自己的格子＋擺椅時段內、營業中時延伸出來的椅子格（用餐區）；2D 紅框用。
  extentCells(shop) {
    const cells = shop.cells.map(s => [s.row, s.col]);
    if (!this.chairsOut() || !this.isOpen(shop)) return cells;
    for (const a of World.chairCells) {
      if (World.stallAtRC[a.row + ',' + a.col] && World.stallAtRC[a.row + ',' + a.col].shop === shop) continue; // 自己的格子已在清單內
      if (World.cellSpace[a.row][a.col].occupiedBy.includes(shop.code)) cells.push([a.row, a.col]);
    }
    return cells;
  },

  // ===== 椅子（Chair Rule／Mobility Attribute，agent_setting.md）：椅子狀態、座位數都是當下算出來，不存 =====
  daySec: 0, // 當天第幾秒（呼叫端 index.html 的 advanceClock()／resetSimulation 設定，見 Chair Rule「daySec 由呼叫端傳入」）
  hourNow() { return this.daySec / 3600; },

  chairsOut() { return this.hourNow() >= CONFIG.params.CHAIR_START_HOUR && this.hourNow() < CONFIG.params.CHAIR_END_HOUR; },
  isOpen(shop) { return !!shop && (shop.state === 'new' || shop.state === 'old'); }, // 「營業」＝new 或 old

  // 這格現在有幾張椅子：擺椅時段內，occupiedBy 裡有營業的店各一張。
  chairCount(r, c) {
    const cs = World.cellSpace[r][c];
    if (!cs || !cs.occupiedBy || !this.chairsOut()) return 0;
    return cs.occupiedBy.filter(code => this.isOpen(World.shopByCode[code])).length;
  },
  hasChair(r, c) { return this.chairCount(r, c) > 0; }, // 即 mobility＝Chair_Mobility，否則完全開放

  // 座位數＝這家店現在擺出的椅子數（一格一張）；時段外或沒營業為 0。chairCells 在 computeStallGroups 數一次。
  seatsOf(shop) { return this.chairsOut() && this.isOpen(shop) ? shop.chairCells : 0; },

  // 這家店現在還有空位（擺椅時段內、營業、沒坐滿）：Chair Seating Rule（坐下）與 Tourist 的 chairBonus（吸引）共用。不看用餐時間。
  hasSeat(shop) { return shop.seatsTaken < this.seatsOf(shop); },

  // 停留（Chair Slowdown：走進有椅子的格子多停 CHAIR_SLOW_SEC；Chair Seating：坐下停 SIT_SEC）。
  // 行人記 p.pause（還要停幾步＝幾秒）、p.sitShop（坐下的店鋪，停完還座位）。Tourist／Resident 的 move() 共用。
  tickPause(p) { // 停留中 → true（這一步不移動）；停完那一刻還座位
    if (!(p.pause > 0)) return false;
    if (--p.pause === 0) this.release(p);
    return true;
  },
  release(p) { if (p.sitShop) { p.sitShop.seatsTaken--; p.sitShop = null; } }, // 停完或離場都要還座位
  slowIfChair(p) { if (this.hasChair(p.row, p.col)) p.pause = CONFIG.params.CHAIR_SLOW_SEC; },
  trySit(p, shop) { // Chair Seating Rule：到訪當下有空位 → 坐下；滿座照常算到訪、不坐
    if (!this.hasSeat(shop)) return;
    shop.seatsTaken++; p.sitShop = shop; p.pause = CONFIG.params.SIT_SEC;
  },

  // Attribute：passCost —— 走進這格的成本，由 mobility 推得（Pass Cost Attribute）：擺椅＝PASS_COST_CHAIR，其餘＝PASS_COST_OPEN。
  // 不可通行格不算成本（passableFor 擋）；Resident 的 bfsFieldFromTargets 用它做加權最短路徑。
  passCost(r, c) { return this.hasChair(r, c) ? CONFIG.params.PASS_COST_CHAIR : CONFIG.params.PASS_COST_OPEN; },

  // Attribute：density —— 這格周圍 DENSITY_RADIUS 格（方形範圍）內的行人數（Tourist＋Resident），每個 microStep 開頭重算一次，不存歷史。
  // 宏觀取樣（walkProfile）不呼叫 refreshDensity，只有 8 位樣本、不算擁擠，dens 保持空。
  dens: new Map(),
  refreshDensity() {
    const R = CONFIG.params.DENSITY_RADIUS, m = (this.dens = new Map());
    for (const C of [Tourist, Resident]) for (const p of C.pedestrians)
      for (let r = p.row - R; r <= p.row + R; r++) for (let c = p.col - R; c <= p.col + R; c++) {
        if (c < 0 || c >= World.COLS) continue; // 避免 key 繞到上一列
        const k = r * World.COLS + c; m.set(k, (m.get(k) || 0) + 1);
      }
  },
  densityAt(r, c) { return Math.max(0, (this.dens.get(r * World.COLS + c) || 0) - 1); }, // 減 1＝扣掉站在這裡的自己（周圍的人）

  // Crowd Rule：行人落地後依所在格 density 反應。達 CROWD_THRESHOLD 且未超過 JAM_THRESHOLD → 多停 CROWD_SLOW_SEC；超過 JAM_THRESHOLD → 放棄計時器多加 JAM_GIVEUP_EXTRA。
  crowdReact(p) {
    const d = this.densityAt(p.row, p.col), P = CONFIG.params;
    if (d > P.JAM_THRESHOLD) p.ticksSinceProgress += P.JAM_GIVEUP_EXTRA;
    else if (d >= P.CROWD_THRESHOLD) p.pause = Math.max(p.pause || 0, P.CROWD_SLOW_SEC);
  },

  // Attribute：visibility —— 有多少走道格看得到這格（阻擋判定同 Tourist.computeVisible），除以全圖攤位格最大值（0~1），存在 cellSpace 攤位格。
  // 位置固定，開局算一次（computeStallGroups）；ponytail: 掃全部走道格×攤位格，地圖或視距放大後要改成射線外擴。
  buildVisibility() {
    const R = Tourist.visionRadius, counts = World.stalls.map(s => {
      let n = 0;
      for (const a of World.aisleCells) {
        if (Math.abs(a.row - s.row) > R || Math.abs(a.col - s.col) > R) continue;
        if (Tourist.computeVisible(a.row, a.col, s.row, s.col)) n++;
      }
      return n;
    });
    const max = Math.max(1, ...counts);
    World.stalls.forEach((s, i) => { World.cellSpace[s.row][s.col].visibility = counts[i] / max; });
  },
  // 店鋪彙總：所屬格子 visibility 的平均值，做法同 shopFrontage。
  shopVisibility(shop) {
    return shop.cells.reduce((a, cell) => a + World.cellSpace[cell.row][cell.col].visibility, 0) / shop.cells.length;
  },

  // Chair Avoidance Rule：距離一樣近的候選格裡，優先選沒有椅子的；全都有椅子就維持原樣。
  preferNoChair(cands) {
    const free = cands.filter(([r, c]) => !this.hasChair(r, c));
    return free.length ? free : cands;
  },

  // Attribute：corridorFrontage —— 這一格 4 個方向裡，臨走道／入口的邊數比例（0~1）。
  // 是格子位置固定的物理量，只跟這一格在地圖上的位置有關，不隨哪個攤販進駐而改變。
  frontageOf(r, c) {
    let aisleEdges = 0;
    for (const [dr, dc] of World.DIRS4) {
      const nr = r + dr, nc = c + dc;
      const t = (nr >= 0 && nr < World.ROWS && nc >= 0 && nc < World.COLS) ? World.cellType[nr][nc] : 'wall';
      if (t === 'aisle' || t === 'entry') aisleEdges++;
    }
    return aisleEdges / 4;
  },

  // 店鋪彙總：店鋪（同 code，多格）的 corridorFrontage ＝所屬格子的平均值，讀 World.cellSpace，不重算。
  shopFrontage(shop) {
    const sum = shop.cells.reduce((a, cell) => a + World.cellSpace[cell.row][cell.col].corridorFrontage, 0);
    return sum / shop.cells.length;
  }
};
