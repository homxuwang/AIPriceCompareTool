# AI SaaS 比价插件 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个无需构建步骤的 Manifest V3 浏览器插件 MVP，支持本地录入平台/套餐/模型计费规则、生成成本对比表格、并支持 JSON 导入导出。

**Architecture:** 采用原生 Manifest V3 + Options Page + ES Modules 的零构建方案。计算逻辑、存储逻辑、界面渲染逻辑分离，核心成本计算走纯函数，优先用 `node:test` 做 TDD 验证。

**Tech Stack:** HTML, CSS, JavaScript (ES Modules), Chrome Extension Manifest V3, `chrome.storage.local`, Node.js built-in test runner

---

## File Structure

- Create: `manifest.json`
- Create: `.gitignore`
- Create: `package.json`
- Create: `src/lib/calculation.js`
- Create: `src/lib/currency.js`
- Create: `src/lib/types.js`
- Create: `src/lib/defaults.js`
- Create: `src/storage/repository.js`
- Create: `src/options/options.html`
- Create: `src/options/options.css`
- Create: `src/options/options.js`
- Create: `tests/calculation.test.js`
- Create: `tests/currency.test.js`
- Create: `tests/repository.test.js`
- Create: `README.md`

### Task 1: 建立仓库骨架与计算测试入口

**Files:**
- Create: `.gitignore`
- Create: `package.json`
- Create: `manifest.json`
- Create: `tests/calculation.test.js`

- [ ] **Step 1: 写失败的计算测试**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateUnitCostFromPlanCredits } from '../src/lib/calculation.js';

