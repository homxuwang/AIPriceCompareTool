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
  formatComparisonRowsAsCsv,
  formatComparisonRowsAsMarkdown,
} from './helpers.js';
import {
  buildCalculationSections,
  createTranslator,
} from './messages.js';

const app = document.querySelector('#app');
const repository = canUseChromeStorage()
  ? createChromeStorageRepository()
  : createInMemoryRepository();

const tabState = {
  entry: 'platforms',
  controls: 'settings',
};

let state = await repository.loadState();
let comparisonRows = [];
let flash = null;

render();

function canUseChromeStorage() {
  return typeof chrome !== 'undefined' && !!chrome.storage?.local;
}

function render() {
  const locale = getLocale();
  const t = createTranslator(locale);

  app.innerHTML = `
    <main class="app">
      <header class="hero">
        <div class="hero-copy">
          <h1>${t('app.title')}</h1>
          <p>${t('app.subtitle')}</p>
        </div>
        <div class="toolbar">
          <button class="button-secondary" id="reset-demo" type="button">${t('app.loadDemo')}</button>
          <button id="export-json" type="button">${t('app.exportJson')}</button>
          <label class="button-like import-button button-secondary">
            ${t('app.importJson')}
            <input id="import-json" type="file" accept="application/json">
          </label>
        </div>
      </header>

      ${flash ? `<p class="status ${flash.type === 'error' ? 'error' : ''}">${flash.message}</p>` : ''}

      <section class="metrics-bar">
        ${renderMetric(t('metrics.platforms'), state.platforms.length)}
        ${renderMetric(t('metrics.plans'), state.plans.length)}
        ${renderMetric(t('metrics.models'), state.models.length)}
        ${renderMetric(t('metrics.rules'), state.rules.length)}
        ${renderMetric(t('metrics.currency'), escapeHtml(state.preferences?.targetCurrency ?? 'CNY'))}
      </section>

      <div class="workspace-grid">
        <section class="panel panel-column">
          <div class="panel-header">
            <h2>${t('entry.title')}</h2>
            <p>${t('entry.subtitle')}</p>
          </div>
          <div class="tab-strip">
            ${renderTabButton('entry', 'platforms', t('entry.platforms'))}
            ${renderTabButton('entry', 'plans', t('entry.plans'))}
            ${renderTabButton('entry', 'models', t('entry.models'))}
            ${renderTabButton('entry', 'rules', t('entry.rules'))}
          </div>
          <div class="panel-body stack">
            ${renderEntryTabContent(t)}
          </div>
        </section>

        <section class="panel panel-column">
          <div class="panel-header">
            <h2>${t('controls.title')}</h2>
            <p>${t('controls.subtitle')}</p>
          </div>
          <div class="tab-strip">
            ${renderTabButton('controls', 'settings', t('controls.settings'))}
            ${renderTabButton('controls', 'comparison', t('controls.comparison'))}
            ${renderTabButton('controls', 'calculation', t('controls.calculation'))}
          </div>
          <div class="panel-body stack">
            ${renderControlsTabContent(t, locale)}
          </div>
        </section>

        <section class="panel panel-column panel-result">
          <div class="panel-header">
            <h2>${t('results.title')}</h2>
            <p>${t('results.subtitle')}</p>
          </div>
          <div class="result-summary">
            <div>
              <strong>${comparisonRows.length}</strong>
              <span>${t('results.count')}</span>
            </div>
            <div>
              <strong>${escapeHtml(state.preferences?.targetCurrency ?? 'CNY')}</strong>
              <span>${t('results.currency')}</span>
            </div>
            <div>
              <strong>${state.exchangeRates.updatedAt ? t('results.configured') : t('results.unconfigured')}</strong>
              <span>${t('results.exchangeRateStatus')}</span>
            </div>
          </div>
          <div class="result-actions">
            <button id="download-results-md" type="button">${t('results.downloadMd')}</button>
            <button class="button-secondary" id="download-results-csv" type="button">${t('results.downloadCsv')}</button>
          </div>
          <div class="table-wrap">
            ${renderResultsTable(t)}
          </div>
        </section>
      </div>
    </main>
  `;

  bindEvents();
}

