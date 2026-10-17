# 農業特別收入基金 表單定義（agri_special_fund_forms）

農業部「農業特別收入基金」年度預算查填表單的**獨立公開定義包**：
6 個分基金 × 25 張表（業務計畫甲／乙、員額、用人費用、其他管制項目）的欄位、層級、
預設金額、官方來源檔與映射設定，全部以資料形式保存，並附驗證工具與唯讀預覽。

本包**不含**編輯引擎。需要實際填報、自動加總、自動存檔、匯出 Doc／CSV／XLSX、
上傳官方 xlsx 對帳、填寫審核意見，請搭配
[local_gov_budget](https://github.com/cormort/local_gov_budget)。

---

## 為什麼要拆出來

| | 本 repo | local_gov_budget |
|---|---|---|
| 角色 | **表單定義 + 預設資料 + 官方檔 + 映射 profile** | 編輯引擎（UI、加總、存檔、匯出、xlsx 匯入） |
| 變動頻率 | 每年／每次官方檔更新（資料） | 功能開發（程式） |
| 內容型態 | JSON／xlsx，可被任何工具讀取 | HTML/JS 應用 |
| 使用方式 | 驗證、預覽、被引擎載入 | 開瀏覽器填報 |

把表單拆開後：換年度只動資料與 profile；引擎的修改不會覆蓋掉表單內容；
其他機關或工具也能直接取用這份定義，不必整包複製一個 2400 行的前端。

---

## 目錄

```
agri_special_fund_forms/
├── forms/agri-special-fund.json     # ★ 表單定義（欄位、25 張表、基金、規則）
├── schema/form.schema.json          # 上述定義的 JSON Schema
├── data/sample_fund_*.json          # 6 個分基金的預設值（引擎的初始資料）
├── official/FNGBRB5300_*.xlsx       # 官方彙總檔（金額來源，元）
├── profiles/FNGBRB5300.json         # 官方檔 → 表格欄位 的映射設定
├── tools/validate.mjs               # 定義／資料一致性檢查
├── demo/index.html                  # 唯讀預覽（可放 GitHub Pages）
├── LICENSE                          # Apache-2.0
└── DECISIONS.md                     # 本次拆分的決定與未做事項
```

---

## 快速開始

```bash
# 1) 檢查定義與資料是否一致（無外部依賴）
node tools/validate.mjs
#   ✓ 表單定義驗證通過
#   {"forms":"agri-special-fund","version":"1.0.0","tables":25,"columns":12,"funds":6,"dataFiles":6,"rows":254}

# 2) 看表單長什麼樣（唯讀）
python3 -m http.server 8000
# → http://127.0.0.1:8000/demo/
```

> 預覽頁用 `fetch()` 讀 JSON，所以需要 http；直接雙擊 `file://` 會被瀏覽器擋。
>
> **線上預覽（GitHub Pages）**：<https://cormort.github.io/agri_special_fund_forms/>
> （Pages 來源 = `main` / `(root)`，根目錄 `index.html` 會自動導到 `demo/`）

---

## 資料模型

### `forms/agri-special-fund.json`

| 欄位 | 說明 |
|---|---|
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

### `profiles/FNGBRB5300.json`

把官方彙總檔（基金 × 計畫的寬表，單位元）映到表單欄位的規則：

- `scale: 1000`：元 → 千元
- `sectionSplit`：以「基金來源」「基金用途」兩欄的位置切開甲／乙分支，避免跨分支誤配
- `ignoreNames`：`其他`、`購建固定資產` 永不對應
- `minNameLength: 3`：短名稱不做寬鬆比對（否則「其他」會撞上「其他收入」）
- `nameAliases`：官方改名的必要對應，例如
  `綠色環境給付計畫` → `農糧產業調整與轉型計畫(原為「綠色環境給付計畫」)`

> 引擎以 `file://` 執行，無法 `fetch` 這個 JSON，因此另存了同內容的
> `local_gov_budget/xlsx-profiles.js`（用 `<script>` 載入）。改 profile 時兩邊要同步。

---

## 換年度／更新官方資料

1. 把新的官方彙總檔放進 `official/`，必要時更新 `meta.source.officialFile`。
2. 若有欄名變動，更新 `profiles/FNGBRB5300.json` 的 `nameAliases`（或 `ignoreNames`）。
3. 用 `local_gov_budget` 的「📊 匯入官方 xlsx」跑一次，確認差異後套用，
   匯出該基金的 JSON 覆蓋 `data/sample_fund_*.json`。
4. `node tools/validate.mjs` 應維持通過（警告可用來追蹤資料品質）。
5. 年度字樣散落在 `meta.year`、各表 `title`、`columns.*.label`（例如「115年度預算」）——
   換年度時一併更新；這些是刻意寫成資料，不是程式邏輯。

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

---

## 已知限制

- `dec112`（113 年度決算）仍存在於 `data/*.json`，但目前表單不顯示、也不納入驗證錯誤
  （只會產生警告）。若確定不再需要，可整批移除後把警告清掉。
- 員額、用人費用、其他管制項目的官方來源是 **FNGBRB5320 詳細表**，該檔不在 repo 內，
  這 13 張表的預設值目前是既有資料，尚未有可重複執行的自動更新路徑。
- 本包沒有版本化的資料歷史；正式的預算版本控管請在引擎端或另建資料庫處理。

---

## 授權與資料來源

- 程式與定義：Apache-2.0（見 `LICENSE`）。
- `official/` 內的官方預算檔取自政府公開資訊；數字本身為公務預算，供查填與核對使用。
  引用時請保留原始檔名與年度。
