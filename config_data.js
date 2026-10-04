// 由 99_config/build_config.js 產生，不要手改；改 99_config/**/*.json 後重跑腳本。
const CONFIG = {
 "params": {
  "TIME_BANDS": [
   [
    4,
    6,
    0.5,
    0.1
   ],
   [
    6,
    9,
    2,
    0.3
   ],
   [
    9,
    11,
    1.5,
    0.8
   ],
   [
    11,
    13,
    1,
    2
   ],
   [
    13,
    16,
    0.4,
    1
   ],
   [
    16,
    19,
    1.5,
    1.5
   ],
   [
    19,
    20,
    0.3,
    0.3
   ]
  ],
  "WALK_SPEED_MPS": 1,
  "CELL_SIZE_M": 1,
  "GIVEUP_SEC": 1800,
  "CHAIR_SLOW_SEC": 1,
  "PASS_COST_OPEN": 1,
  "PASS_COST_CHAIR": 2,
  "DENSITY_RADIUS": 2,
  "CROWD_THRESHOLD": 4,
  "JAM_THRESHOLD": 8,
  "CROWD_SLOW_SEC": 1,
  "JAM_GIVEUP_EXTRA": 1,
  "SIT_SEC": 1200,
  "MEAL_HOURS": [
   [
    11,
    13
   ],
   [
    17,
    19
   ]
  ],
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
  "CHAIR_ATTRACT_BONUS": 2,
  "VIS_ATTRACT_BONUS": 1,
  "CHAIR_START_HOUR": 4,
  "CHAIR_END_HOUR": 20,
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
  "FRONTAGE_SCALE": 3,
  "VIS_FERTILITY_MID": 1,
  "VIS_FERTILITY_HIGH": 2,
  "VIS_LOW": 0.2,
  "VIS_HIGH": 0.6
 },
 "classes": {
  "Human": {
   "id": "Human",
   "label": "在市場走動找攤位的人（Tourist／Resident 的共同基礎）",
   "note": "Tourist／Resident 在程式碼裡是各自獨立的完整實作，共用規則",
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
     "desc": "牆/設施不可通行；攤位格只有等於興趣目標類型才可通行，否則視同牆；走道、入口可通行，走道格上的椅子不影響通行",
     "impl": "agents/tourist.js#passableFor | agents/resident.js#passableFor",
     "status": "implemented"
    },
    "spawnExpected": {
     "desc": "從入口格（World.entryCells）均勻隨機生成；數量隨興趣目標類型的營業店鋪數增加，另乘外部事件倍率（見 simulator_setting）；再乘時間波段倍率 timeBandMultiplier(agent, 時刻)＝波段倍率，不正規化（0 休市、<1 離峰、1 基準、>1 尖峰；尚未實作）",
     "params": {
      "TIME_BANDS": {
       "value": [
        [
         4,
         6,
         0.5,
         0.1
        ],
        [
         6,
         9,
         2,
         0.3
        ],
        [
         9,
         11,
         1.5,
         0.8
        ],
        [
         11,
         13,
         1,
         2
        ],
        [
         13,
         16,
         0.4,
         1
        ],
        [
         16,
         19,
         1.5,
         1.5
        ],
        [
         19,
         20,
         0.3,
         0.3
        ]
       ],
       "unit": "[起, 終) 小時、Resident 倍率、Tourist 倍率",
       "note": "區間外（20–04）倍率 0；高峰：早市 06–09、午間 11–13（Tourist）、傍晚 16–19；設計假設非實測，依傳統市場上午與傍晚高峰＋本專案 MEAL_HOURS／擺椅時段；自訂值，可覆寫"
      }
     },
     "impl": "agents/tourist.js#spawnExpected | agents/resident.js#spawnExpected",
     "status": "implemented"
    },
    "movementSpeed": {
     "desc": "物理參考常數：1 步＝走 1 格＝1 秒（1 m ÷ 1 m/s），時間系統見 simulator_setting.md「時間系統」",
     "params": {
      "WALK_SPEED_MPS": {
       "value": 1,
       "unit": "m/s",
       "note": "Gehl 設計步速"
      },
      "CELL_SIZE_M": {
       "value": 1,
       "unit": "m",
       "note": "研究範圍網格 1 格 = 1 m"
      }
     },
     "status": "reference"
    },
    "giveupRule": {
     "desc": "ticksSinceProgress（距上次到訪新攤位的步數＝秒數）達 GIVEUP_SEC 就離場；到訪新攤位歸零",
     "params": {
      "GIVEUP_SEC": {
       "value": 1800,
       "unit": "sec",
       "note": "30 分鐘；Tourist、Resident 共用；自訂值，可覆寫"
      }
     },
     "impl": "agents/tourist.js#move | agents/resident.js#move（inline）",
     "status": "implemented"
    },
    "exitStep": {
     "desc": "站在攤位格裡又沒有下一個目標 → 多來源 BFS（起點＝全走道格）走最近走道出去，不閒晃",
     "impl": "agents/tourist.js#exitStep | agents/resident.js#exitStep",
     "status": "implemented"
    },
    "chairSlowdown": {
     "desc": "Chair Slowdown Rule：走進有椅子的走道格（Chair_Mobility：擺椅時段內且 Cell.occupiedBy 裡有營業中的店）→ 在那格多停 CHAIR_SLOW_SEC 秒（步）才能再移動；椅子不擋路也不擋視線；停留期間 ticksSinceProgress 照常累加",
     "params": {
      "CHAIR_SLOW_SEC": {
       "value": 1,
       "unit": "sec",
       "note": "自訂值，可覆寫"
      }
     },
     "reads": [
      "Cell.occupiedBy",
      "shop.state",
      "daySec"
     ],
     "impl": "agents/cell.js#slowIfChair | agents/cell.js#tickPause | agents/tourist.js#move | agents/resident.js#move",
     "status": "implemented"
    },
    "chairTieBreak": {
     "desc": "Chair Avoidance Rule：選下一步時若多個鄰格走場值一樣小 → 優先選沒有椅子的格子（非 Chair_Mobility）；只是平手偏好，不繞遠路，不改尋路方式",
     "reads": [
      "Cell.occupiedBy"
     ],
     "impl": "agents/cell.js#preferNoChair | agents/tourist.js#greedyStepToward | agents/tourist.js#bestStepByField | agents/resident.js#bestStepByField",
     "status": "implemented"
    },
    "passCostPath": {
     "desc": "Pass Cost Rule：路徑成本＝路徑上每格 Cell.passCost 總和；Resident 的 BFS 取成本最小路徑，繞路額外步數少於穿過去多出的成本才繞，否則穿過並照 chairSlowdown 多停；牆／設施／不符興趣的攤位不算成本，仍由 passableFor 擋。Tourist 沿用貪婪選步，只受 chairTieBreak 影響",
     "params": {
      "PASS_COST_OPEN": {
       "value": 1,
       "unit": "cost",
       "note": "完全開放走道格；自訂值，可覆寫"
      },
      "PASS_COST_CHAIR": {
       "value": 2,
       "unit": "cost",
       "note": "Chair_Mobility 走道格；自訂值，可覆寫"
      }
     },
     "reads": [
      "Cell.passCost"
     ],
     "impl": "agents/resident.js#passCostPath",
     "status": "planned"
    },
    "crowdRule": {
     "desc": "Crowd Rule：所在格 density 未達 CROWD_THRESHOLD 不受影響；達到且未超過 JAM_THRESHOLD → 多停 CROWD_SLOW_SEC 秒；超過 JAM_THRESHOLD（塞住）→ 不再多停，每步 ticksSinceProgress 額外加 JAM_GIVEUP_EXTRA。Tourist、Resident 相同，不看個性；人多不會讓人想靠近（靠近熱鬧的是 Tourist.heatBonus）",
     "params": {
      "DENSITY_RADIUS": {
       "value": 2,
       "unit": "cell",
       "note": "density 計算範圍；自訂值，可覆寫"
      },
      "CROWD_THRESHOLD": {
       "value": 4,
       "unit": "人",
       "note": "自訂值，可覆寫"
      },
      "JAM_THRESHOLD": {
       "value": 8,
       "unit": "人",
       "note": "自訂值，可覆寫"
      },
      "CROWD_SLOW_SEC": {
       "value": 1,
       "unit": "sec",
       "note": "自訂值，可覆寫"
      },
      "JAM_GIVEUP_EXTRA": {
       "value": 1,
       "unit": "每步加量",
       "note": "自訂值，可覆寫"
      }
     },
     "reads": [
      "Cell.density"
     ],
     "impl": "agents/tourist.js#move | agents/resident.js#move（inline）",
     "status": "planned"
    },
    "chairSeating": {
     "desc": "Chair Seating Rule：成功到訪新店鋪的當下，若用餐時間（當天時刻落在 MEAL_HOURS 任一小時區間）且該店有擺出椅子、seatsTaken < 座位數 → 坐下：seatsTaken+1，原地停留 SIT_SEC 秒（步），停完 seatsTaken−1；否則不坐照原本逛完就走；滿座時走到門口仍算到訪（visited 照加、ticksSinceProgress 照歸零）；停留期間 ticksSinceProgress 照常累加。daySec（當天第幾秒）定義同 Vendor.chairRule，由呼叫端傳入",
     "params": {
      "SIT_SEC": {
       "value": 1200,
       "unit": "sec",
       "note": "20 分鐘；自訂值，可覆寫"
      },
      "MEAL_HOURS": {
       "value": [
        [
         11,
         13
        ],
        [
         17,
         19
        ]
       ],
       "unit": "[起, 終) 小時區間",
       "note": "用餐時間 11:00～13:00、17:00～19:00，全域一組；Tourist.chairBonus 共用；自訂值，可覆寫"
      }
     },
     "reads": [
      "Cell.occupiedBy",
      "Vendor.seatsTaken"
     ],
     "writes": [
      "Vendor.seatsTaken"
     ],
     "impl": "agents/cell.js#trySit | agents/cell.js#hasSeat | agents/cell.js#release | agents/tourist.js#move | agents/resident.js#move",
     "status": "implemented"
    }
   }
  },
  "Resident": {
   "id": "Resident",
   "extends": "Human",
   "label": "熟悉市場的在地居民",
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
   "label": "想逛新創攤位的訪客",
   "attributes": {
    "personality": {
     "desc": "人格特質E人（常數，程式碼沒有存成欄位）",
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
     "desc": "可見性判定：牆、設施、建物、任何攤位格（終點除外）擋視線；半徑上限 100 m ≈ 50 格；同一套也用在看其他 Tourist",
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
     "desc": "Target Scoring：分數＝距離−heatBonus(熱度)−chairBonus(店)−visBonus(店)，最小者勝出、同分隨機；熱度讀 touristTrailHeat。Tourist 目前固定走 E人分支",
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
    "chairBonus": {
     "desc": "Target Scoring 的椅子加分：分數＝距離−heatBonus−chairBonus；用餐時間（Human.chairSeating 的 MEAL_HOURS）且該店鋪有擺出椅子、seatsTaken < 座位數 → 減掉 CHAIR_ATTRACT_BONUS（店感覺比較近）；非用餐時間、沒擺椅子、或座位已滿 → 0，滿座的店失去吸引力。只有 Tourist 套用，Resident 純看距離",
     "params": {
      "CHAIR_ATTRACT_BONUS": {
       "value": 2,
       "unit": "分數",
       "note": "自訂值，可覆寫；不隨椅子數增加"
      }
     },
     "reads": [
      "Cell.occupiedBy",
      "Vendor.seatsTaken"
     ],
     "impl": "agents/tourist.js#chairBonus",
     "status": "implemented"
    },
    "visBonus": {
     "desc": "Target Scoring 的可見度加分：分數＝距離−heatBonus−chairBonus−visBonus；店鋪 visibility 超過 VIS_HIGH（顯眼）→ 減掉 VIS_ATTRACT_BONUS，固定值不隨 visibility 增加；隱蔽與一般 → 0（沒有扣分）。只有 Tourist 套用，Resident 不看",
     "params": {
      "VIS_ATTRACT_BONUS": {
       "value": 1,
       "unit": "分數",
       "note": "自訂值，可覆寫"
      }
     },
     "reads": [
      "Cell.visibility"
     ],
     "impl": "agents/tourist.js#visBonus",
     "status": "planned"
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
   "note": "三者都不連續走路，狀態變化只有離散判定（固定不動／搬遷）。共用屬性只有 seatsTaken；共用 method 只有 chairRule（椅子是否擺出，看時間與店鋪營業狀態）；Vendor (Idle) 依 generation 直接呼叫 Vendor (New) 的 relocationJudgement()。生存判定以店鋪（同 code 分組）為單位，不是個別 grid 格。",
   "attributes": {
    "seatsTaken": {
     "desc": "這家店目前已坐下的人數，起始 0；座位數＝擺椅時段內 occupiedBy（QGIS 標定）含該店 code 的走道格數（一張椅子一個座位，時段外或這家店沒營業為 0），由時間、營業狀態與 occupiedBy 算出、不另存；Human.chairSeating 坐下加 1、停留結束減 1；重設模擬時歸零；擺椅時段結束後已坐的人照原停留計時走完；座位數與 seatsTaken 跟著位置 code 走（搬遷不改 code）",
     "variants": [
      {
       "adjective": "一家還有空位的店",
       "when": "seatsTaken < 座位數",
       "effect": [
        "Tourist.chairBonus 有加分",
        "Human.chairSeating 讓人坐下"
       ]
      },
      {
       "adjective": "一家座位坐滿的店",
       "when": "seatsTaken ≥ 座位數",
       "effect": [
        "chairBonus 歸零，人改去別家",
        "走到門口的人照常算到訪、不坐"
       ]
      }
     ],
     "source": "2026-10-05 課堂筆記（椅子坐滿用餐時間人會去別家）",
     "status": "implemented",
     "impl": "agents/cell.js#seatsOf | agents/cell.js#trySit"
    }
   },
   "rules": {
    "chairRule": {
     "desc": "椅子是否擺出看時間與店鋪營業狀態：當天時刻在 [CHAIR_START_HOUR, CHAIR_END_HOUR)（小時）且該店有營業 → 走道格 occupiedBy（QGIS 標定清單）裡這家店有一張椅子；時段外或沒營業 → 沒有。「營業」＝店鋪狀態 new 或 old；blank 與 Vendor (Idle) 不擺；店鋪以位置 code 為準，搬遷只交換狀態不改 code。不寫入任何狀態：椅子狀態與座位數由時間＋營業狀態＋occupiedBy 當下算出，沒有重設或收椅處理。daySec＝當天第幾秒（程式的 Cell.daySec），由呼叫端傳入。mobility 由此推得。椅子不擋路也不擋視線，行人反應見 Human.chairSlowdown／chairTieBreak／chairSeating 與 Tourist.chairBonus。沒有屬性讓規則分岔",
     "params": {
      "CHAIR_START_HOUR": {
       "value": 4,
       "unit": "hour",
       "note": "擺椅起點 04:00，全域一組"
      },
      "CHAIR_END_HOUR": {
       "value": 20,
       "unit": "hour",
       "note": "擺椅終點 20:00（不含），全域一組"
      }
     },
     "reads": [
      "ERA_DATA.cells[r,c].occupiedBy",
      "daySec",
      "shop.state"
     ],
     "source": "2026-10-02 課堂筆記（佔據一定跟空間有關，一條一條加反應規則）",
     "status": "implemented",
     "impl": "agents/cell.js#chairsOut | agents/cell.js#isOpen | agents/cell.js#chairCount"
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
     "desc": "空店鋪搬遷權重 weight＝heat（店鋪格 touristTrailHeat+residentTrailHeat 總和，不衰減）＋ corridorFrontage×FRONTAGE_SCALE（建築先天條件）＋ visFertility（shop.visibility：未達 VIS_LOW 為 0、一般 VIS_FERTILITY_MID、超過 VIS_HIGH 為 VIS_FERTILITY_HIGH，固定值；尚未實作）＋ FERTILITY_BASE_WEIGHT（避免全 0 死鎖）",
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
      },
      "VIS_FERTILITY_MID": {
       "value": 1,
       "unit": "weight",
       "note": "可見度一般；自訂值，可覆寫"
      },
      "VIS_FERTILITY_HIGH": {
       "value": 2,
       "unit": "weight",
       "note": "可見度顯眼；隱蔽為 0；自訂值，可覆寫"
      }
     },
     "reads": [
      "Cell.corridorFrontage",
      "Cell.visibility"
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
     "desc": "可變動性：這一格（Block）開放或封閉、整個東西會不會動；定義的是 Block，不是攤販本身。走道格由時間、店鋪營業狀態與 occupiedBy 推得（擺椅時段內 occupiedBy 裡至少有一家有營業的店＝Chair_Mobility，否則完全開放）",
     "candidates": [
      "完全開放",
      "半開放",
      "封閉",
      "流動攤車",
      "Chair_Mobility"
     ],
     "variants": [
      {
       "adjective": "一個開放的走道格（完全開放）",
       "when": "擺椅時段外，或 occupiedBy 裡沒有營業中的店",
       "effect": [
        "passableFor 照走道處理，可通行"
       ]
      },
      {
       "adjective": "一個被店家擺了椅子的走道格（Chair_Mobility）",
       "when": "擺椅時段內，occupiedBy 裡至少有一家有營業的店",
       "effect": [
        "passableFor 照走道處理，行人照常通過",
        "Human.chairSlowdown：行人走進去多停 CHAIR_SLOW_SEC",
        "Human.chairTieBreak：距離一樣近時優先走沒椅子的格子"
       ]
      }
     ],
     "source": "2026-10-02 課堂筆記（以可變動性為單一軸線往下細分）",
     "replaces": "STALL_STRUCTURE（移動攤販／半開放／鐵門封閉）",
     "status": "implemented",
     "impl": "agents/cell.js#hasChair"
    },
    "occupiedBy": {
     "desc": "走道格上有資格擺椅的店鋪 code 清單（兩家共用的用餐區可有兩個），QGIS 標定（ERA_DATA.cells['r,c'].occupiedBy，值是 display_code），固定不變、不隨模擬改寫；只有這一份。椅子是否擺出看時間與店鋪營業狀態（見 Vendor.chairRule）",
     "source": "使用者 2026-10-04 在 QGIS aisle.occupied_by 標定 33 格，經 adapter_era_data.py 輸出到 ERA_DATA",
     "impl": "agents/cell.js#buildCellSpace",
     "status": "implemented"
    },
    "passCost": {
     "desc": "行人走進這格的成本，由 mobility 推得：完全開放＝PASS_COST_OPEN、Chair_Mobility＝PASS_COST_CHAIR；牆／設施等不可通行格不算成本（由 Human.passableFor 擋）。隨 mobility 變動，擺椅時段內變高、收攤後回到 1",
     "variants": [
      {
       "adjective": "一個好走的走道格",
       "when": "passCost 低（完全開放）",
       "effect": [
        "Human.passCostPath 照單位成本算，行人不會特地繞開"
       ]
      },
      {
       "adjective": "一個難走的走道格",
       "when": "passCost 高（Chair_Mobility）",
       "effect": [
        "Human.chairSlowdown 讓人多停",
        "Human.passCostPath 讓 Resident 的 BFS 在繞路不吃虧時改走別條"
       ]
      }
     ],
     "reads": [
      "Cell.mobility"
     ],
     "impl": "agents/cell.js#passCost",
     "status": "planned"
    },
    "density": {
     "desc": "這格周圍 DENSITY_RADIUS 格內的行人數（Tourist＋Resident 合計），每步依場上行人位置重算，不累積、不存歷史（累積的是 touristTrailHeat／residentTrailHeat）",
     "variants": [
      {
       "adjective": "一個冷清的格子",
       "when": "density < CROWD_THRESHOLD",
       "effect": [
        "Human.crowdRule 不介入"
       ]
      },
      {
       "adjective": "一個擁擠的格子",
       "when": "CROWD_THRESHOLD ≤ density ≤ JAM_THRESHOLD",
       "effect": [
        "Human.crowdRule 讓行人在這格多停 CROWD_SLOW_SEC"
       ]
      },
      {
       "adjective": "一個塞住的格子",
       "when": "density > JAM_THRESHOLD",
       "effect": [
        "Human.crowdRule 不再多停，每步 ticksSinceProgress 額外加 JAM_GIVEUP_EXTRA，更快放棄離場"
       ]
      }
     ],
     "impl": "agents/cell.js#density",
     "status": "planned"
    },
    "visibility": {
     "desc": "0～1：能看到這格的走道格數，除以全圖最大值；阻擋判定同 Tourist.isVisible（牆、設施、建物、任何攤位格擋視線，距離上限同監測範圍）；位置固定，阻擋物變了才重算。店鋪彙總＝所屬格子平均值，存 shop.visibility，設定時算一次。與 corridorFrontage 不同：後者只數臨走道的邊，這個數實際看得到的範圍",
     "params": {
      "VIS_LOW": {
       "value": 0.2,
       "unit": "0~1",
       "note": "低於 → 隱蔽；自訂值，可覆寫"
      },
      "VIS_HIGH": {
       "value": 0.6,
       "unit": "0~1",
       "note": "高於 → 顯眼；自訂值，可覆寫"
      }
     },
     "variants": [
      {
       "adjective": "一個藏在深處的店鋪",
       "when": "visibility < VIS_LOW",
       "effect": [
        "siteFertility 可見度項為 0",
        "Tourist.visBonus 為 0"
       ]
      },
      {
       "adjective": "一個普通能被看見的店鋪",
       "when": "VIS_LOW ≤ visibility ≤ VIS_HIGH",
       "effect": [
        "siteFertility 給 VIS_FERTILITY_MID",
        "Tourist.visBonus 為 0"
       ]
      },
      {
       "adjective": "一個顯眼的店鋪",
       "when": "visibility > VIS_HIGH",
       "effect": [
        "Tourist.visBonus 加分（固定值）",
        "siteFertility 給 VIS_FERTILITY_HIGH（固定值）"
       ]
      }
     ],
     "impl": "agents/cell.js#visibilityOf | agents/cell.js#shopVisibility",
     "status": "planned"
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