function getLocale() {
  return state.preferences?.locale ?? 'zh-CN';
}

function t(path) {
  return createTranslator(getLocale())(path);
}

function renderMetric(label, value) {
  return `
    <div class="metric">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `;
}

function renderTabButton(group, value, label) {
  const active = tabState[group] === value;
  return `
    <button
      class="tab-button ${active ? 'is-active' : ''}"
      data-tab-group="${group}"
      data-tab-value="${value}"
      type="button"
    >
      ${label}
    </button>
  `;
}

function renderEntryTabContent(translate) {
  switch (tabState.entry) {
    case 'platforms':
      return `
        ${renderPlatformForm(translate)}
        ${renderCards(translate('entry.savedPlatforms'), state.platforms, (item) => renderPlatformCard(item, translate), translate)}
      `;
    case 'plans':
      return `
        ${renderPlanForm(translate)}
        ${renderCards(translate('entry.savedPlans'), state.plans, (item) => renderPlanCard(item, translate), translate)}
      `;
    case 'models':
      return `
        ${renderModelForm(translate)}
        ${renderCards(translate('entry.savedModels'), state.models, (item) => renderModelCard(item), translate)}
      `;
    case 'rules':
      return `
        ${renderRuleForm(translate)}
        ${renderCards(translate('entry.savedRules'), state.rules, (item) => renderRuleCard(item, translate), translate)}
      `;
    default:
      return '';
  }
}

function renderControlsTabContent(translate, locale) {
  switch (tabState.controls) {
    case 'settings':
      return `
        <div class="subpanel-note">${translate('controls.settingsNote')}</div>
        ${renderSettingsForm(translate)}
      `;
    case 'comparison':
      return `
        <div class="subpanel-note">${translate('controls.comparisonNote')}</div>
        ${renderComparisonForm(translate)}
      `;
    case 'calculation':
      return `
        <div class="subpanel-note">${translate('controls.calculationNote')}</div>
        ${renderCalculationSections(locale)}
      `;
    default:
      return '';
  }
}

function renderPlatformForm(translate) {
  return `
    <section>
      <div class="section-title">
        <h3>${translate('forms.platformTitle')}</h3>
        <p>${translate('forms.platformHint')}</p>
      </div>
      <form class="grid-form" id="platform-form">
        <div class="field">
          <label for="platform-name">${translate('forms.platformName')}</label>
          <input id="platform-name" name="name" required>
        </div>
        <div class="field">
          <label for="platform-currency">${translate('forms.defaultCurrency')}</label>
          <input id="platform-currency" name="defaultCurrency" value="CNY" required>
        </div>
        <div class="field span-2">
          <label for="platform-notes">${translate('forms.notes')}</label>
          <textarea id="platform-notes" name="notes"></textarea>
        </div>
        <div class="field span-2">
          <button type="submit">${translate('forms.savePlatform')}</button>
        </div>
      </form>
    </section>
  `;
}

