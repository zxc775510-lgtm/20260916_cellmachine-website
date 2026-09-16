// Cell（市場網格空間本身）— 規則來源：20260827_agent_setting.md「Space Class」
// Space Class 存成陣列：World.cellSpace，跟 World.cellType 一樣是 ROWS×COLS 的 2D 陣列，每一格自己的 Attribute。
// 目前唯一實作的 Attribute：corridorFrontage（這一格臨走道／入口的邊數比例）。其餘 Cell 屬性尚未實作，見文件 Known Implementation Gaps。
// 判斷邏輯（怎麼用這個數值）不寫在這裡——放在 Vendor (New) 的 Site Fertility Weighting（website/agents/vendorNew.js），Cell 只提供量化值。
const Cell = {
  // 建立 World.cellSpace：只有攤位格（stallslot）算 corridorFrontage，其餘格型（牆/設施/入口/走道）用不到，存 null。
  buildCellSpace() {
    const space = [];
    for (let r = 0; r < World.ROWS; r++) {
      const row = [];
      for (let c = 0; c < World.COLS; c++) {
        row.push(World.cellType[r][c] === 'stallslot' ? { corridorFrontage: this.frontageOf(r, c) } : null);
      }
      space.push(row);
    }
    return space;
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
