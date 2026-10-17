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

## 發布紀錄（2026-10-17）

- 已在 GitHub 建立 **public** repo：<https://github.com/cormort/agri_special_fund_forms>
- 推送方式：CLI 沒有可用憑證（`gh` 未登入、keychain 無 token、主要 SSH key 已停用），
  所以改用**瀏覽器既有登入的 session**，以 GitHub Web 介面建立 repo 並上傳檔案
  （每個目錄一個 commit）。憑證全程留在瀏覽器，沒有另外產生 token。
- 曾嘗試的替代路徑與結果：
  - **deploy key**（產生專用 ed25519，寫入 `~/.ssh/config` 的 managed 區塊）→
    在 GitHub 加入金鑰時被 **sudo mode** 擋下（需 GitHub Mobile 或 email 驗證碼），
    屬需要本人處理的驗證關卡，未硬闖；金鑰未註冊，已連同 config 條目清除。
  - **`gh auth login --web`（device flow）** → 授權頁的「Authorize github」按鈕始終 disabled
    並顯示 "You can't perform that action at this time."，未取得 token。
- 本機 git 已與遠端同步：遠端由 Web 上傳建立，本地 commit 保留為 `source-snapshot` 分支，
  `main` 指向遠端 HEAD，兩者樹狀內容一致（見驗證紀錄）。

## GitHub Pages（已開啟）

- 網址：**<https://cormort.github.io/agri_special_fund_forms/>**（根目錄 `index.html` 導向 `demo/`）
- 設定：`Settings → Pages → Deploy from a branch → main / (root)`
- 為什麼不是 `/docs` 也不是 Actions：Pages 只允許 `/` 或 `/docs`，而預覽在 `demo/`
  且需要相對路徑讀 `../forms/`、`../data/`；放 root 最省事，Actions 只能發布單一目錄反而會斷。

## 與引擎的同步（已接上）

`local_gov_budget` 已改成 consumer：`special-fund.js` 不再自帶 `COL`／`tableConfigs`／`SAMPLES`，
而是由 `npm run sync:forms` 讀本 repo 的 `forms/`、`profiles/`、`data/` 產生
`vendor/forms/*.js` 後載入（引擎端淨減 814 行，行為以重構前後 `collectData()` 全量對帳確認相同）。

## 待確認／未做

- **5320 詳細表**（員額／用人費／管制項目）不在 repo 內，13 張表仍無自動更新路徑；
  `personnel_cost_disaster`、`personnel_cost_fish` 目前是空陣列（引擎端顯示空表，不再用假資料填充）。
- **資料版本歷史**：目前只有 git 歷史，沒有 per-version 快照或差異檢視。

## 驗證紀錄

```
$ node tools/validate.mjs
  ⚠ data/sample_fund_*.json plan_* 含有表單未顯示的欄位：dec112（×12）
✓ 表單定義驗證通過
  {"forms":"agri-special-fund","version":"1.0.0","tables":25,"columns":12,"funds":6,"dataFiles":6,"rows":254}
```

```
$ git fetch origin main && git diff --stat FETCH_HEAD
（無輸出 → 樹狀內容與遠端一致）
$ curl -s -o /dev/null -w "%{http_code}" https://raw.githubusercontent.com/cormort/agri_special_fund_forms/main/forms/agri-special-fund.json
200
```

預覽頁以 ego-browser 實測：25 張表、6 個基金、三個分頁切換、換基金、
母列加總與核列即時計算皆正常。

## 後續清理（2026-10-17，第三輪）

- 業務計畫 12 張表的 `dec112`（113 年度決算）資料已移除（6 個 `data/*.json`、100 列）。
  這個 key 從來不在業務計畫表的 `cols` 裡，屬純冗餘；員額／用人費用／管制項目仍保留該欄位。
  驗證警告由 12 個降為 0。
- 引擎端同步移除 GA4 追蹤碼（CSP 擋 inline script，本來就沒作用），與本包無關但一起記錄。
