#!/usr/bin/env node
/**
 * validate.mjs — 表單定義包的自我檢查（無外部依賴）
 *
 *   node tools/validate.mjs
 *
 * 檢查三層：
 *   1) 結構：forms/agri-special-fund.json 是否符合 schema/form.schema.json（內建小型 JSON Schema 子集驗證器）
 *   2) 語意：表格／欄位／基金／分頁／審核鍵之間的一致性
 *   3) 資料：data/*.json 的列是否都用合法欄位、層級是否合理、母列金額是否等於子列加總
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const formsPath = join(root, 'forms/agri-special-fund.json');
const schemaPath = join(root, 'schema/form.schema.json');

let errors = [];
let warnings = [];
const err = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

// ---------- 小型 JSON Schema 驗證器（只支援本專案用到的關鍵字） ----------
function validateSchema(value, schema, path, out) {
  if (!schema || typeof schema !== 'object') return;
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actual = value === null ? 'null'
      : Array.isArray(value) ? 'array'
      : typeof value === 'number' ? (Number.isInteger(value) ? 'integer' : 'number')
      : typeof value;
    const ok = types.some(t => (t === 'number' ? (actual === 'number' || actual === 'integer') : t === actual));
    if (!ok) { out.push(`${path}: 型別應為 ${types.join('|')}，實際 ${actual}`); return; }
  }
  if (schema.enum && !schema.enum.includes(value)) {
    out.push(`${path}: 值 ${JSON.stringify(value)} 不在允許清單 ${JSON.stringify(schema.enum)}`);
  }
  if (typeof value === 'string') {
    if (schema.minLength != null && value.length < schema.minLength) out.push(`${path}: 長度小於 ${schema.minLength}`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      out.push(`${path}: 不符合格式 ${schema.pattern}`);
    }
  }
  if (typeof value === 'number') {
    if (schema.minimum != null && value < schema.minimum) out.push(`${path}: 小於最小值 ${schema.minimum}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems != null && value.length < schema.minItems) out.push(`${path}: 項目數小於 ${schema.minItems}`);
    if (schema.items) value.forEach((v, i) => validateSchema(v, schema.items, `${path}[${i}]`, out));
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const req of schema.required || []) {
      if (!(req in value)) out.push(`${path}: 缺少必要欄位 ${req}`);
    }
    if (schema.minProperties != null && Object.keys(value).length < schema.minProperties) {
      out.push(`${path}: 屬性數小於 ${schema.minProperties}`);
    }
    for (const [k, sub] of Object.entries(schema.properties || {})) {
      if (k in value) validateSchema(value[k], sub, `${path}.${k}`, out);
    }
    const extra = Object.keys(value).filter(k => !(schema.properties || {})[k]);
    if (schema.additionalProperties === false) {
      extra.forEach(k => out.push(`${path}: 不允許的欄位 ${k}`));
    } else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
      extra.forEach(k => validateSchema(value[k], schema.additionalProperties, `${path}.${k}`, out));
    }
  }
}

// ---------- 載入 ----------
for (const p of [formsPath, schemaPath]) {
  if (!existsSync(p)) { console.error(`找不到 ${p}`); process.exit(2); }
}
const forms = JSON.parse(readFileSync(formsPath, 'utf8'));
const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));

// ---------- 1) 結構 ----------
const structural = [];
validateSchema(forms, schema, 'forms', structural);
structural.forEach(err);

// ---------- 2) 語意 ----------
const tableIds = new Set();
const tabs = new Set((forms.tabs || []).map(t => t.id));
const fundCodes = new Set((forms.funds || []).map(f => f.code));
const sections = new Set((forms.sections || []).map(s => s.suffix));
const fundById = Object.fromEntries((forms.funds || []).map(f => [f.id, f]));

for (const t of forms.tables || []) {
  if (tableIds.has(t.id)) err(`表格 id 重複：${t.id}`);
  tableIds.add(t.id);

  for (const c of t.cols || []) {
    if (!forms.columns[c]) err(`表格 ${t.id} 使用未定義欄位 ${c}`);
  }
  if (t.reviewKey != null && !tabs.has(t.reviewKey)) {
    err(`表格 ${t.id} 的 reviewKey「${t.reviewKey}」不在 tabs 內`);
  }
  if (t.isPlan) {
    if (!t.hasLevel) err(`業務計畫表 ${t.id} 應為 hasLevel=true`);
    if (!sections.has(t.section)) err(`業務計畫表 ${t.id} 的 section 不合法：${t.section}`);
    if (!fundCodes.has(t.fundCode)) err(`業務計畫表 ${t.id} 的 fundCode 不合法：${t.fundCode}`);
    const expected = `plan_${t.fundCode}_${t.section}`;
    if (t.id !== expected) err(`業務計畫表 ${t.id} 命名應為 ${expected}`);
    const fund = fundById[t.fundId];
    if (!fund) err(`表格 ${t.id} 的 fundId 找不到對應基金：${t.fundId}`);
    else if (t.rank !== fund.rank) err(`表格 ${t.id} 的 rank(${t.rank}) 與基金 rank(${fund.rank}) 不一致`);
  }
  if (!t.cols.includes('name')) err(`表格 ${t.id} 缺少 name 欄位`);
  if (!t.cols.includes('bud114')) warn(`表格 ${t.id} 沒有 bud114（本年度預算）欄位`);
}

const EXPECTED_TABLES = 6 * 2 + 1 + 6 * 2; // 業務計畫 12 + 員額 1 + 用人費 6 + 管制 6
if ((forms.tables || []).length !== EXPECTED_TABLES) {
  err(`表格數應為 ${EXPECTED_TABLES}，實際 ${(forms.tables || []).length}`);
}

// ---------- 3) 資料 ----------
const tableById = Object.fromEntries((forms.tables || []).map(t => [t.id, t]));
const num = (v) => {
  if (v === '' || v == null) return null;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};

let rowCount = 0;
for (const [code, rel] of Object.entries(forms.data || {})) {
  const p = join(root, rel);
  if (!existsSync(p)) { err(`資料檔不存在：${rel}`); continue; }
  const doc = JSON.parse(readFileSync(p, 'utf8'));
  if (!doc.tables) { err(`${rel} 缺少 tables`); continue; }

  for (const [tid, rows] of Object.entries(doc.tables)) {
    const table = tableById[tid];
    if (!table) { err(`${rel} 的表格 ${tid} 未在 forms 定義`); continue; }
    if (table.isPlan && table.fundCode !== code) {
      err(`${rel} 出現不屬於該基金的表格 ${tid}（應為 ${table.fundCode}）`);
    }
    const hidden = new Set();
    rows.forEach((row, i) => {
      rowCount++;
      for (const k of Object.keys(row)) {
        if (table.cols.includes(k) || k === 'level') continue;
        if (forms.columns[k]) hidden.add(k);
        else err(`${rel} ${tid}[${i}] 出現未定義欄位 ${k}（forms.columns 也沒有）`);
      }
      if (table.hasLevel) {
        const lv = parseInt(row.level, 10);
        if (Number.isNaN(lv) || lv < 0 || lv > 5) err(`${rel} ${tid}[${i}] level 不合法：${row.level}`);
        if (!row.name) err(`${rel} ${tid}[${i}] 缺少 name`);
      }
    });

    if (hidden.size) {
      warn(`${rel} ${tid} 含有表單未顯示的欄位：${[...hidden].join('、')}（資料保留，不會被渲染）`);
    }

    // 母列金額 = 直屬子列加總（子列皆無值時不檢查，母列保留原值）
    if (table.isPlan) {
      for (let i = 0; i < rows.length; i++) {
        const lv = parseInt(rows[i].level, 10) || 0;
        const kids = [];
        for (let j = i + 1; j < rows.length; j++) {
          const jlv = parseInt(rows[j].level, 10) || 0;
          if (jlv <= lv) break;
          if (jlv !== lv + 1) continue;
          kids.push(rows[j]);
        }
        if (!kids.length) continue;
        const kw = (forms.rules?.noAutoSumKeywords || []).some(k => String(rows[i].name || '').includes(k));
        if (kw) continue;
        const kidVals = kids.map(k => num(k.bud114)).filter(v => v !== null);
        const own = num(rows[i].bud114);
        if (!kidVals.length || own === null) continue;
        const sum = kidVals.reduce((a, b) => a + b, 0);
        if (Math.abs(sum - own) > 0.5) {
          warn(`${rel} ${tid}[${i}]「${rows[i].name}」母列 ${own} ≠ 子列加總 ${sum}`);
        }
      }
    }
  }
}

// ---------- 4) 官方檔與 profile ----------
const official = forms.meta?.source?.officialFile;
if (official && !existsSync(join(root, official))) err(`官方檔不存在：${official}`);
const profileRel = forms.meta?.source?.profile;
if (profileRel) {
  const pp = join(root, profileRel);
  if (!existsSync(pp)) err(`profile 不存在：${profileRel}`);
  else {
    const profile = JSON.parse(readFileSync(pp, 'utf8'));
    if (!forms.columns[profile.valueKey]) err(`profile 的 valueKey「${profile.valueKey}」不是定義中的欄位`);
    if (!(profile.scale > 0)) err('profile 的 scale 必須大於 0');
    for (const code of Object.keys(profile.funds || {})) {
      if (!fundCodes.has(code)) err(`profile 的基金代碼 ${code} 不在 forms.funds 內`);
    }
    for (const f of forms.funds || []) {
      if (!profile.funds?.[f.code]) err(`基金 ${f.code} 在 profile 內沒有對應的官方列名`);
      else if (profile.funds[f.code] !== f.name) {
        err(`基金 ${f.code} 名稱不一致：forms「${f.name}」 vs profile「${profile.funds[f.code]}」`);
      }
    }
    for (const tpl of Object.values(profile.tableTemplates || {})) {
      const sample = tpl.replace('{code}', 'agri');
      if (!tableIds.has(sample)) err(`profile 的 tableTemplate「${tpl}」產生的 ${sample} 不存在`);
    }
  }
}

// ---------- 輸出 ----------
const summary = {
  forms: forms.id,
  version: forms.schemaVersion,
  tables: (forms.tables || []).length,
  columns: Object.keys(forms.columns || {}).length,
  funds: (forms.funds || []).length,
  dataFiles: Object.keys(forms.data || {}).length,
  rows: rowCount
};
warnings.forEach(w => console.log(`  ⚠ ${w}`));
if (errors.length) {
  console.error('✗ 驗證失敗');
  errors.forEach(e => console.error(`  ✗ ${e}`));
  console.error(`\n${errors.length} 個錯誤、${warnings.length} 個警告`);
  process.exit(1);
}
console.log('✓ 表單定義驗證通過');
console.log(`  ${JSON.stringify(summary)}`);
if (warnings.length) console.log(`  （${warnings.length} 個警告，可用於追蹤資料品質）`);
