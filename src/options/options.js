import {
  DEFAULT_EXCHANGE_RATES,
  DEFAULT_SCENARIO,
} from '../lib/defaults.js';
import {
  createChromeStorageRepository,
  createEmptyState,
  createInMemoryRepository,
} from '../storage/repository.js';
import {
  buildComparisonRows,
  buildUnitDefinitions,
} from './helpers.js';

const app = document.querySelector('#app');
const repository = canUseChromeStorage()
  ? createChromeStorageRepository()
  : createInMemoryRepository();

let state = await repository.loadState();
let comparisonRows = [];
let flash = null;

render();

function canUseChromeStorage() {
  return typeof chrome !== 'undefined' && !!chrome.storage?.local;
}

function render() {
  app.innerHTML = `
    <main class="app">
      <header class="hero">
        <div class="hero-copy">
          <h1>AI SaaS 比价工作台</h1>
          <p>手动录入第三方平台套餐、积分和模型规则，先输出可靠表格，再扩展图表。</p>
        </div>
        <div class="toolbar">
          <button class="button-secondary" id="reset-demo">载入示例数据</button>
          <button id="export-json">导出 JSON</button>
          <label class="button-like import-button button-secondary">
            导入 JSON
            <input id="import-json" type="file" accept="application/json">
          </label>
        </div>
      </header>

      ${flash ? `<p class="status ${flash.type === 'error' ? 'error' : ''}">${flash.message}</p>` : ''}

      <div class="layout">
        <div class="column">
          <section class="panel">
            <div class="panel-header">
              <h2>平台、套餐、模型</h2>
              <p>先把可复用资产建起来，后面比较时不用重复输入。</p>
            </div>
            <div class="panel-body stack">
              ${renderPlatformForm()}
              ${renderPlanForm()}
              ${renderModelForm()}
            </div>
          </section>

          <section class="panel">
            <div class="panel-header">
              <h2>计费规则</h2>
              <p>支持积分折算和直接价格，两种方式都走同一套比较引擎。</p>
            </div>
            <div class="panel-body">
              ${renderRuleForm()}
            </div>
          </section>

          <section class="panel">
            <div class="panel-header">
              <h2>当前资产</h2>
              <p>用于快速检查平台、套餐、模型和规则是否录入完整。</p>
            </div>
            <div class="panel-body stack">
              ${renderCards('平台', state.platforms, renderPlatformCard)}
              ${renderCards('套餐', state.plans, renderPlanCard)}
              ${renderCards('模型', state.models, renderModelCard)}
              ${renderCards('规则', state.rules, renderRuleCard)}
            </div>
          </section>
        </div>

        <div class="column">
          <section class="panel">
            <div class="panel-header">
              <h2>汇率与场景</h2>
              <p>默认汇率可改，场景参数只影响本次表格生成。</p>
            </div>
            <div class="panel-body">
              ${renderSettingsForm()}
            </div>
          </section>

          <section class="panel">
            <div class="panel-header">
              <h2>生成对比表</h2>
              <p>支持同一模型跨平台，也支持多个模型跨多个平台。</p>
            </div>
            <div class="panel-body">
              ${renderComparisonForm()}
            </div>
            <div class="table-wrap">
              ${renderResultsTable()}
            </div>
          </section>
        </div>
      </div>
    </main>
  `;

  bindEvents();
}

function renderPlatformForm() {
  return `
    <section>
      <div class="panel-header">
        <h3>新建平台</h3>
      </div>
      <form class="grid-form" id="platform-form">
        <div class="field">
          <label for="platform-name">平台名</label>
          <input id="platform-name" name="name" required>
        </div>
        <div class="field">
          <label for="platform-currency">默认币种</label>
          <input id="platform-currency" name="defaultCurrency" value="CNY" required>
        </div>
        <div class="field span-2">
          <label for="platform-notes">备注</label>
          <textarea id="platform-notes" name="notes"></textarea>
        </div>
        <div class="field span-2">
          <button type="submit">保存平台</button>
        </div>
      </form>
    </section>
  `;
}

