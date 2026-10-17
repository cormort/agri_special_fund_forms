# 農業特別收入基金 表單定義（agri_special_fund_forms）

農業部「農業特別收入基金」年度預算查填表單的**獨立公開定義包**：
6 個分基金 × 25 張表（業務計畫甲／乙、員額、用人費用、其他管制項目）的欄位、層級、
預設金額、官方來源檔與映射設定，全部以資料形式保存，並附驗證工具與唯讀線上預覽。

本包**不含**編輯引擎。需要實際填報、自動加總、自動存檔、匯出 JSON／Word（.doc）、
上傳官方 xlsx 對帳、填寫審核意見，請搭配
[local_gov_budget](https://github.com/cormort/local_gov_budget)。

- 線上表單預覽（GitHub Pages）：<https://cormort.github.io/agri_special_fund_forms/>

---

## 為什麼要拆出來

| | 本 repo | local_gov_budget |
|---|---|---|
| 角色 | **表單定義 + 預設資料 + 官方檔 + 映射 profile** | 編輯引擎（UI、加總、存檔、匯出、xlsx 匯入） |
| 變動頻率 | 每年／每次官方檔更新（資料） | 功能開發（程式） |
| 內容型態 | JSON／xlsx，可被任何工具讀取 | HTML/JS 應用（約 1,860 行的引擎） |
| 使用方式 | 驗證、預覽、被引擎載入 | 開瀏覽器填報 |

拆開後：換年度只動資料與 profile；引擎的修改不會覆蓋表單內容；其他機關或工具也能直接取用
這份定義，不必整包複製前端。

---

## 目錄

```
agri_special_fund_forms/
├── forms/agri-special-fund.json     # ★ 表單定義（欄位、25 張表、基金、規則）
├── schema/form.schema.json          # 上述定義的 JSON Schema（draft-07 子集）
├── data/sample_fund_*.json          # 6 個分基金的預設值（引擎的初始資料）
├── official/FNGBRB5300_*.xlsx       # 官方彙總檔（金額來源，單位：元）
├── profiles/FNGBRB5300.json         # 官方檔 → 表格欄位 的映射設定
├── tools/validate.mjs               # 定義／資料一致性檢查（零依賴）
├── demo/index.html                  # 唯讀預覽（實際部署在 GitHub Pages）
├── index.html                       # Pages 入口，自動導向 demo/
├── package.json                     # 只有 npm run validate / serve 兩個指令
├── LICENSE                          # Apache-2.0
└── DECISIONS.md                     # 拆分決定、Pages 設定、未做事項
```

---

## 快速開始

```bash
# 1) 檢查定義與資料是否一致（無外部依賴，不需要 npm install）
node tools/validate.mjs
#   ✓ 表單定義驗證通過
#   {"forms":"agri-special-fund","version":"1.0.0","tables":25,"columns":12,"funds":6,"dataFiles":6,"rows":254}

# 2) 看表單長什麼樣（唯讀）
python3 -m http.server 8000
# → http://127.0.0.1:8000/demo/
```

> 預覽頁用 `fetch()` 讀 JSON，所以需要 http；直接雙擊 `file://` 會被瀏覽器擋。
> 線上版：<https://cormort.github.io/agri_special_fund_forms/>
> （Pages 來源 = `main` / `(root)`，根目錄 `index.html` 用 meta refresh 導到 `demo/`）

---

## 資料模型

### `forms/agri-special-fund.json`

| 欄位 | 說明 |
|---|---|
| `schemaVersion` | 定義格式版本（目前 `1.0.0`） |
| `meta` | 標題、年度、機關、表號（1-2／1-3／1-4）、單位、官方來源檔與 profile 路徑 |
| `columns` | 欄位字典：`label`（表頭）、`type`（number/text/textarea/level）、`auto`（核列自動計算） |
| `funds` | 6 個分基金：`id`／`code`／`name`／`short`／`rank` |
| `sections` | `src`＝甲、基金來源；`use`＝乙、基金用途 |
| `tabs` | 三個分頁與其審核意見鍵（plan／personnel／control） |
| `rules` | 核列公式、母列加總欄位、不加總的關鍵字（收購糧食、糧食銷售） |
| `tables` | 25 張表：`cols`（顯示順序）、`hasLevel`、`sheetId`、`unit`、`reviewKey`，業務計畫表另有 `fundCode`／`section`／`isPlan` |
| `data` | 各基金對應的預設資料檔 |

### `data/sample_fund_*.json`

沿用引擎的資料形狀（引擎可直接吃）：

```json
{ "meta": { "fund": "農發基金（模擬）", "year": "116" },
  "tables": { "plan_agri_use": [ { "level": 1, "name": "提升農業經營及發展計畫",
                                   "dec113": "16085485.42", "bud114": "18683875" } ] } }
```

- 金額以「字串」存（避免浮點誤差），單位為新臺幣千元；員額表為人。
- `level`：0＝甲／乙段落、1＝一、二、…、2＝計畫名／(一)、3＝1.／2.、4＝(1)／(2)。
- 業務計畫表的母列不一定要有值：引擎與預覽都會用**直屬子列**加總母列；
  子列皆無值時保留母列原值。`其他`、`購建固定資產` 是人工分類列，不參與官方檔比對。
- 每張表都是完整陣列；空表也要保留空陣列（例如 `personnel_cost_disaster`），不要刪掉 key。

### `profiles/FNGBRB5300.json`

把官方彙總檔（基金 × 計畫的寬表，單位元）映到表單欄位的規則：

- `scale: 1000`：元 → 千元
- `sectionSplit`：以「基金來源」「基金用途」兩欄的位置切開甲／乙分支，避免跨分支誤配
- `ignoreNames`：`其他`、`購建固定資產` 永不對應
- `minNameLength: 3`：短名稱不做寬鬆比對（否則「其他」會撞上「其他收入」）
- `nameAliases`：官方改名的必要對應，例如
  `綠色環境給付計畫` → `農糧產業調整與轉型計畫(原為「綠色環境給付計畫」)`

> 引擎以 `file://` 執行、無法 `fetch` JSON，所以 profile 會經 `npm run sync:forms`
> 產生到引擎的 `vendor/forms/xlsx-profiles.js`（`<script>` 載入）。
> **本 repo 的 `profiles/FNGBRB5300.json` 是唯一來源**，引擎那份是產生檔，不要手改。

---

## 與引擎的關係

```
本 repo（唯一來源）── npm run sync:forms ──▶ local_gov_budget/vendor/forms/*.js ──▶ 引擎
```

在 `local_gov_budget` 端：

| 指令 | 作用 |
|---|---|
| `npm run sync:forms` | 讀本 repo 的 `forms/`、`profiles/`、`data/`，產生 `vendor/forms/*.js` |
| `npm run sync:forms -- --from <path>` | 指定本 repo 的本地路徑（預設 `../agri_special_fund_forms`） |
| `npm run check:forms` | 漂移檢查：不一致就 exit 1（適合放 CI） |

注意：引擎在 http 模式會優先載入自己根目錄的 `sample_fund_*.json` 副本，
所以改了 `data/` 之後，**引擎的副本也要一起更新**（或由引擎端以該副本為準再 sync）。

---

## 換年度／更新官方資料

1. 把新的官方彙總檔放進 `official/`，必要時更新 `meta.source.officialFile`。
2. 若有欄名變動，更新 `profiles/FNGBRB5300.json` 的 `nameAliases`（或 `ignoreNames`）。
3. 用 `local_gov_budget` 的「📊 匯入官方 xlsx」跑一次，確認差異清單沒問題後套用
   （引擎可下載 `mapping-report_*.json` 留紀錄）。
4. 把新數字同步回 `data/sample_fund_*.json`：用引擎的 `sample-editor.html`
   逐基金載入、貼上／調整、下載後覆蓋 `data/` 的檔案。
5. `node tools/validate.mjs` 應維持通過（警告可用來追蹤資料品質）。
6. 到引擎端跑 `npm run sync:forms`（並更新引擎根目錄的 `sample_fund_*.json` 副本）。
7. 年度字樣散落在 `meta.year`、各表 `title`、`columns.*.label`（例如「115年度預算」）——
   換年度時要一起改。這些刻意寫成資料，改它們不用改程式。

---

## 驗證工具做了什麼

`node tools/validate.mjs`

1. **結構**：`forms` 是否符合 `schema/form.schema.json`（內建小型 JSON Schema 子集驗證器，無需安裝套件）
2. **語意**：表格 id 唯一、欄位都存在、`reviewKey` 對得到分頁、業務計畫表的
   `plan_{fundCode}_{section}` 命名與基金 rank 一致、表格數＝25
3. **資料**：每個資料檔的表格都屬於該基金、列只使用已定義欄位、`level` 合法、
   母列金額＝直屬子列加總（`noAutoSumKeywords` 例外）
4. **來源**：官方檔與 profile 存在、profile 的基金名稱與 `forms.funds` 一致、
   `valueKey`／`scale`／`tableTemplates` 可解析

目前輸出：25 張表、12 個欄位、6 個基金、6 個資料檔、254 列，**12 個警告**——
都是同一件事：`data/*.json` 保留了 113 年度決算（`dec112`）但表單不顯示。

---

## 已知限制

- **兩張表是空的**：`data/sample_fund_disaster.json` 的 `personnel_cost_disaster`、
  `data/sample_fund_fish.json` 的 `personnel_cost_fish` 是空陣列；引擎端會顯示空表
  （先前是用佔位假資料填充，已移除）。若確實該有內容，請補在 `data/`。
- `dec112`（113 年度決算）仍存在於 `data/*.json`，但表單不顯示、驗證只給警告。
  確定不再需要時可整批移除，警告就會消失。
- 員額、用人費用、其他管制項目的官方來源是 **FNGBRB5320 詳細表**，該檔不在 repo 內，
  這 13 張表的預設值目前是既有資料，尚未有可重複執行的自動更新路徑。
- 年度字樣與金額欄標籤目前不一致（表單標題 116 年度、金額欄是 115 年度預算），
  這是「編製 116 年度、金額基準為官方 115 年度預算數」的結果，換年度時要三處一起改。
- 本包沒有版本化的資料歷史；正式的預算版本控管請在引擎端或另建資料庫處理。

---

## 授權與資料來源

- 程式與定義：Apache-2.0（見 `LICENSE`）。
- `official/` 內的官方預算檔取自政府公開資訊；數字本身為公務預算，供查填與核對使用。
  引用時請保留原始檔名與年度。
