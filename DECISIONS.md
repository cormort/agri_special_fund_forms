# DECISIONS — 把農業特別收入基金表單拆成獨立 public repo

## 這次拆什麼、不拆什麼

| 對象 | 去向 | 理由 |
|---|---|---|
| 表單定義（欄位、25 張表、基金、層級標籤、加總規則） | **本 repo** `forms/agri-special-fund.json` | 這是「表單」本體，也是最常變動的部分 |
| 預設值 | 本 repo `data/sample_fund_*.json` | 引擎原本就以 `fetch` 載入它們，形狀不變 |
| 官方來源檔 | 本 repo `official/` | 公開資料，跟著表單走才有出處可追 |
| 映射 profile | 本 repo `profiles/FNGBRB5300.json` | 是「官方檔如何變成這張表單」的知識，屬資料 |
| 驗證工具、唯讀預覽 | 本 repo | 讓這個包在沒有引擎時也能被檢查、被看懂 |
| 編輯引擎（UI／加總／存檔／匯出／xlsx 匯入） | **留在 local_gov_budget** | 屬程式，與表單生命週期不同 |
| `local_gov_budget/special-fund.js` 內的 `SAMPLES` | **留在原處不動** | 那是 `file://` 開啟時的 fallback；刪掉會讓離線模式變空白 |

## 決定

1. **不做「只搬資料、把引擎砍掉」的破壞性拆分。**
   `local_gov_budget` 的 `index.html` 會 `fetch sample_fund_*.json`；若把它們移走，
   現有部署（含 `file://` 使用方式）會壞掉。因此本 repo 是**新增的權威來源**，
   `local_gov_budget` 維持可獨立運作，兩邊靠 `tools/validate.mjs` 與年度流程保持同步。

2. **表單用 JSON + JSON Schema，不用 JS。**
   舊的欄位定義寫死在 `special-fund.js`（`COL`／`tableConfigs`／`PLAN_FUNDS`），
   外部工具無法取用。拆成 JSON 後可被驗證、被 diff、被其他語言讀取。
   `forms/agri-special-fund.json` 是從**執行中的引擎**（`tableConfigs`／`COL`／`PLAN_FUNDS`／
   `TAB_INFO`／`LEVEL_LABELS`）直接匯出生成，不是手抄，避免人工轉錄誤差。

3. **profile 兩種格式並存（JSON＋JS）。**
   引擎以 `file://` 執行且 CSP 為 `connect-src 'self'`，`fetch()` 讀不到本地 JSON，
   所以引擎端只能用 `<script>` 載入的 `xlsx-profiles.js`。本 repo 放 JSON 版給其他工具用，
   差異只在前者多一層 JS 包裝；改動時兩邊同步（README 已註明）。

4. **附一個唯讀預覽，不附編輯器。**
   public repo 若只能看 JSON，外部讀者無法確認表單長相。`demo/index.html` 用同一份 JSON
   畫出 25 張表（含核列與母列加總的即時計算），但**不可編輯、不寫入**，
   避免出現第二套編輯邏輯而與引擎漂移。

5. **驗證工具零依賴。**
   政府機關環境常無法 `npm install`；`tools/validate.mjs` 只用 Node 內建模組，
   自帶小型 JSON Schema 子集驗證器，`node tools/validate.mjs` 即可跑。

6. **`dec112` 只警告、不報錯。**
   資料檔保留 113 年度決算欄位（歷史資料），但目前表單不顯示。把它當錯誤會讓驗證永遠紅燈，
   當警告則能提醒「這批資料有冗欄」。是否整批移除留給資料擁有者決定。

## 待確認／未做

- **GitHub repo 建立與推送**：本機已完成 commit；遠端建立需要帳號授權，
  由使用者執行（`gh repo create agri_special_fund_forms --public --source=. --push`
  或直接在 GitHub 建 repo 後 `git push`）。原因見下。
- **GitHub Pages**：若要在 Pages 開 `demo/`，需在 repo 設定裡指定分支／目錄；
  這會公開發布一個網址，屬對外發布動作，未在未經同意的情況下代為開啟。
- **自動同步機制**：目前沒有「從引擎重新產生 forms JSON」的腳本（引擎的定義仍是 JS 常數）。
  若要長期維護，建議把 `special-fund.js` 的 `tableConfigs`／`COL` 改成讀 `forms/*.json`，
  讓引擎變成純 consumer；那是 local_gov_budget 的重構，不在本次範圍。
- **5320 詳細表**（員額／用人費／管制項目）不在 repo 內，13 張表仍無自動更新路徑。

## 驗證紀錄

```
$ node tools/validate.mjs
  ⚠ data/sample_fund_*.json plan_* 含有表單未顯示的欄位：dec112（×12）
✓ 表單定義驗證通過
  {"forms":"agri-special-fund","version":"1.0.0","tables":25,"columns":12,"funds":6,"dataFiles":6,"rows":254}
```

預覽頁以 ego-browser 實測：25 張表、6 個基金、三個分頁切換、換基金、
母列加總與核列即時計算皆正常（截圖見 commit 訊息所述）。