function renderPlanForm() {
  return `
    <section>
      <div class="panel-header">
        <h3>新建套餐</h3>
      </div>
      <form class="grid-form compact" id="plan-form">
        <div class="field">
          <label for="plan-platform-id">所属平台</label>
          <select id="plan-platform-id" name="platformId" required>
            <option value="">请选择</option>
            ${state.platforms.map((platform) => `<option value="${platform.id}">${platform.name}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label for="plan-name">套餐名</label>
          <input id="plan-name" name="name" required>
        </div>
        <div class="field">
          <label for="plan-price">价格</label>
          <input id="plan-price" name="price" type="number" step="0.000001" required>
        </div>
        <div class="field">
          <label for="plan-currency">币种</label>
          <input id="plan-currency" name="currency" value="CNY" required>
        </div>
        <div class="field">
          <label for="plan-cycle">周期</label>
          <select id="plan-cycle" name="billingCycle">
            <option value="monthly">monthly</option>
            <option value="yearly">yearly</option>
            <option value="one_time">one_time</option>
            <option value="custom">custom</option>
          </select>
        </div>
        <div class="field">
          <label for="plan-credits">积分数量</label>
          <input id="plan-credits" name="creditAmount" type="number" step="0.000001">
        </div>
        <div class="field span-3">
          <label for="plan-notes">备注</label>
          <textarea id="plan-notes" name="notes"></textarea>
        </div>
        <div class="field span-3">
          <button type="submit">保存套餐</button>
        </div>
      </form>
    </section>
  `;
}

function renderModelForm() {
  return `
    <section>
      <div class="panel-header">
        <h3>新建模型</h3>
      </div>
      <form class="grid-form" id="model-form">
        <div class="field">
          <label for="model-name">模型名</label>
          <input id="model-name" name="name" required>
        </div>
        <div class="field">
          <label for="model-category">模型类型</label>
          <select id="model-category" name="category" required>
            <option value="text">text</option>
            <option value="image">image</option>
            <option value="video">video</option>
            <option value="audio">audio</option>
          </select>
        </div>
        <div class="field span-2">
          <button type="submit">保存模型</button>
        </div>
      </form>
    </section>
  `;
}

function renderRuleForm() {
  return `
    <form class="grid-form compact" id="rule-form">
      <div class="field">
        <label for="rule-platform-id">平台</label>
        <select id="rule-platform-id" name="platformId" required>
          <option value="">请选择</option>
          ${state.platforms.map((platform) => `<option value="${platform.id}">${platform.name}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label for="rule-model-id">模型</label>
        <select id="rule-model-id" name="modelId" required>
          <option value="">请选择</option>
          ${state.models.map((model) => `<option value="${model.id}">${model.name} (${model.category})</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label for="rule-mode">计费模式</label>
        <select id="rule-mode" name="pricingMode" required>
          <option value="plan_credit_based">plan_credit_based</option>
          <option value="direct_price_based">direct_price_based</option>
        </select>
      </div>
      <div class="field">
        <label for="rule-plan-id">关联套餐</label>
        <select id="rule-plan-id" name="planId">
          <option value="">可留空</option>
          ${state.plans.map((plan) => `<option value="${plan.id}">${plan.name}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label for="rule-currency">直接价格币种</label>
        <input id="rule-currency" name="currency" value="USD">
      </div>
      <div class="field">
        <label for="rule-notes">备注</label>
        <input id="rule-notes" name="notes">
      </div>
      <div class="field">
        <label for="text-input-value">文本输入 / 1K</label>
        <input id="text-input-value" name="textInputValue" type="number" step="0.000001">
      </div>
      <div class="field">
        <label for="text-output-value">文本输出 / 1K</label>
        <input id="text-output-value" name="textOutputValue" type="number" step="0.000001">
      </div>
      <div class="field">
        <label for="image-value">图片 / 张</label>
        <input id="image-value" name="imageValue" type="number" step="0.000001">
      </div>
      <div class="field">
        <label for="video-second-value">视频 / 秒</label>
        <input id="video-second-value" name="videoSecondValue" type="number" step="0.000001">
      </div>
      <div class="field">
        <label for="video-minute-value">视频 / 分钟</label>
        <input id="video-minute-value" name="videoMinuteValue" type="number" step="0.000001">
      </div>
      <div class="field">
        <label for="audio-second-value">音频 / 秒</label>
        <input id="audio-second-value" name="audioSecondValue" type="number" step="0.000001">
      </div>
      <div class="field">
        <label for="audio-minute-value">音频 / 分钟</label>
        <input id="audio-minute-value" name="audioMinuteValue" type="number" step="0.000001">
      </div>
      <div class="field span-3">
        <button type="submit">保存规则</button>
      </div>
    </form>
  `;
}

function renderSettingsForm() {
  const rates = {
    ...DEFAULT_EXCHANGE_RATES.rates,
    ...state.exchangeRates.rates,
  };

  return `
    <form class="grid-form compact" id="settings-form">
      <div class="field">
        <label for="rate-cny">CNY</label>
        <input id="rate-cny" name="CNY" type="number" step="0.000001" value="${rates.CNY ?? 1}">
      </div>
      <div class="field">
        <label for="rate-usd">USD</label>
        <input id="rate-usd" name="USD" type="number" step="0.000001" value="${rates.USD ?? 7.2}">
      </div>
      <div class="field">
        <label for="rate-hkd">HKD</label>
        <input id="rate-hkd" name="HKD" type="number" step="0.000001" value="${rates.HKD ?? 0.92}">
      </div>
      <div class="field">
        <label for="scenario-input">文本输入 tokens</label>
        <input id="scenario-input" name="textInputTokens" type="number" step="1" value="${state.scenarioDefaults.textInputTokens ?? DEFAULT_SCENARIO.textInputTokens}">
      </div>
      <div class="field">
        <label for="scenario-output">文本输出 tokens</label>
        <input id="scenario-output" name="textOutputTokens" type="number" step="1" value="${state.scenarioDefaults.textOutputTokens ?? DEFAULT_SCENARIO.textOutputTokens}">
      </div>
      <div class="field">
        <label for="scenario-images">图片张数</label>
        <input id="scenario-images" name="imageCount" type="number" step="1" value="${state.scenarioDefaults.imageCount ?? DEFAULT_SCENARIO.imageCount}">
      </div>
      <div class="field">
        <label for="scenario-video">视频秒数</label>
        <input id="scenario-video" name="videoSeconds" type="number" step="1" value="${state.scenarioDefaults.videoSeconds ?? DEFAULT_SCENARIO.videoSeconds}">
      </div>
      <div class="field">
        <label for="scenario-audio">音频分钟</label>
        <input id="scenario-audio" name="audioMinutes" type="number" step="1" value="${state.scenarioDefaults.audioMinutes ?? DEFAULT_SCENARIO.audioMinutes}">
      </div>
      <div class="field">
        <label for="target-currency">结果币种</label>
        <input id="target-currency" name="targetCurrency" value="CNY">
      </div>
      <div class="field span-3">
        <button type="submit">保存汇率和默认场景</button>
      </div>
    </form>
  `;
}

function renderComparisonForm() {
  return `
    <form class="grid-form compact" id="comparison-form">
      <div class="field">
        <label for="compare-platforms">平台筛选</label>
        <select id="compare-platforms" name="platformIds" multiple size="5">
          ${state.platforms.map((platform) => `<option value="${platform.id}">${platform.name}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label for="compare-models">模型筛选</label>
        <select id="compare-models" name="modelIds" multiple size="5">
          ${state.models.map((model) => `<option value="${model.id}">${model.name}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label for="compare-currency">目标币种</label>
        <input id="compare-currency" name="targetCurrency" value="CNY">
      </div>
      <div class="field">
        <label for="compare-input">文本输入 tokens</label>
        <input id="compare-input" name="textInputTokens" type="number" step="1" value="${state.scenarioDefaults.textInputTokens}">
      </div>
      <div class="field">
        <label for="compare-output">文本输出 tokens</label>
        <input id="compare-output" name="textOutputTokens" type="number" step="1" value="${state.scenarioDefaults.textOutputTokens}">
      </div>
      <div class="field">
        <label for="compare-images">图片张数</label>
        <input id="compare-images" name="imageCount" type="number" step="1" value="${state.scenarioDefaults.imageCount}">
      </div>
      <div class="field">
        <label for="compare-video">视频秒数</label>
        <input id="compare-video" name="videoSeconds" type="number" step="1" value="${state.scenarioDefaults.videoSeconds}">
      </div>
      <div class="field">
        <label for="compare-audio">音频分钟</label>
        <input id="compare-audio" name="audioMinutes" type="number" step="1" value="${state.scenarioDefaults.audioMinutes}">
      </div>
      <div class="field span-3">
        <button type="submit">生成对比表</button>
      </div>
    </form>
  `;
}

function renderResultsTable() {
  if (comparisonRows.length === 0) {
    return `<div class="empty">还没有结果。先录入数据，再点击“生成对比表”。</div>`;
  }

  return `
    <table>
      <thead>
        <tr>
          <th>Platform</th>
          <th>Model</th>
          <th>Category</th>
          <th>Pricing Mode</th>
          <th>Plan Name</th>
          <th>Plan Total Price</th>
          <th>Total Credits</th>
          <th>Unit Usage Description</th>
          <th>Original Currency Unit Cost</th>
          <th>Exchange Rate</th>
          <th>Converted CNY Unit Cost</th>
          <th>Typical Single-Run Cost</th>
        </tr>
      </thead>
      <tbody>
        ${comparisonRows.map((row) => `
          <tr>
            <td>${escapeHtml(row.platformName)}</td>
            <td>${escapeHtml(row.modelName)}</td>
            <td>${escapeHtml(row.category)}</td>
            <td>${escapeHtml(row.pricingMode)}</td>
            <td>${escapeHtml(row.planName || '-')}</td>
            <td>${row.planTotalPrice ?? '-'}</td>
            <td>${row.totalCredits ?? '-'}</td>
            <td>${escapeHtml(row.unitUsageDescription)}</td>
            <td>${row.originalUnitCost} ${escapeHtml(row.originalCurrency)}</td>
            <td>${row.exchangeRate}</td>
            <td>${row.convertedUnitCost}</td>
            <td>${row.singleRunCost}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderCards(title, items, renderer) {
  return `
    <section>
      <div class="panel-header">
        <h3>${title}</h3>
      </div>
      <div class="card-list">
        ${
          items.length === 0
            ? '<div class="card"><span class="meta">暂无数据</span></div>'
            : items.map(renderer).join('')
        }
      </div>
    </section>
  `;
}

function renderPlatformCard(platform) {
  return `
    <article class="card">
      <strong>${escapeHtml(platform.name)}</strong>
      <span class="meta">${escapeHtml(platform.defaultCurrency)} · ${escapeHtml(platform.notes || '无备注')}</span>
    </article>
  `;
}

function renderPlanCard(plan) {
  const platform = state.platforms.find((item) => item.id === plan.platformId);
  return `
    <article class="card">
      <strong>${escapeHtml(plan.name)}</strong>
      <span class="meta">${plan.price} ${escapeHtml(plan.currency)} · ${escapeHtml(plan.billingCycle || 'custom')}</span>
      <div class="chips">
        <span class="chip">${escapeHtml(platform?.name || '未知平台')}</span>
        <span class="chip">积分 ${plan.creditAmount || '-'}</span>
      </div>
    </article>
  `;
}

function renderModelCard(model) {
  return `
    <article class="card">
      <strong>${escapeHtml(model.name)}</strong>
      <span class="meta">${escapeHtml(model.category)}</span>
    </article>
  `;
}

function renderRuleCard(rule) {
  const platform = state.platforms.find((item) => item.id === rule.platformId);
  const model = state.models.find((item) => item.id === rule.modelId);
  return `
    <article class="card">
      <strong>${escapeHtml(model?.name || '未知模型')}</strong>
      <span class="meta">${escapeHtml(platform?.name || '未知平台')} · ${escapeHtml(rule.pricingMode)}</span>
      <div class="chips">
        ${rule.unitDefinitions.map((unit) => `<span class="chip">${escapeHtml(unit.unitType)}: ${unit.value}</span>`).join('')}
      </div>
    </article>
  `;
}

function bindEvents() {
  document.querySelector('#platform-form')?.addEventListener('submit', handlePlatformSubmit);
  document.querySelector('#plan-form')?.addEventListener('submit', handlePlanSubmit);
  document.querySelector('#model-form')?.addEventListener('submit', handleModelSubmit);
  document.querySelector('#rule-form')?.addEventListener('submit', handleRuleSubmit);
  document.querySelector('#settings-form')?.addEventListener('submit', handleSettingsSubmit);
  document.querySelector('#comparison-form')?.addEventListener('submit', handleComparisonSubmit);
  document.querySelector('#export-json')?.addEventListener('click', handleExport);
  document.querySelector('#import-json')?.addEventListener('change', handleImport);
  document.querySelector('#reset-demo')?.addEventListener('click', handleLoadDemo);
}

async function handlePlatformSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const platform = {
    id: createId('platform'),
    name: String(formData.get('name')).trim(),
    defaultCurrency: String(formData.get('defaultCurrency')).trim().toUpperCase(),
    notes: String(formData.get('notes')).trim(),
  };

  await updateState((draft) => {
    draft.platforms.push(platform);
  }, '平台已保存');
}

async function handlePlanSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const plan = {
    id: createId('plan'),
    platformId: String(formData.get('platformId')),
    name: String(formData.get('name')).trim(),
    price: Number(formData.get('price')),
    currency: String(formData.get('currency')).trim().toUpperCase(),
    billingCycle: String(formData.get('billingCycle')).trim(),
    creditAmount: formData.get('creditAmount') ? Number(formData.get('creditAmount')) : null,
    notes: String(formData.get('notes')).trim(),
  };

  await updateState((draft) => {
    draft.plans.push(plan);
  }, '套餐已保存');
}

async function handleModelSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const model = {
    id: createId('model'),
    name: String(formData.get('name')).trim(),
    category: String(formData.get('category')),
  };

  await updateState((draft) => {
    draft.models.push(model);
  }, '模型已保存');
}

async function handleRuleSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const modelId = String(formData.get('modelId'));
  const model = state.models.find((item) => item.id === modelId);

  if (!model) {
    setFlash('error', '请先选择一个有效模型。');
    return;
  }

  const unitDefinitions = buildUnitDefinitions({
    category: model.category,
    values: Object.fromEntries(formData.entries()),
  });

  if (unitDefinitions.length === 0) {
    setFlash('error', '当前规则没有任何有效的单位价格或积分消耗。');
    return;
  }

  const rule = {
    id: createId('rule'),
    platformId: String(formData.get('platformId')),
    modelId,
    pricingMode: String(formData.get('pricingMode')),
    planId: String(formData.get('planId')) || null,
    currency: String(formData.get('currency')).trim().toUpperCase(),
    unitDefinitions,
    notes: String(formData.get('notes')).trim(),
  };

  await updateState((draft) => {
    draft.rules.push(rule);
  }, '规则已保存');
}

async function handleSettingsSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);

  await updateState((draft) => {
    draft.exchangeRates = {
      baseCurrency: 'CNY',
      rates: {
        CNY: Number(formData.get('CNY')),
        USD: Number(formData.get('USD')),
        HKD: Number(formData.get('HKD')),
      },
      updatedAt: new Date().toISOString(),
    };
    draft.scenarioDefaults = {
      textInputTokens: Number(formData.get('textInputTokens')),
      textOutputTokens: Number(formData.get('textOutputTokens')),
      imageCount: Number(formData.get('imageCount')),
      videoSeconds: Number(formData.get('videoSeconds')),
      audioMinutes: Number(formData.get('audioMinutes')),
    };
  }, '汇率和默认场景已保存');
}

function handleComparisonSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const platformIds = getSelectedValues(document.querySelector('#compare-platforms'));
  const modelIds = getSelectedValues(document.querySelector('#compare-models'));
  const filters = {
    platformIds,
    modelIds,
    targetCurrency: String(formData.get('targetCurrency')).trim().toUpperCase() || 'CNY',
    scenario: {
      textInputTokens: Number(formData.get('textInputTokens')),
      textOutputTokens: Number(formData.get('textOutputTokens')),
      imageCount: Number(formData.get('imageCount')),
      videoSeconds: Number(formData.get('videoSeconds')),
      audioMinutes: Number(formData.get('audioMinutes')),
    },
  };

  try {
    comparisonRows = buildComparisonRows({ state, filters });
    setFlash('success', `已生成 ${comparisonRows.length} 条结果。`);
  } catch (error) {
    setFlash('error', error instanceof Error ? error.message : '生成结果失败。');
  }

  render();
}

