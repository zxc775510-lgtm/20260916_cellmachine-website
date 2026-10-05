// Vendor (New)（正在營業的新創攤位）— 規則來源：agent_setting.md「Vendor (New)」
const VendorNew = {
  // 生存規則：關門機率 — 平常9%、人氣旺（人氣≥2）4%、冷清（冷清度≥3輪）25%
  BASE_IDLE: CONFIG.params.BASE_IDLE, // 數值來源：99_config/agents/vendorNew.json
  HOT_IDLE: CONFIG.params.HOT_IDLE,
  COLD_IDLE: CONFIG.params.COLD_IDLE,
  HEAT_WINDOW: CONFIG.params.HEAT_WINDOW,         // 人氣＝近兩輪到訪次數
  HEAT_HOT_THRESHOLD: CONFIG.params.HEAT_HOT_THRESHOLD,
  COLD_STREAK_THRESHOLD: CONFIG.params.COLD_STREAK_THRESHOLD, // 冷清＝連續無到訪達此輪數
  MOVE_MIN_TICK: CONFIG.params.MOVE_MIN_TICK, MOVE_MAX_TICK: CONFIG.params.MOVE_MAX_TICK, // 搬遷規則：隨機1~4輪倒數歸零觸發重新配置
  FERTILITY_BASE_WEIGHT: CONFIG.params.FERTILITY_BASE_WEIGHT, // Site Fertility Weighting 底線權重，讓零痕跡空格仍有機會中選
  FRONTAGE_SCALE: CONFIG.params.FRONTAGE_SCALE, // Site Fertility Weighting：Cell.corridorFrontage（0~1）換算成權重的倍率

  randMoveTicks() {
    return this.MOVE_MIN_TICK + Math.floor(Math.random() * (this.MOVE_MAX_TICK - this.MOVE_MIN_TICK + 1));
  },

  initStall(s) {
    s.moveTimer = this.randMoveTicks();
    s.visitHist = [0, 0];
    s.zeroStreak = 0;
  },

  heatOf(s) { return s.visitHist.reduce((a, b) => a + b, 0); },

  updateHeatHistory(s) {
    const v = Math.round(s._visitTick || 0); // _visitTick 已乘 VISIT_NORM 歸一回舊量級（見 index.html），取整數才跟人氣門檻同單位
    s.visitHist.push(v);
    if (s.visitHist.length > this.HEAT_WINDOW) s.visitHist.shift();
    s.zeroStreak = v === 0 ? s.zeroStreak + 1 : 0;
    s._visitTick = 0;
  },

  idleJudgement(s) {
    const h = this.heatOf(s);
    let p = this.BASE_IDLE;
    if (h >= this.HEAT_HOT_THRESHOLD) p = this.HOT_IDLE;
    else if (s.zeroStreak >= this.COLD_STREAK_THRESHOLD) p = this.COLD_IDLE;
    if (Math.random() < p) s.state = 'new_unused';
  },

  // Site Fertility Weighting：空店鋪的搬遷權重＝行為痕跡＋建築先天條件，兩項相加：
  // (1) 該店鋪所有格子的 touristTrailHeat+residentTrailHeat 總和（全域變數，定義於 index.html，
  //     見 simulator_setting.md「視覺效果—動線／路徑」）——地點過去被驗證過的人氣，累積出來的軟資料。
  // (2) shop.corridorFrontage × FRONTAGE_SCALE——讀 World.cellSpace（Cell Attribute 陣列，website/agents/cell.js）
  //     算出來的店面臨走道比例，地點本身的先天可及性，就算從未被使用過（痕跡=0）也不會跟其他空格沒有差別。
  // ＋ FERTILITY_BASE_WEIGHT 底線，避免三項都是 0 時永久死鎖。
  shopFertility(shop) {
    let heat = 0;
    for (const c of shop.cells) heat += touristTrailHeat[c.row][c.col] + residentTrailHeat[c.row][c.col];
    return heat + shop.corridorFrontage * this.FRONTAGE_SCALE + this.visFertility(shop) + this.FERTILITY_BASE_WEIGHT;
  },

  // (3) 可見度項：shop.visibility 隱蔽（< VIS_LOW）0、一般 VIS_FERTILITY_MID、顯眼（> VIS_HIGH）VIS_FERTILITY_HIGH，兩級固定值。
  visFertility(shop) {
    const P = CONFIG.params;
    return shop.visibility < P.VIS_LOW ? 0 : shop.visibility > P.VIS_HIGH ? P.VIS_FERTILITY_HIGH : P.VIS_FERTILITY_MID;
  },

  pickFertileBlank(blanks) {
    const weights = blanks.map(b => this.shopFertility(b));
    let r = Math.random() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < blanks.length; i++) {
      r -= weights[i];
      if (r <= 0) return blanks[i];
    }
    return blanks[blanks.length - 1];
  },

  // 搬遷規則：人氣旺就暫停倒數、留在原地；不旺才計時，依 Site Fertility Weighting 加權挑一個空店鋪搬過去，原位置變回空店鋪。
  // 單位＝店鋪（World.shops，同 code 分組），不是個別 grid id——搬遷=兩家店鋪整組交換狀態。
  relocationJudgement(s) {
    if (this.heatOf(s) >= this.HEAT_HOT_THRESHOLD) return;
    s.moveTimer--;
    if (s.moveTimer > 0) return;
    const blanks = World.shops.filter(x => x.state === 'blank');
    if (blanks.length > 0) {
      const target = this.pickFertileBlank(blanks);
      target.state = s.state;
      target.moveTimer = this.randMoveTicks();
      target.visitHist = [0, 0];
      target.zeroStreak = 0;
      s.state = 'blank';
      s.moveTimer = 0;
    } else {
      s.moveTimer = this.randMoveTicks();
    }
  },

  stepTick() {
    const mine = World.shops.filter(s => s.state === 'new');
    mine.forEach(s => this.updateHeatHistory(s));
    mine.forEach(s => this.idleJudgement(s));
    // 這輪剛變 new_unused 的不在這裡搬遷，改由 VendorIdle 接手（狀態互斥，不會漏拍）。
    World.shops.filter(s => s.state === 'new').forEach(s => this.relocationJudgement(s));
  }
};
