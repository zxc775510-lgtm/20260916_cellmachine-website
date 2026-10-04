// Resident（逛老攤販的當地居民）— 規則來源：agent_setting.md「Resident」＋isovist_algorithm.md 第6-7點（residentStep）。
// 跟 Tourist 的差異：不用 isovist，全市場已知路線直接抄近路走（Wayfinding 文獻：熟悉環境者用既有認知地圖抄捷徑）。
// Resident 沒有 Personality 屬性，純看距離，不套用 Target Scoring Rule（heatBonus）——見主文件 Resident「Rule」段落。
const Resident = {
  interestState: 'old',   // Attribute：興趣目標＝營業中的 Vendor (Old)，排除這趟已到訪過的
  giveupTicks: CONFIG.params.GIVEUP_TICKS, // 數值來源：99_config/agents/human.json；        // 同 Tourist，見演算法第7點
  pedestrians: [],

  reset() {
    this.pedestrians = [];
  },

  // 狀態查詢走 s.shop.state（20260824 使用者需求(1)：同編號＝同店鋪，狀態記在店鋪上）。
  passableFor(r, c) {
    if (!World.passable(r, c)) return false;
    const t = World.cellType[r][c];
    if (t !== 'stallslot') return true;
    const s = World.stallAtRC[r + ',' + c];
    return s.shop.state === this.interestState;
  },

  // 演算法第6點 bfsFieldFromTargets：多來源 BFS，起點＝targets 全部同時展開，field[r][c]＝走到最近一個目標的實際步數。
  // 效能（2026-09-14，見 cellmachine-grid-system-design 記憶）：field 只會被 bestStepByField 拿來查
  // stopAt 那一格跟它的4鄰格，BFS 本身「一格的距離值一旦指定就不會再變」，所以搜到 stopAt 那格當下就能停，
  // 跟跑完全圖的結果完全等價，不是打折的近似值——把 O(全圖格數) 降成 O(離最近目標的實際步數)。
  // dist 也從整張網格大小的陣列改成 Map（只存真的算過的格子），避免每次呼叫都配置一個跟地圖同大小的陣列。
  bfsFieldFromTargets(targets, stopAt) {
    const dist = new Map();
    const key = (r, c) => r * World.COLS + c;
    const q = [];
    for (const s of targets) { const k = key(s.row, s.col); if (!dist.has(k)) { dist.set(k, 0); q.push([s.row, s.col]); } }
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
      // 一定要先展開完 (r,c) 的鄰格再檢查停止條件：stopAt 自己的距離值在被展開的當下才確定會被用到的
      // 4鄰格也都拿到值，提早在展開前就跳出會讓鄰格漏算，變成 bestStepByField 誤判成不可達。
      if (stopAt && r === stopAt.row && c === stopAt.col) break;
    }
    return dist;
  },

  // field 是 bfsFieldFromTargets 回傳的 Map（key=r*World.COLS+c），查不到＝不可達(Infinity)。
  fieldGet(field, r, c) {
    const v = field.get(r * World.COLS + c);
    return v === undefined ? Infinity : v;
  },

  randomStep(p) {
    const opts = [];
    for (const [dr, dc] of World.DIRS4) {
      const nr = p.row + dr, nc = p.col + dc;
      if (this.passableFor(nr, nc)) opts.push([nr, nc]);
    }
    return opts.length ? opts[Math.floor(Math.random() * opts.length)] : null;
  },

  // 走場值最小的可通行鄰格，同分隨機；bfsFieldFromTargets 產出的 field 都用這個取下一步。
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
    cands = Cell.preferNoChair(cands); // Chair Avoidance Rule：距離一樣近時優先走沒椅子的格子
    return cands.length ? cands[Math.floor(Math.random() * cands.length)] : null;
  },
  // 使用者需求(2)：逛完店鋪（或暫時找不到下一個未訪目標）時不留在店內閒晃，直接找最近走道走出去。
  // targets 換成所有走道格（開場算好存在 World.aisleCells，不重掃），共用同一套 bfsFieldFromTargets。
  exitStep(p) {
    return this.bestStepByField(p, this.bfsFieldFromTargets(World.aisleCells, p));
  },

  spawnExpected(expected) {
    if (World.entryCells.length === 0) return;
    let n = Math.floor(expected);
    if (Math.random() < (expected - n)) n++;
    for (let i = 0; i < n; i++) {
      const e = World.entryCells[Math.floor(Math.random() * World.entryCells.length)];
      this.pedestrians.push({ row: e.r, col: e.c, visited: new Set(), ticksSinceProgress: 0 });
    }
  },

  // 演算法第7點 residentStep：targets 為空(全逛完/沒有營業中old) → 隨機走；否則 BFS 場，走場值最小的鄰格，
  // 場不可達時退回隨機鄰格。使用者需求(2)：站在店鋪格子裡、沒有下一個未訪目標時，直接走最近走道出去，不亂走閒晃。
  // 結束規則同 Tourist：多站購物，直到放棄計時器超過門檻才離場。
  move(trailHeat) {
    const stillAlive = [];
    for (const p of this.pedestrians) {
      if (!Cell.tickPause(p)) this.step(p, trailHeat); // 停留中（走慢／坐下）這個 beat 不移動
      p.ticksSinceProgress++;
      if (p.ticksSinceProgress < this.giveupTicks * K_BEATS_PER_TICK) stillAlive.push(p);
      else Cell.release(p);
    }
    this.pedestrians = stillAlive;
  },

  step(p, trailHeat) {
      const targets = World.stalls.filter(s => s.shop.state === this.interestState && !p.visited.has(s.shop.code));
      let next = null;
      if (targets.length > 0) {
        next = this.bestStepByField(p, this.bfsFieldFromTargets(targets, p));
      }
      if (!next && World.cellType[p.row][p.col] === 'stallslot') next = this.exitStep(p);
      if (!next) next = this.randomStep(p); // 沒有未訪目標／目標暫時不可達的備援
      if (next) { p.row = next[0]; p.col = next[1]; Cell.slowIfChair(p); } // Chair Slowdown Rule

      trailHeat[p.row][p.col] += TRAIL_STEP_ADD; // 不衰減、不封頂，見 simulator_setting.md

      const landed = World.stallAtRC[p.row + ',' + p.col];
      if (landed && landed.shop.state === this.interestState && !p.visited.has(landed.shop.code)) {
        landed.shop._visitTick = (landed.shop._visitTick || 0) + 1; // 人氣熱度記在店鋪上，供 VendorOld/VendorNew 用
        p.visited.add(landed.shop.code);
        p.ticksSinceProgress = 0;
        Cell.trySit(p, landed.shop); // Chair Seating Rule
      }
  },

  // 使用者需求(2)：定格在格子中心，不逐幀隨機偏移，避免視覺抖動。
  // 2026-09-14：座標改用鏡頭(camera)換算，不是固定 CELL——鏡頭範圍外的行人畫出來的座標會落在
  // withGridClip() 設的裁切區外，自然不會顯示，不用額外判斷。
  draw(p5c) {
    p5c.fill('#3182ce'); p5c.stroke('#1a4e8a'); p5c.strokeWeight(0.8);
    const s = Math.min(6.8, camera.cellPx * 0.85); // 縮到很小格時行人也跟著縮小，不會佔滿好幾格
    for (const p of this.pedestrians) {
      const cx = worldToScreenX(p.col) + camera.cellPx / 2;
      const cy = worldToScreenY(p.row, OFFSET_Y) + camera.cellPx / 2;
      p5c.ellipse(cx, cy, s, s);
    }
    p5c.noStroke();
  },

  // ISO 標記（20260914 使用者需求#3：沿用2D原本的圓形圖形，只是變成有厚度的等角版本）：
  // 2D 版是 p5c.ellipse(cx,cy,s,s)；這裡把同一個圓往上擠出真人身高，畫法＝經典等角圓柱簡化畫法
  // （左右兩側切線連成的側面矩形＋頂面圓形，不用真的算橢圓輪廓，見 tourist.js 的三角柱做法對照）。
  drawIso(p5c) {
    if (!isoBBox) return;
    const hPx = isoHeightPx(ISO_PERSON_HEIGHT_M);
    const s = Math.min(6.8, isoCamera.u * 0.85); // 跟 2D 版 camera.cellPx*0.85 換算邏輯一致
    for (const p of this.pedestrians) {
      const g = isoProject(p.row, p.col, 0);
      const top = { x: g.x, y: g.y - hPx };
      drawingContext.fillStyle = isoShade('#3182ce', 0.6);
      isoDrawPoly([
        { x: g.x - s / 2, y: g.y }, { x: g.x + s / 2, y: g.y },
        { x: top.x + s / 2, y: top.y }, { x: top.x - s / 2, y: top.y },
      ]);
      p5c.noStroke(); p5c.fill('#3182ce');
      p5c.ellipse(top.x, top.y, s, s);
    }
  }
};
