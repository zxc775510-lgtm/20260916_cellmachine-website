// 臨時攤位（移動攤販）— 規則來源：99_website/stall_models/README.md。
// 不畫盒體，只沿長邊排桌子，桌布＝狀態色（20260924 修訂：拿掉餐車，見工作紀錄）。
var STALL_MODELS = STALL_MODELS || {};
STALL_MODELS.cart = {
  demoSize: { W: 2.5, D: 2 },
  pieces: [

  ],
  repeatAlongU: {
    spacing: 2.5,
    template: [
      { name: "tableTop", u0: -0.35, u1: 0.35, d0: -0.2, d1: 0.2, h0: 0.75, h1: 0.85, color: "acc" },
      { name: "legFrontLeft", u0: -0.34, u1: -0.22, d0: -0.18, d1: -0.06, h0: 0, h1: 0.75, color: "#6b4a2a" },
      { name: "legFrontRight", u0: 0.22, u1: 0.34, d0: -0.18, d1: -0.06, h0: 0, h1: 0.75, color: "#6b4a2a" },
      { name: "legBackLeft", u0: -0.34, u1: -0.22, d0: 0.06, d1: 0.18, h0: 0, h1: 0.75, color: "#6b4a2a" },
      { name: "legBackRight", u0: 0.22, u1: 0.34, d0: 0.06, d1: 0.18, h0: 0, h1: 0.75, color: "#6b4a2a" },
    ],
  },
};