function renderPlanForm(translate) {
  return `
    <section>
      <div class="section-title">
        <h3>${translate('forms.planTitle')}</h3>
        <p>${translate('forms.planHint')}</p>
      </div>
      <form class="grid-form compact" id="plan-form">
        <div class="field">
          <label for="plan-platform-id">${translate('forms.platformOwner')}</label>
          <select id="plan-platform-id" name="platformId" required>
            <option value="">请选择</option>
            ${state.platforms.map((platform) => `<option value="${platform.id}">${platform.name}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label for="plan-name">${translate('forms.planName')}</label>
          <input id="plan-name" name="name" required>
        </div>
        <div class="field">
          <label for="plan-price">${translate('forms.price')}</label>
          <input id="plan-price" name="price" type="number" step="0.000001" required>
        </div>
        <div class="field">
          <label for="plan-currency">${translate('forms.currency')}</label>
          <input id="plan-currency" name="currency" value="CNY" required>
        </div>
        <div class="field">
          <label for="plan-cycle">${translate('forms.cycle')}</label>
          <select id="plan-cycle" name="billingCycle">
            <option value="monthly">monthly</option>
            <option value="yearly">yearly</option>
            <option value="one_time">one_time</option>
            <option value="custom">custom</option>
          </select>
        </div>
        <div class="field">
          <label for="plan-credits">${translate('forms.credits')}</label>
          <input id="plan-credits" name="creditAmount" type="number" step="0.000001">
        </div>
        <div class="field span-3">
          <label for="plan-notes">${translate('forms.notes')}</label>
          <textarea id="plan-notes" name="notes"></textarea>
        </div>
        <div class="field span-3">
          <button type="submit">${translate('forms.savePlan')}</button>
        </div>
      </form>
    </section>
  `;
}

function renderModelForm(translate) {
  return `
    <section>
      <div class="section-title">
        <h3>${translate('forms.modelTitle')}</h3>
        <p>${translate('forms.modelHint')}</p>
      </div>
      <form class="grid-form" id="model-form">
        <div class="field">
          <label for="model-name">${translate('forms.modelName')}</label>
          <input id="model-name" name="name" required>
        </div>
        <div class="field">
          <label for="model-category">${translate('forms.category')}</label>
          <select id="model-category" name="category" required>
            <option value="text">text</option>
            <option value="image">image</option>
            <option value="video">video</option>
            <option value="audio">audio</option>
          </select>
        </div>
        <div class="field span-2">
          <button type="submit">${translate('forms.saveModel')}</button>
        </div>
      </form>
    </section>
  `;
}

function renderRuleForm(translate) {
  return `
    <section>
      <div class="section-title">
        <h3>${translate('forms.ruleTitle')}</h3>
        <p>${translate('forms.ruleHint')}</p>
      </div>
      <form class="grid-form compact" id="rule-form">
        <div class="field">
          <label for="rule-platform-id">${translate('forms.platform')}</label>
          <select id="rule-platform-id" name="platformId" required>
            <option value="">请选择</option>
            ${state.platforms.map((platform) => `<option value="${platform.id}">${platform.name}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label for="rule-model-id">${translate('forms.model')}</label>
          <select id="rule-model-id" name="modelId" required>
            <option value="">请选择</option>
            ${state.models.map((model) => `<option value="${model.id}">${model.name} (${model.category})</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label for="rule-mode">${translate('forms.pricingMode')}</label>
          <select id="rule-mode" name="pricingMode" required>
            <option value="plan_credit_based">plan_credit_based</option>
            <option value="plan_output_based">plan_output_based</option>
            <option value="direct_price_based">direct_price_based</option>
          </select>
        </div>
        <div class="field">
          <label for="rule-plan-id">${translate('forms.linkedPlan')}</label>
          <select id="rule-plan-id" name="planId">
            <option value="">可留空</option>
            ${state.plans.map((plan) => `<option value="${plan.id}">${plan.name}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label for="rule-currency">${translate('forms.directCurrency')}</label>
          <input id="rule-currency" name="currency" value="USD">
        </div>
        <div class="field">
          <label for="included-output-units">${translate('forms.includedOutputUnits')}</label>
          <input id="included-output-units" name="includedOutputUnits" type="number" step="0.000001">
        </div>
        <div class="field">
          <label for="rule-notes">${translate('forms.notes')}</label>
          <input id="rule-notes" name="notes">
        </div>
        <div class="field">
          <label for="text-input-value">${translate('forms.textInputPer1k')}</label>
          <input id="text-input-value" name="textInputValue" type="number" step="0.000001">
        </div>
        <div class="field">
          <label for="text-output-value">${translate('forms.textOutputPer1k')}</label>
          <input id="text-output-value" name="textOutputValue" type="number" step="0.000001">
        </div>
        <div class="field">
          <label for="image-value">${translate('forms.imagePerUnit')}</label>
          <input id="image-value" name="imageValue" type="number" step="0.000001">
        </div>
        <div class="field">
          <label for="video-second-value">${translate('forms.videoPerSecond')}</label>
          <input id="video-second-value" name="videoSecondValue" type="number" step="0.000001">
        </div>
        <div class="field">
          <label for="video-minute-value">${translate('forms.videoPerMinute')}</label>
          <input id="video-minute-value" name="videoMinuteValue" type="number" step="0.000001">
        </div>
        <div class="field">
          <label for="audio-second-value">${translate('forms.audioPerSecond')}</label>
          <input id="audio-second-value" name="audioSecondValue" type="number" step="0.000001">
        </div>
        <div class="field">
          <label for="audio-minute-value">${translate('forms.audioPerMinute')}</label>
          <input id="audio-minute-value" name="audioMinuteValue" type="number" step="0.000001">
        </div>
        <div class="field span-3">
          <button type="submit">${translate('forms.saveRule')}</button>
        </div>
      </form>
    </section>
  `;
}

function renderSettingsForm(translate) {
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
        <label for="target-currency">${translate('forms.targetCurrency')}</label>
        <input id="target-currency" name="targetCurrency" value="${escapeHtml(state.preferences?.targetCurrency ?? 'CNY')}">
      </div>
      <div class="field">
        <label for="scenario-input">${translate('forms.defaultTextInput')}</label>
        <input id="scenario-input" name="textInputTokens" type="number" step="1" value="${state.scenarioDefaults.textInputTokens ?? DEFAULT_SCENARIO.textInputTokens}">
      </div>
      <div class="field">
        <label for="scenario-output">${translate('forms.defaultTextOutput')}</label>
        <input id="scenario-output" name="textOutputTokens" type="number" step="1" value="${state.scenarioDefaults.textOutputTokens ?? DEFAULT_SCENARIO.textOutputTokens}">
      </div>
      <div class="field">
        <label for="scenario-images">${translate('forms.defaultImageCount')}</label>
        <input id="scenario-images" name="imageCount" type="number" step="1" value="${state.scenarioDefaults.imageCount ?? DEFAULT_SCENARIO.imageCount}">
      </div>
      <div class="field">
        <label for="scenario-video">${translate('forms.defaultVideoSeconds')}</label>
        <input id="scenario-video" name="videoSeconds" type="number" step="1" value="${state.scenarioDefaults.videoSeconds ?? DEFAULT_SCENARIO.videoSeconds}">
      </div>
      <div class="field">
        <label for="scenario-audio">${translate('forms.defaultAudioMinutes')}</label>
        <input id="scenario-audio" name="audioMinutes" type="number" step="1" value="${state.scenarioDefaults.audioMinutes ?? DEFAULT_SCENARIO.audioMinutes}">
      </div>
      <div class="field span-3">
        <button type="submit">${translate('forms.saveSettings')}</button>
      </div>
    </form>
  `;
}

function renderComparisonForm(translate) {
  return `
    <form class="grid-form compact" id="comparison-form">
      <div class="field span-3">
        <label for="compare-platforms">${translate('forms.filterPlatforms')}</label>
        <select id="compare-platforms" name="platformIds" multiple size="5">
          ${state.platforms.map((platform) => `<option value="${platform.id}">${platform.name}</option>`).join('')}
        </select>
      </div>
      <div class="field span-3">
        <label for="compare-models">${translate('forms.filterModels')}</label>
        <select id="compare-models" name="modelIds" multiple size="5">
          ${state.models.map((model) => `<option value="${model.id}">${model.name}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label for="compare-input">${translate('forms.runtimeTextInput')}</label>
        <input id="compare-input" name="textInputTokens" type="number" step="1" value="${state.scenarioDefaults.textInputTokens}">
      </div>
      <div class="field">
        <label for="compare-output">${translate('forms.runtimeTextOutput')}</label>
        <input id="compare-output" name="textOutputTokens" type="number" step="1" value="${state.scenarioDefaults.textOutputTokens}">
      </div>
      <div class="field">
        <label for="compare-images">${translate('forms.runtimeImageCount')}</label>
        <input id="compare-images" name="imageCount" type="number" step="1" value="${state.scenarioDefaults.imageCount}">
      </div>
      <div class="field">
        <label for="compare-video">${translate('forms.runtimeVideoSeconds')}</label>
        <input id="compare-video" name="videoSeconds" type="number" step="1" value="${state.scenarioDefaults.videoSeconds}">
      </div>
      <div class="field">
        <label for="compare-audio">${translate('forms.runtimeAudioMinutes')}</label>
        <input id="compare-audio" name="audioMinutes" type="number" step="1" value="${state.scenarioDefaults.audioMinutes}">
      </div>
      <div class="field">
        <label>${translate('forms.resultCurrency')}</label>
        <div class="pill-readout">${escapeHtml(state.preferences?.targetCurrency ?? 'CNY')}</div>
      </div>
      <div class="field span-3">
        <button type="submit">${translate('forms.generate')}</button>
      </div>
    </form>
  `;
}

function renderCalculationSections(locale) {
  const sections = buildCalculationSections(locale);

  return `
    <section class="calculation-stack">
      ${sections.map((section) => `
        <article class="formula-card">
          <h3>${escapeHtml(section.title)}</h3>
          <p>${escapeHtml(section.summary)}</p>
          <pre class="formula-block">${escapeHtml(section.formula)}</pre>
          <p class="formula-example">${escapeHtml(section.example)}</p>
        </article>
      `).join('')}
    </section>
  `;
}

function renderResultsTable(translate) {
  if (comparisonRows.length === 0) {
    return `<div class="empty">${translate('results.empty')}</div>`;
  }

  return `
    <table>
      <thead>
        <tr>
          <th>${translate('resultsTable.platform')}</th>
          <th>${translate('resultsTable.model')}</th>
          <th>${translate('resultsTable.category')}</th>
          <th>${translate('resultsTable.pricingMode')}</th>
          <th>${translate('resultsTable.planName')}</th>
          <th>${translate('resultsTable.planTotalPrice')}</th>
          <th>${translate('resultsTable.totalCredits')}</th>
          <th>${translate('resultsTable.includedUnits')}</th>
          <th>${translate('resultsTable.unitUsageDescription')}</th>
          <th>${translate('resultsTable.originalUnitCost')}</th>
          <th>${translate('resultsTable.exchangeRate')}</th>
          <th>${translate('resultsTable.convertedUnitCost')}</th>
          <th>${translate('resultsTable.singleRunCost')}</th>
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
            <td>${row.includedUnits ?? '-'}</td>
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

function renderCards(title, items, renderer, translate) {
  return `
    <section>
      <div class="section-title">
        <h3>${title}</h3>
      </div>
      <div class="card-list">
        ${
          items.length === 0
            ? `<div class="card"><span class="meta">${translate('cards.empty')}</span></div>`
            : items.map(renderer).join('')
        }
      </div>
    </section>
  `;
}

function renderPlatformCard(platform, translate) {
  return `
    <article class="card">
      <strong>${escapeHtml(platform.name)}</strong>
      <span class="meta">${escapeHtml(platform.defaultCurrency)} · ${escapeHtml(platform.notes || translate('cards.noNotes'))}</span>
    </article>
  `;
}

function renderPlanCard(plan, translate) {
  const platform = state.platforms.find((item) => item.id === plan.platformId);
  return `
    <article class="card">
      <strong>${escapeHtml(plan.name)}</strong>
      <span class="meta">${plan.price} ${escapeHtml(plan.currency)} · ${escapeHtml(plan.billingCycle || 'custom')}</span>
      <div class="chips">
        <span class="chip">${escapeHtml(platform?.name || translate('cards.unknownPlatform'))}</span>
        <span class="chip">${translate('cards.credits')} ${plan.creditAmount || '-'}</span>
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

function renderRuleCard(rule, translate) {
  const platform = state.platforms.find((item) => item.id === rule.platformId);
  const model = state.models.find((item) => item.id === rule.modelId);
  return `
    <article class="card">
      <strong>${escapeHtml(model?.name || translate('cards.unknownModel'))}</strong>
      <span class="meta">${escapeHtml(platform?.name || translate('cards.unknownPlatform'))} · ${escapeHtml(rule.pricingMode)}</span>
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
  document.querySelector('#download-results-md')?.addEventListener('click', handleDownloadMarkdown);
  document.querySelector('#download-results-csv')?.addEventListener('click', handleDownloadCsv);
  document.querySelector('#import-json')?.addEventListener('change', handleImport);
  document.querySelector('#reset-demo')?.addEventListener('click', handleLoadDemo);
  document.querySelectorAll('[data-tab-group]').forEach((button) => {
    button.addEventListener('click', handleTabClick);
  });
}

function handleTabClick(event) {
  const button = event.currentTarget;
  tabState[button.dataset.tabGroup] = button.dataset.tabValue;
  render();
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
  }, t('flash.platformSaved'));
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
  }, t('flash.planSaved'));
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
  }, t('flash.modelSaved'));
}

async function handleRuleSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const modelId = String(formData.get('modelId'));
  const model = state.models.find((item) => item.id === modelId);

  if (!model) {
    setFlash('error', t('flash.invalidModel'));
    render();
    return;
  }

  const unitDefinitions = buildUnitDefinitions({
    pricingMode: String(formData.get('pricingMode')),
    category: model.category,
    values: Object.fromEntries(formData.entries()),
  });

  if (unitDefinitions.length === 0) {
    setFlash('error', t('flash.invalidUnits'));
    render();
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
  }, t('flash.ruleSaved'));
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
    draft.preferences = {
      ...(draft.preferences ?? {}),
      locale: draft.preferences?.locale ?? 'zh-CN',
      targetCurrency: String(formData.get('targetCurrency')).trim().toUpperCase() || 'CNY',
    };
  }, t('flash.settingsSaved'));
}

function handleComparisonSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const platformIds = getSelectedValues(document.querySelector('#compare-platforms'));
  const modelIds = getSelectedValues(document.querySelector('#compare-models'));
  const filters = {
    platformIds,
    modelIds,
    targetCurrency: state.preferences?.targetCurrency ?? 'CNY',
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
    setFlash('success', `${t('flash.generatedPrefix')} ${comparisonRows.length} ${t('flash.generatedSuffix')}`);
  } catch (error) {
    setFlash('error', error instanceof Error ? error.message : t('flash.generateFailed'));
  }

  render();
}

function handleExport() {
  downloadFile({
    content: JSON.stringify(state, null, 2),
    type: 'application/json',
    filename: 'ai-saas-price-compare.json',
  });
  setFlash('success', t('flash.exportDone'));
  render();
}

function handleDownloadMarkdown() {
  downloadFile({
    content: formatComparisonRowsAsMarkdown(comparisonRows),
    type: 'text/markdown;charset=utf-8',
    filename: 'ai-saas-price-comparison-results.md',
  });
  setFlash('success', t('flash.downloadMdDone'));
  render();
}

function handleDownloadCsv() {
  downloadFile({
    content: formatComparisonRowsAsCsv(comparisonRows),
    type: 'text/csv;charset=utf-8',
    filename: 'ai-saas-price-comparison-results.csv',
  });
  setFlash('success', t('flash.downloadCsvDone'));
  render();
}

function downloadFile({ content, type, filename }) {
  const blob = new Blob([content], { type });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
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
    setFlash('success', t('flash.importDone'));
    render();
  } catch (error) {
    setFlash('error', error instanceof Error ? error.message : t('flash.importFailed'));
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
    preferences: { locale: 'zh-CN', targetCurrency: 'CNY' },
  });
  state = await repository.loadState();
  comparisonRows = [];
  tabState.entry = 'platforms';
  tabState.controls = 'comparison';
  setFlash('success', t('flash.demoLoaded'));
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
