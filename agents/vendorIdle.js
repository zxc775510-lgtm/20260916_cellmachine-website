// Vendor (Idle)（已關門的攤販，不分新舊）— 規則來源：agent_setting.md「Vendor (Idle)」
// 世代＝老（state:'old_unused'）：固定規則，完全靜止；Vendor (Old) 現行規則不會關門，這裡現行不會被觸發。
// 世代＝新（state:'new_unused'）：先擲重開規則，沒重開才走搬遷規則（跟 VendorNew 共用同一個函式）。
const VendorIdle = {
  REOPEN_PROB: CONFIG.params.REOPEN_PROB, // 數值來源：99_config/agents/vendorIdle.json； // 重開規則：沿用 VendorNew.BASE_IDLE 同數字，自訂、可覆寫

  stepTick() {
    World.shops.filter(s => s.state === 'new_unused').forEach(s => {
      if (Math.random() < this.REOPEN_PROB) {
        s.state = 'new';
        VendorNew.initStall(s); // 重開＝新攤販進駐，人氣/搬遷倒數歸零重算
        return;
      }
      VendorNew.relocationJudgement(s); // 沒重開，跟 VendorNew 共用搬遷邏輯
    });
    // old_unused：無 Rule，什麼都不做。
  }
};