function handleExport() {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: 'application/json',
  });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'ai-saas-price-compare.json';
  link.click();
  URL.revokeObjectURL(link.href);
  setFlash('success', 'JSON 已导出。');
  render();
}

async function handleImport(event) {
  const [file] = event.target.files ?? [];
  if (!file) {
    return;
  }

  try {
    const imported = JSON.parse(await file.text());
    await repository.importState({
      ...createEmptyState(),
      ...imported,
    });
    state = await repository.loadState();
    comparisonRows = [];
    setFlash('success', 'JSON 已导入。');
    render();
  } catch (error) {
    setFlash('error', error instanceof Error ? error.message : 'JSON 导入失败。');
    render();
  }
}

async function handleLoadDemo() {
  await repository.saveState({
    ...createEmptyState(),
    platforms: [{ id: 'platform-demo', name: 'Demo SaaS', defaultCurrency: 'CNY', notes: '演示平台' }],
    plans: [{ id: 'plan-demo', platformId: 'platform-demo', name: '39 元 400 积分', price: 39, currency: 'CNY', billingCycle: 'monthly', creditAmount: 400, notes: '' }],
    models: [{ id: 'model-demo', name: 'gpt-image-1', category: 'image' }],
    rules: [{ id: 'rule-demo', platformId: 'platform-demo', modelId: 'model-demo', pricingMode: 'plan_credit_based', planId: 'plan-demo', currency: 'CNY', unitDefinitions: [{ unitType: 'per_image', value: 20 }], notes: '' }],
    exchangeRates: structuredClone(DEFAULT_EXCHANGE_RATES),
    scenarioDefaults: structuredClone(DEFAULT_SCENARIO),
  });
  state = await repository.loadState();
  comparisonRows = [];
  setFlash('success', '已载入演示数据，可直接生成 1.95 CNY 的示例结果。');
  render();
}

async function updateState(mutator, successMessage) {
  const draft = structuredClone(state);
  mutator(draft);
  state = await repository.saveState(draft);
  setFlash('success', successMessage);
  render();
}

function createId(prefix) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

function getSelectedValues(select) {
  return Array.from(select?.selectedOptions ?? []).map((option) => option.value);
}

function setFlash(type, message) {
  flash = { type, message };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
