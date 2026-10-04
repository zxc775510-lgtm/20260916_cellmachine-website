// 由 99_config/build_config.js 產生，不要手改；改 99_config/**/*.json 後重跑腳本。
const CONFIG = {
 "params": {
  "CHAIR_BLOCK_COUNT": 2,
  "WALK_SPEED_MPS": 1.4,
  "CELL_SIZE_M": 2,
  "GIVEUP_TICKS": 8,
  "VISION_RADIUS_CELLS": 50,
  "HEAT_BONUS_TIERS": {
   "E": [
    [
     25,
     3
    ],
    [
     10,
     2
    ],
    [
     1,
     1
    ]
   ],
   "I": [
    [
     25,
     -3
    ],
    [
     10,
     -2
    ],
    [
     1,
     -1
    ]
   ]
  },
  "CHAIR_START_BEAT": 16,
  "CHAIR_END_BEAT": 80,
  "REOPEN_PROB": 0.09,
  "HEAT_WINDOW": 2,
  "COLD_STREAK_THRESHOLD": 3,
  "BASE_IDLE": 0.09,
  "HOT_IDLE": 0.04,
  "COLD_IDLE": 0.25,
  "HEAT_HOT_THRESHOLD": 2,
  "MOVE_MIN_TICK": 1,
  "MOVE_MAX_TICK": 4,
  "FERTILITY_BASE_WEIGHT": 1,
  "FRONTAGE_SCALE": 3
 },
 "classes": {
  "Human": {
   "id": "Human",
   "label": "在市場走動找攤位的人（Tourist／Resident 的共同基礎）",
   "note": "Tourist／Resident 在程式碼裡是各自獨立的完整實作，共用規則是兩邊各寫一份、邏輯相同；extends 只是文件層級的 DRY。",
   "attributes": {
    "interestTarget": {
     "desc": "興趣目標＝營業中的某類 Vendor，排除這趟已到訪（以店鋪 code 計）的；值域由子類決定",
     "variants": [
      {
       "adjective": "一個新來的人（Tourist）",
       "when": "class == Tourist",
       "value": "Vendor (New)",
       "effect": [
        "Passability 只放行 new 攤位",
        "Spawn 數量隨 new 店鋪數"
       ]
      },
      {
       "adjective": "一個熟悉在地的人（Resident）",
       "when": "class == Resident",
       "value": "Vendor (Old)",
       "effect": [
        "Passability 只放行 old 攤位",
        "Spawn 數量隨 old 店鋪數"
       ]
      }
     ],
     "status": "implemented"
    }
   },
   "rules": {
    "passableFor": {
     "desc": "牆/設施不可通行；攤位格只有等於興趣目標類型才可通行，否則視同牆；走道椅子數（occupiedBy 目前的長度，一家店一張）≥ CHAIR_BLOCK_COUNT 視同牆，少於閾值可通行；其餘走道、入口可通行；繞不過去沿用既有後備行為（exitStep／隨機走／giveupRule）",
     "params": {
      "CHAIR_BLOCK_COUNT": {
       "value": 2,
       "unit": "張",
       "note": "走道格椅子數達此值才擋路，Tourist、Resident 共用"
      }
     },
     "impl": "agents/tourist.js#passableFor | agents/resident.js#passableFor",
     "status": "implemented"
    },
    "spawnExpected": {
     "desc": "從入口格（World.entryCells）均勻隨機生成；數量隨興趣目標類型的營業店鋪數增加，另乘外部事件倍率（見 simulator_setting）",
     "impl": "agents/tourist.js#spawnExpected | agents/resident.js#spawnExpected",
     "status": "implemented"
    },
    "movementSpeed": {
     "desc": "純物理參考常數（非函式、程式碼未使用）：1.4 m/s，每格 2 m ≈ 1.43 秒/格；不用來校準 beat/tick",
     "params": {
      "WALK_SPEED_MPS": {
       "value": 1.4,
       "unit": "m/s",
       "note": "Gehl 設計步速"
      },
      "CELL_SIZE_M": {
       "value": 2,
       "unit": "m",
       "note": "市場內部網格"
      }
     },
     "status": "reference"
    },
    "giveupRule": {
     "desc": "ticksSinceProgress（距上次到訪新攤位的 beat 數）達 GIVEUP_TICKS×K_BEATS_PER_TICK 就離場；到訪新攤位歸零",
     "params": {
      "GIVEUP_TICKS": {
       "value": 8,
       "unit": "tick",
       "note": "Tourist、Resident 共用"
      }
     },
     "impl": "agents/tourist.js#move | agents/resident.js#move（inline）",
     "status": "implemented"
    },
    "exitStep": {
     "desc": "站在攤位格裡又沒有下一個目標 → 多來源 BFS（起點＝全走道格）走最近走道出去，不閒晃",
     "impl": "agents/tourist.js#exitStep | agents/resident.js#exitStep",
     "status": "implemented"
    }
   }
  },
  "Resident": {
   "id": "Resident",
   "extends": "Human",
   "label": "熟悉市場的在地居民，靠已知路線直接去",
   "attributes": {
    "personality": {
     "desc": "無——只有 Tourist 有這個屬性，Resident 不套用 Target Scoring",
     "status": "n/a"
    }
   },
   "rules": {
    "move": {
     "desc": "BFS 版：全市場多來源 BFS 找最近未訪的營業 Vendor (Old)，純看距離；沒有目標或不可達且站在攤位格就 exitStep，否則隨機走",
     "ref": "99_spec/isovist_algorithm.md#residentStep",
     "source": "Wayfinding 文獻：熟悉環境者用既有認知地圖抄捷徑 https://pmc.ncbi.nlm.nih.gov/articles/PMC8324579/",
     "impl": "agents/resident.js#move",
     "status": "implemented"
    },
    "bfsFieldFromTargets": {
     "desc": "多來源 BFS 場（含 stopAt 早停）",
     "impl": "agents/resident.js#bfsFieldFromTargets",
     "status": "implemented"
    }
   }
  },
  "Tourist": {
   "id": "Tourist",
   "extends": "Human",
   "label": "想逛新創攤位的訪客，不熟悉市場，靠 isovist 邊走邊找",
   "attributes": {
    "personality": {
     "desc": "人格特質；目前固定為 E人（常數，程式碼沒有存成欄位），I人只是定義好、留給未來的人格比例功能",
     "variants": [
      {
       "adjective": "一個熱情外向的人（E人）",
       "when": "personality == E",
       "effect": [
        "heatBonus 為正：人多的攤位感覺比較近，優先被選中"
       ]
      },
      {
       "adjective": "一個怕生內向的人（I人）",
       "when": "personality == I",
       "effect": [
        "heatBonus 為負：人多的攤位感覺比較遠，傾向被跳過"
       ],
       "status": "planned"
      }
     ],
     "source": "2026-08-26 課堂筆記：E 人向人多的地方靠近，I 人相反",
     "status": "implemented"
    }
   },
   "rules": {
    "move": {
     "desc": "isovist 版：找可見未訪目標（依 Target Scoring）→ 找不到且站在攤位格就 exitStep → 否則跟隨可見同伴 → 都沒有就隨機走",
     "ref": "99_spec/isovist_algorithm.md#touristStep",
     "impl": "agents/tourist.js#move",
     "status": "implemented"
    },
    "isVisible": {
     "desc": "可見性判定：牆、設施、建物、任何攤位格（終點除外）擋視線，走道格上的椅子不擋視線（只影響通行）；半徑上限 100 m ≈ 50 格；同一套也用在看其他 Tourist",
     "params": {
      "VISION_RADIUS_CELLS": {
       "value": 50,
       "unit": "cell",
       "note": "100 m ÷ 2 m/格"
      }
     },
     "impl": "agents/tourist.js#isVisible",
     "status": "implemented"
    },
    "heatBonus": {
     "desc": "Target Scoring：分數＝距離−heatBonus(熱度)，最小者勝出、同分隨機；熱度讀 touristTrailHeat。Tourist 目前固定走 E人分支",
     "params": {
      "HEAT_BONUS_TIERS": {
       "value": {
        "E": [
         [
          25,
          3
         ],
         [
          10,
          2
         ],
         [
          1,
          1
         ]
        ],
        "I": [
         [
          25,
          -3
         ],
         [
          10,
          -2
         ],
         [
          1,
          -1
         ]
        ]
       },
       "unit": "[熱度門檻, 加成]，由大到小比對，沒中任何一級＝0",
       "note": "只有 E 欄位被程式碼使用"
      }
     },
     "dispatchedBy": "personality",
     "impl": "agents/tourist.js#heatBonus",
     "status": "implemented"
    },
    "findVisibleTarget": {
     "desc": "看得到、未訪的同類目標裡 score 最小者",
     "impl": "agents/tourist.js#findVisibleTarget",
     "status": "implemented"
    },
    "findVisiblePeer": {
     "desc": "跟隨 fallback：找看得到的其他 Tourist（純距離、不加熱度）",
     "impl": "agents/tourist.js#findVisiblePeer",
     "status": "implemented"
    }
   }
  },
  "Vendor": {
   "id": "Vendor",
   "label": "攤販（New／Old／Idle 的共同基礎）",
   "note": "三者都不連續走路，狀態變化只有離散判定（固定不動／搬遷）。無共用屬性；共用 method 只有 chairRule（營業中的店）；Vendor (Idle) 依 generation 直接呼叫 Vendor (New) 的 relocationJudgement()。生存判定以店鋪（同 code 分組）為單位，不是個別 grid 格。",
   "attributes": {},
   "rules": {
    "chairRule": {
     "desc": "每個 beat 對每家有椅子可以往外擺的店（code 出現在 ERA_DATA.cells['r,c'].occupiedBy 靜態清單）各自判斷：店有營業且 dayBeat 在 [CHAIR_START_BEAT, CHAIR_END_BEAT) → 把自己的 code 加進清單內走道格的 Cell.occupiedBy（每格每店最多一張）；否則移除。不記憶、不緩衝，每個 beat 只看店當下的營業狀態；endOfDay 不需另外處理。occupiedBy 非空 → mobility＝Chair_Mobility，空了回完全開放。適用營業中的店（Vendor (New)／(Old)），Vendor (Idle) 不適用；沒有屬性讓規則分岔",
     "params": {
      "CHAIR_START_BEAT": {
       "value": 16,
       "unit": "beat",
       "note": "一天 DAY_LENGTH_BEATS＝96 個 beat 內，擺椅起點，全域一組"
      },
      "CHAIR_END_BEAT": {
       "value": 80,
       "unit": "beat",
       "note": "擺椅終點（不含），全域一組"
      }
     },
     "writes": [
      "Cell.occupiedBy",
      "Cell.mobility"
     ],
     "source": "2026-10-02 課堂筆記（佔據一定跟空間有關，一條一條加反應規則）",
     "status": "planned"
    }
   }
  },
  "VendorIdle": {
   "id": "VendorIdle",
   "extends": "Vendor",
   "label": "已關門的攤販（不分新舊），世代屬性繼承自關門前",
   "attributes": {
    "generation": {
     "desc": "老／新，繼承自關門前，決定 stepTick() 走哪個分支",
     "variants": [
      {
       "adjective": "一間曾經是老字號、現在歇業的店面",
       "when": "generation == old",
       "effect": [
        "走 VendorOld 的 fixed 規則，完全靜止（目前不會被觸發）"
       ]
      },
      {
       "adjective": "一間曾經是新創、現在歇業的店面",
       "when": "generation == new",
       "effect": [
        "先擲 REOPEN_PROB 重開",
        "沒重開走 VendorNew.relocationJudgement"
       ]
      }
     ],
     "status": "implemented"
    }
   },
   "rules": {
    "reopen": {
     "desc": "世代＝新：每輪擲 REOPEN_PROB 重新開幕變回 Vendor (New)，人氣、搬遷倒數全歸零；沒重開才搬遷（搬過去仍是已關門狀態）",
     "params": {
      "REOPEN_PROB": {
       "value": 0.09,
       "unit": "prob/tick",
       "note": "沿用 BASE_IDLE 數字，自訂、可覆寫"
      }
     },
     "dispatchedBy": "generation",
     "impl": "agents/vendorIdle.js#stepTick",
     "status": "implemented"
    }
   }
  },
  "VendorNew": {
   "id": "VendorNew",
   "extends": "Vendor",
   "label": "正常營業中的新創攤位，自己不走路，但會被隨機重新安置",
   "note": "人氣／冷清度記在店鋪（同 code 分組，這次租期），不是攤販身分本身；搬家即歸零重算。",
   "attributes": {
    "popularity": {
     "desc": "人氣＝visitHist 近 HEAT_WINDOW 輪到訪次數之和",
     "params": {
      "HEAT_WINDOW": {
       "value": 2,
       "unit": "tick"
      }
     },
     "variants": [
      {
       "adjective": "一間普通的攤位",
       "when": "popularity < HEAT_HOT_THRESHOLD && coldStreak < COLD_STREAK_THRESHOLD",
       "effect": [
        "走平常關門機率 BASE_IDLE"
       ]
      },
      {
       "adjective": "一間搶手的攤位（人氣旺）",
       "when": "popularity >= HEAT_HOT_THRESHOLD",
       "effect": [
        "關門機率降為 HOT_IDLE",
        "Relocation 暫停倒數、留在原地"
       ]
      },
      {
       "adjective": "一間乏人問津的攤位（冷清）",
       "when": "coldStreak >= COLD_STREAK_THRESHOLD",
       "effect": [
        "關門機率升為 COLD_IDLE"
       ]
      }
     ],
     "status": "implemented"
    },
    "coldStreak": {
     "desc": "冷清度＝zeroStreak，連續無到訪的輪數",
     "params": {
      "COLD_STREAK_THRESHOLD": {
       "value": 3,
       "unit": "tick",
       "note": "文件沒留原始數字，自訂、可覆寫"
      }
     },
     "status": "implemented"
    },
    "closeProbability": {
     "desc": "關門機率，依 popularity／coldStreak 分支",
     "params": {
      "BASE_IDLE": {
       "value": 0.09,
       "unit": "prob/tick"
      },
      "HOT_IDLE": {
       "value": 0.04,
       "unit": "prob/tick"
      },
      "COLD_IDLE": {
       "value": 0.25,
       "unit": "prob/tick"
      },
      "HEAT_HOT_THRESHOLD": {
       "value": 2,
       "unit": "人氣",
       "note": "人氣旺門檻"
      }
     },
     "status": "implemented"
    }
   },
   "rules": {
    "idleJudgement": {
     "desc": "關門判定：依 closeProbability 擲骰",
     "impl": "agents/vendorNew.js#idleJudgement",
     "status": "implemented"
    },
    "relocationJudgement": {
     "desc": "人氣 ≥ HEAT_HOT_THRESHOLD → 暫停倒數；否則 moveTimer−1，≤0 時若有空店鋪依 Site Fertility Weighting 加權挑一間搬過去、原位變空店鋪，沒有空店鋪就重設倒數。不連續移動，不加 isovist。Vendor (Idle) 世代＝新時也呼叫這個方法",
     "params": {
      "MOVE_MIN_TICK": {
       "value": 1,
       "unit": "tick"
      },
      "MOVE_MAX_TICK": {
       "value": 4,
       "unit": "tick",
       "note": "倒數重設值隨機 MOVE_MIN~MOVE_MAX"
      }
     },
     "impl": "agents/vendorNew.js#relocationJudgement",
     "status": "implemented"
    },
    "siteFertility": {
     "desc": "空店鋪搬遷權重 weight＝heat（店鋪格 touristTrailHeat+residentTrailHeat 總和，不衰減）＋ corridorFrontage×FRONTAGE_SCALE（建築先天條件）＋ FERTILITY_BASE_WEIGHT（避免全 0 死鎖）",
     "params": {
      "FERTILITY_BASE_WEIGHT": {
       "value": 1,
       "unit": "weight",
       "note": "底線權重"
      },
      "FRONTAGE_SCALE": {
       "value": 3,
       "unit": "weight/frontage",
       "note": "corridorFrontage(0~1)換算倍率，自訂、可覆寫"
      }
     },
     "reads": [
      "Cell.corridorFrontage"
     ],
     "impl": "agents/vendorNew.js#shopFertility | agents/vendorNew.js#pickFertileBlank",
     "status": "implemented"
    },
    "stepTick": {
     "desc": "逐輪：updateHeatHistory → idleJudgement → relocationJudgement",
     "impl": "agents/vendorNew.js#stepTick",
     "status": "implemented"
    },
    "initStall": {
     "desc": "moveTimer／visitHist／zeroStreak 歸零",
     "impl": "agents/vendorNew.js#initStall",
     "status": "implemented"
    },
    "heatOf": {
     "desc": "讀 popularity",
     "impl": "agents/vendorNew.js#heatOf",
     "status": "implemented"
    },
    "updateHeatHistory": {
     "desc": "更新 visitHist／zeroStreak",
     "impl": "agents/vendorNew.js#updateHeatHistory",
     "status": "implemented"
    }
   }
  },
  "VendorOld": {
   "id": "VendorOld",
   "extends": "Vendor",
   "label": "正常營業中的老攤商，位置永久固定",
   "attributes": {
    "fixed": {
     "desc": "沒有關門判定，位置也永久固定",
     "variants": [
      {
       "adjective": "一間屹立不搖、永遠不會倒的老店",
       "when": "always",
       "effect": [
        "Fixed Rule：不移動、無搬遷判定"
       ]
      }
     ],
     "status": "implemented"
    }
   },
   "rules": {
    "fixed": {
     "desc": "恆常固定：永久不移動、無任何搬遷判定。Vendor (Idle) 世代＝老時邏輯等同這條（目前不會被觸發）",
     "impl": "agents/vendorOld.js#stepTick（空實作）",
     "status": "implemented"
    }
   }
  },
  "Cell": {
   "id": "Cell",
   "label": "市場網格本身；World.cellSpace 與 cellType 同尺寸，每個攤位格各存一份屬性物件，其餘格型存 null",
   "attributes": {
    "corridorFrontage": {
     "desc": "這一格 4 個方向裡臨走道／入口格的邊數比例（0~1）；位置固定，不隨進駐攤販或搬遷改變。店鋪彙總＝所屬格子平均值，存 shop.corridorFrontage",
     "formula": "aisleEdges / 4",
     "variants": [
      {
       "adjective": "一個緊臨走道的店鋪",
       "when": "corridorFrontage 高",
       "effect": [
        "siteFertility 先天權重高，沒用過也容易被選中"
       ]
      },
      {
       "adjective": "一個被夾在店鋪之間的格子",
       "when": "corridorFrontage 低",
       "effect": [
        "siteFertility 先天權重低，得靠行為痕跡累積"
       ]
      }
     ],
     "impl": "agents/cell.js#buildCellSpace | agents/cell.js#frontageOf | agents/cell.js#shopFrontage",
     "status": "implemented"
    },
    "mobility": {
     "desc": "可變動性：這一格（Block）開放或封閉、整個東西會不會動；定義的是 Block，不是攤販本身。取代「結構」一詞（會被問柱子還是形體）；用 mobility，不用 portable",
     "candidates": [
      "完全開放",
      "半開放",
      "封閉",
      "流動攤車",
      "Chair_Mobility"
     ],
     "implemented": [
      "完全開放",
      "Chair_Mobility"
     ],
     "variants": [
      {
       "adjective": "一個開放的走道格（完全開放）",
       "when": "mobility == 完全開放",
       "effect": [
        "passableFor 照走道處理，可通行"
       ]
      },
      {
       "adjective": "一個椅子還沒擠滿的走道格（Chair_Mobility）",
       "when": "mobility == Chair_Mobility 且 椅子數 < CHAIR_BLOCK_COUNT",
       "effect": [
        "passableFor 可通行，一張椅子不擋路"
       ]
      },
      {
       "adjective": "一個被椅子擋住的走道格（Chair_Mobility）",
       "when": "mobility == Chair_Mobility 且 椅子數 ≥ CHAIR_BLOCK_COUNT",
       "effect": [
        "passableFor 視同牆，行人繞開"
       ]
      }
     ],
     "source": "2026-10-02 課堂筆記（以可變動性為單一軸線往下細分）",
     "replaces": "STALL_STRUCTURE（移動攤販／半開放／鐵門封閉），程式碼尚未改名",
     "impl": "agents/cell.js#buildCellSpace",
     "status": "implemented"
    },
    "occupiedBy": {
     "desc": "走道格 mobility＝Chair_Mobility（椅子）時，目前在這格擺椅的店鋪 code 清單（一家一張，兩家共用的用餐區可有兩個）；椅子數＝清單長度；平常為空",
     "source": "使用者 2026-10-04 在 QGIS aisle.occupied_by 標定 33 格，經 adapter_era_data.py 輸出到 ERA_DATA",
     "impl": "agents/cell.js#buildCellSpace",
     "status": "implemented"
    },
    "orientation": {
     "desc": "方向性",
     "source": "2026-10-02 課堂筆記",
     "status": "planned"
    }
   },
   "rules": {
    "note": "Cell 不定義自己的規則，只提供量化值；使用它的判斷邏輯放對應 agent 的 Rule（例如 VendorNew.siteFertility）"
   }
  }
 }
};
