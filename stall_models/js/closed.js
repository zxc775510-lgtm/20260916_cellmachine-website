// 封閉（鐵門）— 規則來源：99_website/stall_models/README.md（座標系統/公式語法/demoSize 說明）。
// 盒子＋屋頂＋鐵捲門（門框/門片/拉把），door 開在 d=0（店面朝街那一側）。
var STALL_MODELS = STALL_MODELS || {};
STALL_MODELS.closed = {
  demoSize: { W: 4, D: 3 },
  pieces: [
    { name: "body", u0: 0.1, u1: "W-0.1", d0: 0.1, d1: "D-0.1", h0: 0, h1: 2.8, color: "#8b93a1" },
    { name: "roof", u0: 0, u1: "W", d0: 0, d1: "D", h0: 2.8, h1: 3, color: "#5a6270" },
    { name: "doorFrame", u0: 0.5, u1: "W-0.5", d0: -0.05, d1: 0.05, h0: 2.3, h1: 2.65, color: "#4a5060" },
    { name: "door", u0: 0.5, u1: "W-0.5", d0: -0.03, d1: 0.03, h0: 0.05, h1: 2.25, color: "#c2c8d1" },
    { name: "handle", u0: "W/2-0.15", u1: "W/2+0.15", d0: -0.08, d1: 0.08, h0: 0.9, h1: 1.05, color: "#1a202c" },
  ],
};