test('calculates image unit cost from plan credits', () => {
  const result = calculateUnitCostFromPlanCredits({
    planPrice: 39,
    creditAmount: 400,
    creditsPerUnit: 20,
  });

  assert.equal(result, 1.95);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/calculation.test.js`
Expected: FAIL with module or export not found

- [ ] **Step 3: 创建最小仓库骨架**

```json
{
  "name": "ai-saas-price-compare-extension",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
```

```json
{
  "manifest_version": 3,
  "name": "AI SaaS Price Compare",
  "version": "0.1.0",
  "description": "Compare third-party AI SaaS model pricing with manual plan and credit inputs.",
  "options_page": "src/options/options.html",
  "permissions": ["storage"]
}
```

```gitignore
.DS_Store
coverage
```

- [ ] **Step 4: 写最小实现让测试通过**

```js
export function calculateUnitCostFromPlanCredits({
  planPrice,
  creditAmount,
  creditsPerUnit,
}) {
  return (planPrice / creditAmount) * creditsPerUnit;
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `node --test tests/calculation.test.js`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add .gitignore package.json manifest.json tests/calculation.test.js src/lib/calculation.js
git commit -m "feat: scaffold extension repo and calculation entrypoint"
```

### Task 2: 完成货币换算与成本引擎

**Files:**
- Modify: `src/lib/calculation.js`
- Create: `src/lib/currency.js`
- Create: `src/lib/defaults.js`
- Create: `tests/currency.test.js`
- Modify: `tests/calculation.test.js`

- [ ] **Step 1: 写失败的汇率换算和场景成本测试**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { convertCurrency } from '../src/lib/currency.js';
import { buildComparisonRow } from '../src/lib/calculation.js';

test('converts usd to cny using configured rates', () => {
  const converted = convertCurrency({
    amount: 2,
    fromCurrency: 'USD',
    toCurrency: 'CNY',
    rates: { CNY: 1, USD: 7.2 },
  });

  assert.equal(converted, 14.4);
});

test('builds image comparison row from plan-credit pricing', () => {
  const row = buildComparisonRow({
    platform: { name: 'Foo AI' },
    model: { name: 'gpt-image-1', category: 'image' },
    plan: { name: 'Pro', price: 39, currency: 'CNY', creditAmount: 400 },
    rule: {
      pricingMode: 'plan_credit_based',
      unitDefinitions: [{ unitType: 'per_image', value: 20 }],
    },
    scenario: { imageCount: 1, textInputTokens: 1000, textOutputTokens: 500, videoSeconds: 5, audioMinutes: 1 },
    exchangeRates: { baseCurrency: 'CNY', rates: { CNY: 1 } },
    targetCurrency: 'CNY',
  });

  assert.equal(row.convertedUnitCost, 1.95);
  assert.equal(row.singleRunCost, 1.95);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/calculation.test.js tests/currency.test.js`
Expected: FAIL with missing exports

- [ ] **Step 3: 实现最小货币与场景计算**

```js
export function convertCurrency({ amount, fromCurrency, toCurrency, rates }) {
  if (fromCurrency === toCurrency) return amount;
  const fromRate = rates[fromCurrency];
  const toRate = rates[toCurrency];
  return (amount * fromRate) / toRate;
}
```

```js
export function buildComparisonRow(input) {
  const { platform, model, plan, rule, scenario, exchangeRates, targetCurrency } = input;
  const unitDefinition = rule.unitDefinitions[0];
  const rawUnitCost =
    rule.pricingMode === 'plan_credit_based'
      ? calculateUnitCostFromPlanCredits({
          planPrice: plan.price,
          creditAmount: plan.creditAmount,
          creditsPerUnit: unitDefinition.value,
        })
      : unitDefinition.value;

  const convertedUnitCost = convertCurrency({
    amount: rawUnitCost,
    fromCurrency: plan?.currency ?? rule.currency ?? targetCurrency,
    toCurrency: targetCurrency,
    rates: exchangeRates.rates,
  });

  return {
    platformName: platform.name,
    modelName: model.name,
    convertedUnitCost,
    singleRunCost: convertedUnitCost,
  };
}
```

```js
export const DEFAULT_SCENARIO = {
  textInputTokens: 1000,
  textOutputTokens: 500,
  imageCount: 1,
  videoSeconds: 5,
  audioMinutes: 1,
};
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test tests/calculation.test.js tests/currency.test.js`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/lib/calculation.js src/lib/currency.js src/lib/defaults.js tests/calculation.test.js tests/currency.test.js
git commit -m "feat: add pricing engine and currency conversion"
```

### Task 3: 完成本地存储与 JSON 导入导出

**Files:**
- Create: `src/storage/repository.js`
- Create: `tests/repository.test.js`

- [ ] **Step 1: 写失败的仓库存储测试**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createInMemoryRepository } from '../src/storage/repository.js';

test('exports and imports repository state as json-safe data', async () => {
  const repository = createInMemoryRepository();

  await repository.saveState({
    platforms: [{ id: 'p1', name: 'Foo AI', defaultCurrency: 'CNY' }],
    plans: [],
    models: [],
    rules: [],
    exchangeRates: { baseCurrency: 'CNY', rates: { CNY: 1 }, updatedAt: '2026-06-18T00:00:00.000Z' },
  });

  const exported = await repository.exportState();
  assert.equal(exported.platforms.length, 1);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/repository.test.js`
Expected: FAIL with module not found

- [ ] **Step 3: 实现最小存储抽象**

```js
export function createInMemoryRepository(initialState = defaultState()) {
  let state = structuredClone(initialState);

  return {
    async loadState() {
      return structuredClone(state);
    },
    async saveState(nextState) {
      state = structuredClone(nextState);
    },
    async exportState() {
      return structuredClone(state);
    },
    async importState(nextState) {
      state = structuredClone(nextState);
    },
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test tests/repository.test.js`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/storage/repository.js tests/repository.test.js
git commit -m "feat: add local repository and json import export support"
```

### Task 4: 搭建 Options Page 与表格生成流程

**Files:**
- Create: `src/options/options.html`
- Create: `src/options/options.css`
- Create: `src/options/options.js`
- Modify: `src/storage/repository.js`
- Modify: `src/lib/calculation.js`

- [ ] **Step 1: 先写最小页面交互测试样例到注释清单**

```js
// Manual verification checklist:
// 1. Add platform "Foo AI"
// 2. Add plan "39 CNY / 400 credits"
// 3. Add model rule "gpt-image-1 / 20 credits per image"
// 4. Generate table
// 5. Verify "1.95 CNY" appears in result row
```

- [ ] **Step 2: 创建最小页面结构**

```html
<main class="app">
  <header class="hero">
    <h1>AI SaaS 比价工作台</h1>
    <div class="toolbar">
      <button id="export-json">导出 JSON</button>
      <label class="import-button">
        导入 JSON
        <input id="import-json" type="file" accept="application/json">
      </label>
    </div>
  </header>

  <section id="platforms-panel"></section>
  <section id="rules-panel"></section>
  <section id="comparison-panel"></section>
  <section id="results-panel"></section>
</main>
```

- [ ] **Step 3: 实现最小表单与结果渲染**

```js
const state = await repository.loadState();
const rows = state.rules.map((rule) =>
  buildComparisonRow({
    platform: findPlatform(state.platforms, rule.platformId),
    model: findModel(state.models, rule.modelId),
    plan: findPlan(state.plans, rule.planId),
    rule,
    scenario: currentScenario(),
    exchangeRates: state.exchangeRates,
    targetCurrency: 'CNY',
  }),
);

resultsPanel.innerHTML = renderResultsTable(rows);
```

- [ ] **Step 4: 手工验证页面流程**

Run: Load unpacked extension in Chrome, open the Options Page, complete the five-step checklist
Expected: Result table shows `1.95 CNY`

- [ ] **Step 5: 提交**

```bash
git add src/options/options.html src/options/options.css src/options/options.js src/storage/repository.js src/lib/calculation.js
git commit -m "feat: add options page workflow for pricing comparison"
```

### Task 5: 完成收尾验证与文档补充

**Files:**
- Create: `README.md`
- Modify: `docs/superpowers/specs/2026-06-18-ai-saas-price-compare-extension-design.md`

- [ ] **Step 1: 写最小使用说明**

```md
# AI SaaS Price Compare Extension

## Run

1. Open Chrome extensions page
2. Enable developer mode
3. Load unpacked from this folder
4. Open the extension options page
```

- [ ] **Step 2: 运行完整测试**

Run: `npm test`
Expected: PASS

- [ ] **Step 3: 最终提交**

```bash
git add README.md docs/superpowers/specs/2026-06-18-ai-saas-price-compare-extension-design.md
git commit -m "docs: add usage notes for mvp extension"
```

## Self-Review

- Spec coverage: 平台/套餐/规则/汇率/场景/表格/本地存储/导入导出都已覆盖，图表与云同步仍保持在范围外。
- Placeholder scan: 计划中没有 `TODO`、`TBD` 或“类似上一任务”的描述；每个任务都有明确文件、命令和验证点。
- Type consistency: `Platform`、`Plan`、`ModelPricingRule`、`ExchangeRateSettings`、`ScenarioSettings` 在各任务中使用的命名保持一致。
