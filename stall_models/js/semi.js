// 半開放（市場實景，2026-09-24 依現場照片改版）— 規則來源：99_website/stall_models/README.md。
// 磨石子檯面砌體＋四根不鏽鋼立柱＋四邊橫桿（狀態色）。
var STALL_MODELS = STALL_MODELS || {};
STALL_MODELS.semi = {
  demoSize: { W: 4, D: 3 },
  pieces: [
    { name: "counterBase", u0: 0.15, u1: "W-0.15", d0: 0.15, d1: "D-0.15", h0: 0, h1: 0.75, color: "#8a8f98" },
    { name: "counterTop", u0: 0.1, u1: "W-0.1", d0: 0.1, d1: "D-0.1", h0: 0.75, h1: 0.9, color: "#a3a58a" },
    { name: "postFrontLeft", u0: 0, u1: 0.1, d0: 0, d1: 0.1, h0: 0, h1: 2.6, color: "#cbd5e0" },
    { name: "postFrontRight", u0: "W-0.1", u1: "W", d0: 0, d1: 0.1, h0: 0, h1: 2.6, color: "#cbd5e0" },
    { name: "postBackLeft", u0: 0, u1: 0.1, d0: "D-0.1", d1: "D", h0: 0, h1: 2.6, color: "#cbd5e0" },
    { name: "postBackRight", u0: "W-0.1", u1: "W", d0: "D-0.1", d1: "D", h0: 0, h1: 2.6, color: "#cbd5e0" },
    { name: "railFront", u0: 0, u1: "W", d0: 0, d1: 0.1, h0: 2.45, h1: 2.55, color: "acc" },
    { name: "railBack", u0: 0, u1: "W", d0: "D-0.1", d1: "D", h0: 2.45, h1: 2.55, color: "acc" },
    { name: "railLeft", u0: 0, u1: 0.1, d0: 0, d1: "D", h0: 2.45, h1: 2.55, color: "acc" },
    { name: "railRight", u0: "W-0.1", u1: "W", d0: 0, d1: "D", h0: 2.45, h1: 2.55, color: "acc" },
  ],
};
