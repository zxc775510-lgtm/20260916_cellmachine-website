// Tourist（逛新攤位的觀光客）— 規則來源：20260823_agent_setting.md「Tourist」＋文末「Isovist／已知路線 演算法」pseudocode。
// 對照範例：20260824/isovist_sim.html 的 isVisible()/findVisibleTarget()/findVisiblePeer()/greedyStepToward()，函式名稱刻意保持一致方便對照。
const Tourist = {
  interestState: 'new',   // Attribute：興趣目標＝營業中的 Vendor (New)，排除這趟已到訪過的
  giveupTicks: 8,         // 演算法第7點 GIVEUP_TICKS；文件沒留原始數字，沿用 isovist_sim.html 的自訂值
  visionRadius: 50,       // 監測範圍：100公尺 ÷ 每格2公尺 ≈ 50格半徑（本圖對角線~28.6格，目前不太會擋到誰，公式保留供之後放大場景重算）
  pedestrians: [],

  reset() {
    this.pedestrians = [];
  },

  // 通行限制：牆/設施不可過；攤位格只有等於興趣目標狀態才能踏入，否則視同牆。
  // 狀態查詢走 s.shop.state（20260824 使用者需求(1)：同編號＝同店鋪，狀態記在店鋪上）。
  passableFor(r, c) {
    if (!World.passable(r, c)) return false;
    const t = World.cellType[r][c];
    if (t !== 'stallslot') return true;
    const s = World.stallAtRC[r + ',' + c];
    return s.shop.state === this.interestState;
  },

  // 演算法「Bresenham」：回傳 (r0,c0)→(r1,c1) 之間的格子，不含起點、含終點。
  bresenhamCells(r0, c0, r1, c1) {
    const pts = [];
    const dr = Math.abs(r1 - r0), dc = Math.abs(c1 - c0);
    const sr = r0 < r1 ? 1 : -1, sc = c0 < c1 ? 1 : -1;
    let err = dr - dc, r = r0, c = c0;
    while (true) {
      if (!(r === r0 && c === c0)) pts.push([r, c]);
      if (r === r1 && c === c1) break;
      const e2 = 2 * err;
      if (e2 > -dc) { err -= dc; r += sr; }
      if (e2 < dr) { err += dr; c += sc; }
    }
    return pts;
  },

  // 演算法第1點 isVisible：阻擋（牆/設施/建物/任何攤位格，終點本身除外）＋距離上限，兩者疊加才算看得到。
  // 同一套判定也用在「看不看得到其他 Tourist」（findVisiblePeer 跟隨 fallback），不是另一套規則。
  // building 加入阻擋清單：20260914 使用者需求，見 20260827_agent_setting.md「監測範圍」。
  isVisible(r0, c0, r1, c1) {
    if (Math.hypot(r1 - r0, c1 - c0) > this.visionRadius) return false;
    const line = this.bresenhamCells(r0, c0, r1, c1);
    for (const [r, c] of line) {
      if (r === r1 && c === c1) continue; // 終點本身不擋自己
      const t = World.cellType[r][c];
      if (t === 'wall' || t === 'facility' || t === 'building' || t === 'stallslot') return false;
    }
    return true;
  },

  // Attribute 熱度偏好：多目標時比「距離−熱度加成」，非純距離。門檻同 20260823_simulator_setting.md 軌跡熱力三級門檻 1/10/25。
  heatBonus(h) {
    return h >= 25 ? 3 : h >= 10 ? 2 : h >= 1 ? 1 : 0;
  },

  // 演算法第2點 findVisibleTarget：看得到、還沒去過的同類型目標裡，score(距離−熱度加成)最小者，同分隨機。
  // 到訪判定以店鋪（s.shop.code）為單位：同店鋪的其他格子不會被當成沒去過的新目標。
  findVisibleTarget(p, trailHeat) {
    let best = Infinity, cands = [];
    for (const s of World.stalls) {
      if (s.shop.state !== this.interestState || p.visited.has(s.shop.code)) continue;
      if (!this.isVisible(p.row, p.col, s.row, s.col)) continue;
      const dist = Math.hypot(s.row - p.row, s.col - p.col);
      const score = dist - this.heatBonus(trailHeat[s.row][s.col]);
      if (score < best) { best = score; cands = [s]; }
      else if (score === best) cands.push(s);
    }
    return cands.length ? cands[Math.floor(Math.random() * cands.length)] : null;
  },

  // 演算法第3點 findVisiblePeer：看不到目標時的跟隨 fallback，找看得到的其他 Tourist（純距離，不加熱度）。
  // 來源：視野受限時的盲從跟隨是群體移動的標準現象（Social Force Model 及後續視野受限跟隨研究）。
  findVisiblePeer(p) {
    let best = Infinity, cands = [];
    for (const other of this.pedestrians) {
      if (other === p) continue;
      if (!this.isVisible(p.row, p.col, other.row, other.col)) continue;
      const dist = Math.hypot(other.row - p.row, other.col - p.col);
      if (dist < best) { best = dist; cands = [other]; }
      else if (dist === best) cands.push(other);
    }
    return cands.length ? cands[Math.floor(Math.random() * cands.length)] : null;
  },

  // 演算法第4點 greedyStepToward：4方向貪婪，最小曼哈頓距離，同分隨機。
  greedyStepToward(p, targetRow, targetCol) {
    let best = Infinity, cands = [];
    for (const [dr, dc] of World.DIRS4) {
      const nr = p.row + dr, nc = p.col + dc;
      if (!this.passableFor(nr, nc)) continue;
      const d = Math.abs(nr - targetRow) + Math.abs(nc - targetCol);
      if (d < best) { best = d; cands = [[nr, nc]]; }
      else if (d === best) cands.push([nr, nc]);
    }
    return cands.length ? cands[Math.floor(Math.random() * cands.length)] : null;
  },

  randomStep(p) {
    const opts = [];
    for (const [dr, dc] of World.DIRS4) {
      const nr = p.row + dr, nc = p.col + dc;
      if (this.passableFor(nr, nc)) opts.push([nr, nc]);
    }
    return opts.length ? opts[Math.floor(Math.random() * opts.length)] : null;
  },

  // 使用者需求(2)：逛完店鋪（或暫時找不到下一個可見目標）時不留在店內閒晃，直接找最近走道走出去。
  // 多來源 BFS：起點＝所有走道格（開場算好存在 World.aisleCells，不重掃全圖），field＝走到最近走道的實際步數；
  // 跟 Resident 的 bfsFieldFromTargets 同一套寫法。
  //
  // 效能（2026-09-14，見 cellmachine-grid-system-design 記憶）：地圖從市場858格擴大到研究範圍266,832格後，
  // 這裡原本每次呼叫都配置＋掃過一張跟地圖同大小的陣列——但 bestStepByField 只會查 stopAt 這一格跟它的4鄰格，
  // BFS「距離值一旦指定就不會再變」，搜到 stopAt 就能停，結果完全等價、不是打折的近似值。dist 也從陣列改成
  // 只存真的算過的格子的 Map。
  bfsFieldToAisle(stopAt) {
    const dist = new Map();
    const key = (r, c) => r * World.COLS + c;
    const q = [];
    for (const cell of World.aisleCells) { dist.set(key(cell.row, cell.col), 0); q.push([cell.row, cell.col]); }
    let head = 0;
    while (head < q.length) {
      const [r, c] = q[head++];
      const d = dist.get(key(r, c));
      for (const [dr, dc] of World.DIRS4) {
        const nr = r + dr, nc = c + dc;
        if (!this.passableFor(nr, nc)) continue;
        const nk = key(nr, nc);
        if (dist.has(nk)) continue;
        dist.set(nk, d + 1);
        q.push([nr, nc]);
      }
      if (stopAt && r === stopAt.row && c === stopAt.col) break; // 展開完鄰格才能停，見上方說明
    }
    return dist;
  },
  fieldGet(field, r, c) {
    const v = field.get(r * World.COLS + c);
    return v === undefined ? Infinity : v;
  },
  bestStepByField(p, field) {
    if (this.fieldGet(field, p.row, p.col) === Infinity) return null;
    let best = Infinity, cands = [];
    for (const [dr, dc] of World.DIRS4) {
      const nr = p.row + dr, nc = p.col + dc;
      if (!this.passableFor(nr, nc)) continue;
      const v = this.fieldGet(field, nr, nc);
      if (v < best) { best = v; cands = [[nr, nc]]; }
      else if (v === best) cands.push([nr, nc]);
    }
    return cands.length ? cands[Math.floor(Math.random() * cands.length)] : null;
  },
  exitStep(p) {
    return this.bestStepByField(p, this.bfsFieldToAisle(p));
  },

  // 生成規則：由入口格產生，數量隨興趣目標類型的攤位數增加（實際換算在 index.html 的 spawnPedestriansContinuous）。
  spawnExpected(expected) {
    if (World.entryCells.length === 0) return;
    let n = Math.floor(expected);
    if (Math.random() < (expected - n)) n++;
    for (let i = 0; i < n; i++) {
      const e = World.entryCells[Math.floor(Math.random() * World.entryCells.length)];
      // faceDr/faceDc：純視覺用的朝向（ISO metaball 畫圖偏向用，見 20260914 grilling Q4）——只記最後一次
      // 移動方向，不是規格 Rule，isVisible() 找目標/跟隨的判定邏輯不受這個影響，維持文件寫的360度全向。
      this.pedestrians.push({ row: e.r, col: e.c, visited: new Set(), ticksSinceProgress: 0, faceDr: 1, faceDc: 0 });
    }
  },

  // 演算法第5點 touristStep：可見未訪目標(熱度加權) → 看不到就找可見同伴(跟隨) → 都沒有就隨機走。
  // 使用者需求(2)：站在店鋪格子裡、沒有下一個可見目標時，不跟同伴/不亂走，直接走最近走道出去（逛完就走，不閒晃）。
  // 結束規則：到訪一攤不會消失，繼續逛，直到放棄計時器(第7點，ticksSinceProgress)超過門檻才離場（多站購物）。
  move(trailHeat) {
    const stillAlive = [];
    for (const p of this.pedestrians) {
      const target = this.findVisibleTarget(p, trailHeat);
      let next;
      if (target) {
        next = this.greedyStepToward(p, target.row, target.col);
      } else if (World.cellType[p.row][p.col] === 'stallslot') {
        next = this.exitStep(p);
      } else {
        const peer = this.findVisiblePeer(p);
        next = peer ? this.greedyStepToward(p, peer.row, peer.col) : this.randomStep(p);
      }
      if (next) {
        const dr = next[0] - p.row, dc = next[1] - p.col; // 記朝向（純視覺，見 spawnExpected 註解）
        if (dr !== 0 || dc !== 0) { p.faceDr = dr; p.faceDc = dc; }
        p.row = next[0]; p.col = next[1];
      }

      trailHeat[p.row][p.col] += TRAIL_STEP_ADD; // 不衰減、不封頂，見 20260823_simulator_setting.md

      const landed = World.stallAtRC[p.row + ',' + p.col];
      if (landed && landed.shop.state === this.interestState && !p.visited.has(landed.shop.code)) {
        landed.shop._visitTick = (landed.shop._visitTick || 0) + 1; // 人氣熱度記在店鋪上，供 VendorNew 用
        p.visited.add(landed.shop.code);
        p.ticksSinceProgress = 0;
      }
      p.ticksSinceProgress++; // 演算法第7點：離上次成功到訪過了幾個 beat
      if (p.ticksSinceProgress < this.giveupTicks * K_BEATS_PER_TICK) stillAlive.push(p);
    }
    this.pedestrians = stillAlive;
  },

  // 使用者需求(2)：定格在格子中心，不逐幀隨機偏移，避免視覺抖動。
  // 2026-09-14：座標改用鏡頭(camera)換算，理由同 Resident.draw()。
  draw(p5c) {
    p5c.fill('#dd6b20'); p5c.stroke('#9c4221'); p5c.strokeWeight(0.8);
    const s = Math.min(4.2, camera.cellPx * 0.5);
    for (const p of this.pedestrians) {
      const cx = worldToScreenX(p.col) + camera.cellPx / 2;
      const cy = worldToScreenY(p.row, OFFSET_Y) + camera.cellPx / 2;
      p5c.triangle(cx, cy - s, cx - s, cy + s, cx + s, cy + s);
    }
    p5c.noStroke();
  },

  // ISO 標記（20260914 使用者需求#3：沿用2D原本的三角形圖形，只是變成有厚度的等角版本）：
  // 2D 版是 p5c.triangle(cx,cy-s, cx-s,cy+s, cx+s,cy+s)（頂點朝上）；這裡把同一個三角形往上
  // 擠出真人身高（ISO_PERSON_HEIGHT_M，1格=1公尺換算），畫3個側面(較暗) + 頂面(原色三角形)。
  drawIso(p5c) {
    if (!isoBBox) return;
    const hPx = isoHeightPx(ISO_PERSON_HEIGHT_M);
    const s = Math.min(4.2, isoCamera.u * 0.5); // 跟 2D 版 camera.cellPx*0.5 換算邏輯一致
    for (const p of this.pedestrians) {
      const g = isoProject(p.row, p.col, 0);
      const bA = { x: g.x, y: g.y - s }, bL = { x: g.x - s, y: g.y + s }, bR = { x: g.x + s, y: g.y + s };
      const tA = { x: bA.x, y: bA.y - hPx }, tL = { x: bL.x, y: bL.y - hPx }, tR = { x: bR.x, y: bR.y - hPx };
      drawingContext.fillStyle = isoShade('#dd6b20', 0.6);
      isoDrawPoly([bA, bL, tL, tA]);
      isoDrawPoly([bL, bR, tR, tL]);
      isoDrawPoly([bR, bA, tA, tR]);
      drawingContext.fillStyle = '#dd6b20';
      isoDrawPoly([tA, tL, tR]);
    }
  },

  // 掃半徑內每一格，套用「演算法第1點 isVisible」本身（不是另一套判定），回傳真的看得到的格子清單。
  // 給下面的視域高亮用（形狀＝真實計算結果，不是脫鉤的裝飾形狀）。
  getVisibleCells(p, radius = this.visionRadius) {
    const cells = [];
    const R = radius;
    for (let dr = -R; dr <= R; dr++) {
      for (let dc = -R; dc <= R; dc++) {
        const r = p.row + dr, c = p.col + dc;
        if (r < 0 || r >= World.ROWS || c < 0 || c >= World.COLS) continue;
        if (this.isVisible(p.row, p.col, r, c)) cells.push([r, c]);
      }
    }
    return cells;
  },

  _visKey: null, _visCells: null,

  // 20260914 使用者需求#1/#2：視域呈現從「metaball 融合形狀」改成直接把看得到的格子高亮——
  // 比抽象的融合形狀更直覺，2D/畫面一跟 ISO 面板也才能共用同一份資料呈現同一件事（需求#2）。
  // 只示範陣列第一個 Tourist；每次移到新格子才重算一次（不是每個 render frame 都重算(2R+1)²格）。
  getDemoVisibleCells() {
    const p = this.pedestrians[0];
    if (!p) return null;
    const key = p.row + ',' + p.col;
    if (this._visKey !== key) { this._visKey = key; this._visCells = this.getVisibleCells(p); }
    return this._visCells;
  },

  // 畫面一（2D）：可見格直接疊一層亮黃色半透明色塊，蓋在格子原本的顏色上面。
  drawVisionHighlight2D() {
    const cells = this.getDemoVisibleCells();
    if (!cells) return;
    drawingContext.save();
    drawingContext.fillStyle = visionHighlightPattern; // 20260914 需求#1：白色斜線疊圖，不是純色色塊
    for (const [r, c] of cells) {
      drawingContext.fillRect(worldToScreenX(c), worldToScreenY(r, OFFSET_Y), camera.cellPx, camera.cellPx);
    }
    drawingContext.restore();
  },

  // ISO：同一份可見格，貼在每格「自己的」地形高度上面一點點（不同型別高度不同，見 ISO_HEIGHT_M），
  // 裁掉 isoBBox 範圍外的格子（ISO 面板的資料範圍就只到市場+4街廓，見 computeIsoScope）。
  drawVisionHighlightIso() {
    const cells = this.getDemoVisibleCells();
    if (!cells || !isoBBox) return;
    drawingContext.save();
    drawingContext.fillStyle = visionHighlightPattern;
    for (const [r, c] of cells) {
      if (r < isoBBox.minRow || r > isoBBox.maxRow || c < isoBBox.minCol || c > isoBBox.maxCol) continue;
      const h = isoHeightPx(ISO_HEIGHT_M[World.cellType[r][c]] || 0) + 1;
      const TL = isoProject(r, c, h), TR = isoProject(r, c + 1, h), BR = isoProject(r + 1, c + 1, h), BL = isoProject(r + 1, c, h);
      isoDrawPoly([TL, TR, BR, BL]);
    }
    drawingContext.restore();
  }
};
