// Cell（市場網格空間本身）— 規則來源：agent_setting.md「Space Class」
// Space Class 存成陣列：World.cellSpace，跟 World.cellType 一樣是 ROWS×COLS 的 2D 陣列，每一格自己的 Attribute。
// 已實作的 Attribute：corridorFrontage（臨走道／入口的邊數比例）、occupiedBy／mobility（椅子，見下方）。其餘 Cell 屬性尚未實作，見文件 Known Implementation Gaps。
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
        row.push(t === 'stallslot' ? { corridorFrontage: this.frontageOf(r, c) }
          : t === 'aisle' ? { occupiedBy: (ERA_DATA.cells[r + ',' + c] || {}).occupiedBy || [] } : null);
      }
      space.push(row);
    }
    return space;
  },

  // ===== 椅子（Chair Rule／Mobility Attribute，agent_setting.md）：椅子狀態、座位數都是當下算出來，不存 =====
  dayBeat: 0, // 日循環 beat（呼叫端 index.html 的 beat()／resetSimulation 設定，見 Chair Rule「dayBeat 由呼叫端傳入」）

  chairsOut() { return this.dayBeat >= CONFIG.params.CHAIR_START_BEAT && this.dayBeat < CONFIG.params.CHAIR_END_BEAT; },
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

  // 用餐時間（MEAL_BEATS 任一 [起,終) 區間）
  isMealTime() { return CONFIG.params.MEAL_BEATS.some(([a, b]) => this.dayBeat >= a && this.dayBeat < b); },
  // 用餐時間且這家店還有空位：Chair Seating Rule（坐下）與 Tourist 的 chairBonus（吸引）共用。
  hasSeat(shop) { return this.isMealTime() && shop.seatsTaken < this.seatsOf(shop); },

  // 停留（Chair Slowdown：走進有椅子的格子多停 CHAIR_SLOW_BEATS；Chair Seating：坐下停 SIT_BEATS）。
  // 行人記 p.pause（還要停幾個 beat）、p.sitShop（坐下的店鋪，停完還座位）。Tourist／Resident 的 move() 共用。
  tickPause(p) { // 停留中 → true（這個 beat 不移動）；停完那一刻還座位
    if (!(p.pause > 0)) return false;
    if (--p.pause === 0) this.release(p);
    return true;
  },
  release(p) { if (p.sitShop) { p.sitShop.seatsTaken--; p.sitShop = null; } }, // 停完或離場都要還座位
  slowIfChair(p) { if (this.hasChair(p.row, p.col)) p.pause = CONFIG.params.CHAIR_SLOW_BEATS; },
  trySit(p, shop) { // Chair Seating Rule：到訪當下用餐時間且有空位 → 坐下；滿座照常算到訪、不坐
    if (!this.hasSeat(shop)) return;
    shop.seatsTaken++; p.sitShop = shop; p.pause = CONFIG.params.SIT_BEATS;
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
