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
  getVisibleConsumptionFieldNames,
} from './helpers.js';
import {
  buildQuickEntryMutation,
  validateQuickEntryDraft,
} from './quick-entry.js';
import {
  buildCalculationSections,
  createTranslator,
} from './messages.js';
import { normalizeDirectUnitDefinitions } from './unit-normalization.js';

const app = document.querySelector('#app');
const repository = canUseChromeStorage()
  ? createChromeStorageRepository()
  : createInMemoryRepository();

const tabState = {
  entry: 'quickEntry',
  controls: 'settings',
  selectedPlatformId: null,
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
            <button id="btn-fullscreen" class="btn-fullscreen" title="全屏查看">⛶ 全屏</button>
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
          <div class="table-wrap">
            ${renderResultsTable(t)}
          </div>
        </section>
      </div>
    </main>

    <div id="fullscreen-modal" class="fullscreen-modal" style="display: none;">
      <div class="fullscreen-content">
        <div class="fullscreen-header">
          <h2>${t('results.title')}</h2>
          <button id="btn-close-fullscreen" class="btn-close-fullscreen">✕ 关闭</button>
        </div>
        <div class="fullscreen-body">
          ${renderResultsTable(t)}
        </div>
      </div>
    </div>
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
  return `
    <div class="tab-strip">
      ${renderTabButton('entry', 'quickEntry', translate('entry.quickEntry'))}
      ${renderTabButton('entry', 'platforms', translate('entry.platforms'))}
      ${renderTabButton('entry', 'plans', translate('entry.plans'))}
      ${renderTabButton('entry', 'models', translate('entry.models'))}
      ${renderTabButton('entry', 'rules', translate('entry.rules'))}
    </div>
    ${renderEntryTabPanel(translate)}
  `;
}

function renderEntryTabPanel(translate) {
  switch (tabState.entry) {
    case 'quickEntry':
      return renderQuickEntryForm(translate);
    case 'platforms':
      return `
        ${renderPlatformForm(translate)}
        ${renderCards(translate('entry.savedPlatforms'), state.platforms, (platform) => renderPlatformCard(platform, translate), translate)}
      `;
    case 'plans':
      return `
        ${renderPlanForm(translate)}
        ${renderCards(translate('entry.savedPlans'), state.plans, (plan) => renderPlanCard(plan, translate), translate)}
      `;
    case 'models':
      return `
        ${renderModelForm(translate)}
        ${renderCards(translate('entry.savedModels'), state.models, (model) => renderModelCard(model, translate), translate)}
      `;
    case 'rules':
      return `
        ${renderRuleForm(translate)}
        ${renderCards(translate('entry.savedRules'), state.rules, (rule) => renderRuleCard(rule, translate), translate)}
      `;
    default:
      return renderQuickEntryForm(translate);
  }
}

function renderQuickEntryForm(translate) {
  const defaultCurrency = escapeHtml(state.preferences?.targetCurrency ?? 'CNY');
  const platformOptions = state.platforms
    .map((platform) => `<option value="${escapeHtml(platform.name)}"></option>`)
    .join('');
  const modelOptions = state.models
    .map((model) => `<option value="${escapeHtml(model.name)}"></option>`)
    .join('');

  return `
    <section>
      <div class="section-title">
        <h3>${translate('quickEntry.title')}</h3>
        <p>${translate('quickEntry.hint')}</p>
      </div>
      <form class="grid-form compact" id="quick-entry-form">
        <datalist id="quick-entry-platforms">
          ${platformOptions}
        </datalist>
        <datalist id="quick-entry-models">
          ${modelOptions}
        </datalist>

        <div class="form-step span-3">
          <span>1</span>
          <div>
            <strong>${translate('quickEntry.platformStep')}</strong>
            <p>${translate('quickEntry.platformStepHint')}</p>
          </div>
        </div>
        <div class="field">
          <label for="quick-platform-name">${translate('forms.platformName')}</label>
          <input id="quick-platform-name" name="platformName" list="quick-entry-platforms" required>
        </div>
        <div class="field">
          <label for="quick-platform-currency">${translate('forms.defaultCurrency')}</label>
          <input id="quick-platform-currency" name="platformCurrency" value="${defaultCurrency}" required>
        </div>
        <div class="field">
          <label for="quick-pricing-mode">${translate('forms.pricingMode')}</label>
          <select id="quick-pricing-mode" name="pricingMode" required>
            <option value="direct_price_based">${translate('forms.directMode')}</option>
            <option value="plan_credit_based">${translate('forms.creditMode')}</option>
          </select>
        </div>
        <div class="field">
          <label for="quick-currency">${translate('forms.directCurrency')}</label>
          <input id="quick-currency" name="currency" value="${defaultCurrency}">
        </div>

        <div class="form-step span-3">
          <span>2</span>
          <div>
            <strong>${translate('quickEntry.planStep')}</strong>
            <p>${translate('quickEntry.planStepHint')}</p>
          </div>
        </div>
        <div class="field">
          <label for="quick-plan-id">${translate('quickEntry.existingPlan')}</label>
          <select id="quick-plan-id" name="planId">
            <option value="">${translate('quickEntry.noExistingPlan')}</option>
            ${state.plans.map((plan) => {
              const platform = state.platforms.find((item) => item.id === plan.platformId);
              return `<option value="${escapeHtml(plan.id)}">${escapeHtml(platform?.name ?? '')} - ${escapeHtml(plan.name)}</option>`;
            }).join('')}
          </select>
        </div>
        <div class="field">
          <label for="quick-plan-name">${translate('forms.planName')}</label>
          <input id="quick-plan-name" name="planName">
        </div>
        <div class="field">
          <label for="quick-plan-price">${translate('forms.price')}</label>
          <input id="quick-plan-price" name="planPrice" type="number" step="0.000001">
        </div>
        <div class="field">
          <label for="quick-credit-amount">${translate('forms.credits')}</label>
          <input id="quick-credit-amount" name="creditAmount" type="number" step="0.000001">
        </div>

        <div class="form-step span-3">
          <span>3</span>
          <div>
            <strong>${translate('quickEntry.modelStep')}</strong>
            <p>${translate('quickEntry.modelStepHint')}</p>
          </div>
        </div>
        <div class="field">
          <label for="quick-model-name">${translate('forms.modelName')}</label>
          <input id="quick-model-name" name="modelName" list="quick-entry-models" required>
        </div>
        <div class="field">
          <label for="quick-model-category">${translate('forms.category')}</label>
          <select id="quick-model-category" name="modelCategory" required>
            <option value="text">text</option>
            <option value="image">image</option>
            <option value="video">video</option>
            <option value="audio">audio</option>
          </select>
        </div>

        <div class="form-step span-3">
          <span>4</span>
          <div>
            <strong>${translate('quickEntry.priceStep')}</strong>
            <p>${translate('quickEntry.priceStepHint')}</p>
          </div>
        </div>
        <div class="field">
          <label for="quick-text-unit-size">${translate('quickEntry.textUnitSize')}</label>
          <input id="quick-text-unit-size" name="textUnitSize" type="number" step="1" value="1000000">
        </div>
        <div class="field">
          <label for="quick-text-input-price">${translate('quickEntry.textInputPrice')}</label>
          <input id="quick-text-input-price" name="textInputPrice" type="number" step="0.000001">
        </div>
        <div class="field">
          <label for="quick-text-output-price">${translate('quickEntry.textOutputPrice')}</label>
          <input id="quick-text-output-price" name="textOutputPrice" type="number" step="0.000001">
        </div>
        <div class="field">
          <label for="quick-text-cached-input-price">${translate('quickEntry.textCachedInputPrice')}</label>
          <input id="quick-text-cached-input-price" name="textCachedInputPrice" type="number" step="0.000001">
        </div>
        <div class="field">
          <label for="quick-text-input-credits">${translate('forms.textInputPer1k')}</label>
          <input id="quick-text-input-credits" name="textInputCreditsPer1k" type="number" step="0.000001">
        </div>
        <div class="field">
          <label for="quick-text-output-credits">${translate('forms.textOutputPer1k')}</label>
          <input id="quick-text-output-credits" name="textOutputCreditsPer1k" type="number" step="0.000001">
        </div>
        <div class="field">
          <label for="quick-text-cached-input-credits">${translate('forms.textCachedInputPer1k')}</label>
          <input id="quick-text-cached-input-credits" name="textCachedInputCreditsPer1k" type="number" step="0.000001">
        </div>
        <div class="field">
          <label for="quick-image-price">${translate('quickEntry.imagePrice')}</label>
          <input id="quick-image-price" name="imagePrice" type="number" step="0.000001">
        </div>
        <div class="field">
          <label for="quick-image-credits">${translate('forms.imagePerUnit')}</label>
          <input id="quick-image-credits" name="imageCreditsPerUnit" type="number" step="0.000001">
        </div>
        <div class="field">
          <label for="quick-media-price">${translate('quickEntry.mediaPrice')}</label>
          <input id="quick-media-price" name="mediaPrice" type="number" step="0.000001">
        </div>
        <div class="field">
          <label for="quick-media-unit-kind">${translate('quickEntry.mediaUnitKind')}</label>
          <select id="quick-media-unit-kind" name="mediaUnitKind">
            <option value="second">${translate('quickEntry.second')}</option>
            <option value="minute">${translate('quickEntry.minute')}</option>
          </select>
        </div>
        <div class="field">
          <label for="quick-media-unit-size">${translate('quickEntry.mediaUnitSize')}</label>
          <input id="quick-media-unit-size" name="mediaUnitSize" type="number" step="0.000001" value="1">
        </div>
        <div class="field">
          <label for="quick-video-second-credits">${translate('forms.videoPerSecond')}</label>
          <input id="quick-video-second-credits" name="videoCreditsPerSecond" type="number" step="0.000001">
        </div>
        <div class="field">
          <label for="quick-video-minute-credits">${translate('forms.videoPerMinute')}</label>
          <input id="quick-video-minute-credits" name="videoCreditsPerMinute" type="number" step="0.000001">
        </div>
        <div class="field">
          <label for="quick-audio-second-credits">${translate('forms.audioPerSecond')}</label>
          <input id="quick-audio-second-credits" name="audioCreditsPerSecond" type="number" step="0.000001">
        </div>
        <div class="field">
          <label for="quick-audio-minute-credits">${translate('forms.audioPerMinute')}</label>
          <input id="quick-audio-minute-credits" name="audioCreditsPerMinute" type="number" step="0.000001">
        </div>
        <div class="field span-3">
          <label for="quick-notes">${translate('forms.notes')}</label>
          <textarea id="quick-notes" name="notes"></textarea>
        </div>
        <div class="conversion-preview span-3" id="quick-entry-preview">
          <strong>${translate('quickEntry.previewTitle')}</strong>
          <p>${translate('quickEntry.previewEmpty')}</p>
        </div>
        <div class="field span-3">
          <button type="submit">${translate('quickEntry.save')}</button>
        </div>
      </form>
    </section>
  `;
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
        <div class="form-step span-3">
          <span>1</span>
          <div>
            <strong>选择网站、套餐和模型</strong>
            <p>先定位价格来自哪里，再填写该模型实际消耗。</p>
          </div>
        </div>
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
            <option value="plan_credit_based">${translate('forms.creditMode')}</option>
            <option value="direct_price_based">${translate('forms.directMode')}</option>
          </select>
        </div>
        <div class="field">
          <label for="rule-currency">${translate('forms.directCurrency')}</label>
          <input id="rule-currency" name="currency" value="USD">
        </div>
        <div class="field">
          <label for="rule-notes">${translate('forms.notes')}</label>
          <input id="rule-notes" name="notes">
        </div>
        <div class="form-step span-3">
          <span>2</span>
          <div>
            <strong>${translate('forms.consumptionTitle')}</strong>
            <p>积分换算时填“消耗多少积分”；直接价格时填“每单位多少钱”。只填当前模型类型需要的项目。</p>
          </div>
        </div>
        <div class="field consumption-field" data-consumption-field="textInputCreditsPer1k">
          <label for="text-input-value">${translate('forms.textInputPer1k')}</label>
          <input id="text-input-value" name="textInputCreditsPer1k" type="number" step="0.000001" placeholder="${translate('forms.consumptionSuffix')}">
        </div>
        <div class="field consumption-field" data-consumption-field="textOutputCreditsPer1k">
          <label for="text-output-value">${translate('forms.textOutputPer1k')}</label>
          <input id="text-output-value" name="textOutputCreditsPer1k" type="number" step="0.000001" placeholder="${translate('forms.consumptionSuffix')}">
        </div>
        <div class="field consumption-field" data-consumption-field="textCachedInputCreditsPer1k">
          <label for="text-cached-input-value">${translate('forms.textCachedInputPer1k')}</label>
          <input id="text-cached-input-value" name="textCachedInputCreditsPer1k" type="number" step="0.000001" placeholder="${translate('forms.consumptionSuffix')}">
        </div>
        <div class="field consumption-field" data-consumption-field="imageCreditsPerUnit">
          <label for="image-value">${translate('forms.imagePerUnit')}</label>
          <input id="image-value" name="imageCreditsPerUnit" type="number" step="0.000001" placeholder="${translate('forms.consumptionSuffix')}">
        </div>
        <div class="field consumption-field" data-consumption-field="videoCreditsPerSecond">
          <label for="video-second-value">${translate('forms.videoPerSecond')}</label>
          <input id="video-second-value" name="videoCreditsPerSecond" type="number" step="0.000001" placeholder="${translate('forms.consumptionSuffix')}">
        </div>
        <div class="field consumption-field" data-consumption-field="videoCreditsPerMinute">
          <label for="video-minute-value">${translate('forms.videoPerMinute')}</label>
          <input id="video-minute-value" name="videoCreditsPerMinute" type="number" step="0.000001" placeholder="${translate('forms.consumptionSuffix')}">
        </div>
        <div class="field consumption-field" data-consumption-field="audioCreditsPerSecond">
          <label for="audio-second-value">${translate('forms.audioPerSecond')}</label>
          <input id="audio-second-value" name="audioCreditsPerSecond" type="number" step="0.000001" placeholder="${translate('forms.consumptionSuffix')}">
        </div>
        <div class="field consumption-field" data-consumption-field="audioCreditsPerMinute">
          <label for="audio-minute-value">${translate('forms.audioPerMinute')}</label>
          <input id="audio-minute-value" name="audioCreditsPerMinute" type="number" step="0.000001" placeholder="${translate('forms.consumptionSuffix')}">
        </div>
        <div class="conversion-preview span-3" id="rule-preview">
          <strong>${translate('forms.conversionPreview')}</strong>
          <p>${translate('forms.previewPlan')}</p>
          <p>${translate('forms.previewUsage')}</p>
        </div>
        <div class="field span-3">
          <button type="submit">${translate('forms.saveRule')}</button>
        </div>
      </form>
    </section>
  `;
}

function renderPlanFormForPlatform(platform, translate) {
  return `
    <form class="grid-form compact" id="plan-form">
      <input type="hidden" name="platformId" value="${platform.id}">
      <div class="field">
        <label for="plan-name">${translate('forms.planName')}</label>
        <input id="plan-name" name="name" required>
      </div>
      <div class="field">
        <label for="plan-price">${translate('forms.price')}</label>
        <input id="plan-price" name="price" type="number" step="0.01" required>
      </div>
      <div class="field">
        <label for="plan-currency">${translate('forms.currency')}</label>
        <input id="plan-currency" name="currency" value="${escapeHtml(platform.defaultCurrency)}" required>
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
      <div class="field span-2">
        <label for="plan-notes">${translate('forms.notes')}</label>
        <textarea id="plan-notes" name="notes"></textarea>
      </div>
      <div class="field span-2">
        <button type="submit">${translate('forms.savePlan')}</button>
      </div>
    </form>
  `;
}

function renderRuleFormForPlatform(platform, translate) {
  return `
    <form class="grid-form compact" id="rule-form">
      <input type="hidden" name="platformId" value="${platform.id}">
      <div class="form-step span-3">
        <span>1</span>
        <div>
          <strong>选择模型和计费模式</strong>
          <p>网站已锁定为 ${escapeHtml(platform.name)}，请选择模型并填写消耗。</p>
        </div>
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
          <option value="plan_credit_based">${translate('forms.creditMode')}</option>
          <option value="direct_price_based">${translate('forms.directMode')}</option>
        </select>
      </div>
      <div class="field">
        <label for="rule-currency">${translate('forms.directCurrency')}</label>
        <input id="rule-currency" name="currency" value="${escapeHtml(platform.defaultCurrency)}">
      </div>
      <div class="field">
        <label for="rule-notes">${translate('forms.notes')}</label>
        <input id="rule-notes" name="notes">
      </div>
      <div class="form-step span-3">
        <span>2</span>
        <div>
          <strong>${translate('forms.consumptionTitle')}</strong>
          <p>积分换算时填"消耗多少积分"；直接价格时填"每单位多少钱"。只填当前模型类型需要的项目。</p>
        </div>
      </div>
      <div class="field consumption-field" data-consumption-field="textInputCreditsPer1k">
        <label for="text-input-value">${translate('forms.textInputPer1k')}</label>
        <input id="text-input-value" name="textInputCreditsPer1k" type="number" step="0.000001" placeholder="${translate('forms.consumptionSuffix')}">
      </div>
      <div class="field consumption-field" data-consumption-field="textOutputCreditsPer1k">
        <label for="text-output-value">${translate('forms.textOutputPer1k')}</label>
        <input id="text-output-value" name="textOutputCreditsPer1k" type="number" step="0.000001" placeholder="${translate('forms.consumptionSuffix')}">
      </div>
      <div class="field consumption-field" data-consumption-field="textCachedInputCreditsPer1k">
        <label for="text-cached-input-value">${translate('forms.textCachedInputPer1k')}</label>
        <input id="text-cached-input-value" name="textCachedInputCreditsPer1k" type="number" step="0.000001" placeholder="${translate('forms.consumptionSuffix')}">
      </div>
      <div class="field consumption-field" data-consumption-field="imageCreditsPerUnit">
        <label for="image-value">${translate('forms.imagePerUnit')}</label>
        <input id="image-value" name="imageCreditsPerUnit" type="number" step="0.000001" placeholder="${translate('forms.consumptionSuffix')}">
      </div>
      <div class="field consumption-field" data-consumption-field="videoCreditsPerSecond">
        <label for="video-second-value">${translate('forms.videoPerSecond')}</label>
        <input id="video-second-value" name="videoCreditsPerSecond" type="number" step="0.000001" placeholder="${translate('forms.consumptionSuffix')}">
      </div>
      <div class="field consumption-field" data-consumption-field="videoCreditsPerMinute">
        <label for="video-minute-value">${translate('forms.videoPerMinute')}</label>
        <input id="video-minute-value" name="videoCreditsPerMinute" type="number" step="0.000001" placeholder="${translate('forms.consumptionSuffix')}">
      </div>
      <div class="field consumption-field" data-consumption-field="audioCreditsPerSecond">
        <label for="audio-second-value">${translate('forms.audioPerSecond')}</label>
        <input id="audio-second-value" name="audioCreditsPerSecond" type="number" step="0.000001" placeholder="${translate('forms.consumptionSuffix')}">
      </div>
      <div class="field consumption-field" data-consumption-field="audioCreditsPerMinute">
        <label for="audio-minute-value">${translate('forms.audioPerMinute')}</label>
        <input id="audio-minute-value" name="audioCreditsPerMinute" type="number" step="0.000001" placeholder="${translate('forms.consumptionSuffix')}">
      </div>
      <div class="conversion-preview span-3" id="rule-preview">
        <strong>${translate('forms.conversionPreview')}</strong>
        <p>${translate('forms.previewPlan')}</p>
        <p>${translate('forms.previewUsage')}</p>
      </div>
      <div class="field span-3">
        <button type="submit">${translate('forms.saveRule')}</button>
      </div>
    </form>
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
        <label for="compare-mode">${translate('forms.comparisonMode')}</label>
        <select id="compare-mode" name="comparisonMode">
          <option value="unitPrice">${translate('forms.compareByModel')}</option>
          <option value="totalCost">${translate('forms.compareByTotalCost')}</option>
        </select>
      </div>
      
      <div class="field span-3">
        <div class="checkbox-group-header">
          <label>${translate('forms.filterPlatforms')}</label>
          <span class="checkbox-actions">
            <button type="button" class="btn-link" onclick="toggleAllCheckboxes('platform', true)">${translate('forms.selectAll')}</button>
            <button type="button" class="btn-link" onclick="toggleAllCheckboxes('platform', false)">${translate('forms.deselectAll')}</button>
          </span>
        </div>
        <div class="checkbox-list" id="platform-checkboxes">
          ${state.platforms.map((platform) => `
            <label class="checkbox-item">
              <input type="checkbox" name="platformIds" value="${platform.id}" class="compare-checkbox" data-type="platform">
              <span class="checkbox-label">${escapeHtml(platform.name)}</span>
            </label>
          `).join('')}
          ${state.platforms.length === 0 ? `<div class="checkbox-empty">${translate('forms.noData')}</div>` : ''}
        </div>
      </div>
      
      <div class="field span-3">
        <div class="checkbox-group-header">
          <label>${translate('forms.filterModels')}</label>
          <span class="checkbox-actions">
            <button type="button" class="btn-link" onclick="toggleAllCheckboxes('model', true)">${translate('forms.selectAll')}</button>
            <button type="button" class="btn-link" onclick="toggleAllCheckboxes('model', false)">${translate('forms.deselectAll')}</button>
          </span>
        </div>
        <div class="checkbox-list" id="model-checkboxes">
          ${state.models.map((model) => `
            <label class="checkbox-item">
              <input type="checkbox" name="modelIds" value="${model.id}" data-category="${model.category}" class="compare-checkbox" data-type="model">
              <span class="checkbox-label">${escapeHtml(model.name)}</span>
              <span class="checkbox-tag tag-${model.category}">${translate('category.' + model.category)}</span>
            </label>
          `).join('')}
          ${state.models.length === 0 ? `<div class="checkbox-empty">${translate('forms.noData')}</div>` : ''}
        </div>
      </div>

      <div class="field scenario-field" data-category="text">
        <label for="compare-input">${translate('forms.runtimeTextInput')}</label>
        <input id="compare-input" name="textInputTokens" type="number" step="1" value="${state.scenarioDefaults.textInputTokens}">
      </div>
      <div class="field scenario-field" data-category="text">
        <label for="compare-output">${translate('forms.runtimeTextOutput')}</label>
        <input id="compare-output" name="textOutputTokens" type="number" step="1" value="${state.scenarioDefaults.textOutputTokens}">
      </div>
      <div class="field scenario-field" data-category="image">
        <label for="compare-images">${translate('forms.runtimeImageCount')}</label>
        <input id="compare-images" name="imageCount" type="number" step="1" value="${state.scenarioDefaults.imageCount}">
      </div>
      <div class="field scenario-field" data-category="video">
        <label for="compare-video">${translate('forms.runtimeDurationSeconds')}</label>
        <input id="compare-video" name="videoSeconds" type="number" step="1" value="${state.scenarioDefaults.videoSeconds}">
        <span class="field-hint">${translate('forms.videoHint')}</span>
      </div>
      <div class="field scenario-field" data-category="audio">
        <label for="compare-audio">${translate('forms.runtimeDurationSeconds')}</label>
        <input id="compare-audio" name="audioMinutes" type="number" step="1" value="${state.scenarioDefaults.audioMinutes * 60}">
        <span class="field-hint">${translate('forms.audioHint')}</span>
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
    return `
      <div class="empty-guide">
        <div class="empty">${translate('results.empty')}</div>
        <div class="guide-steps">
          <div class="guide-step">
            <span class="guide-step-num">1</span>
            <div>
              <strong>${translate('results.guideStep1Title')}</strong>
              <p>${translate('results.guideStep1Desc')}</p>
            </div>
          </div>
          <div class="guide-step">
            <span class="guide-step-num">2</span>
            <div>
              <strong>${translate('results.guideStep2Title')}</strong>
              <p>${translate('results.guideStep2Desc')}</p>
            </div>
          </div>
          <div class="guide-step">
            <span class="guide-step-num">3</span>
            <div>
              <strong>${translate('results.guideStep3Title')}</strong>
              <p>${translate('results.guideStep3Desc')}</p>
            </div>
          </div>
          <div class="guide-step">
            <span class="guide-step-num">4</span>
            <div>
              <strong>${translate('results.guideStep4Title')}</strong>
              <p>${translate('results.guideStep4Desc')}</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  const comparisonMode = document.querySelector('#compare-mode')?.value || 'unitPrice';

  if (comparisonMode === 'unitPrice') {
    return renderUnitPriceComparison(translate);
  } else {
    return renderTotalCostComparison(translate);
  }
}

function renderUnitPriceComparison(translate) {
  const groupedByModel = {};
  comparisonRows.forEach((row) => {
    if (!groupedByModel[row.modelName]) {
      groupedByModel[row.modelName] = [];
    }
    groupedByModel[row.modelName].push(row);
  });

  const targetCurrency = state.preferences?.targetCurrency ?? 'CNY';

  return `
    <div class="comparison-section">
      <h3>${translate('forms.unitPrice')} - ${translate('results.modelComparison')}</h3>
      ${Object.entries(groupedByModel).map(([modelName, rows]) => {
        const costs = rows.map((r) => r.singleRunCost);
        const minCost = Math.min(...costs);
        const maxCost = Math.max(...costs);
        return `
          <div class="model-group">
            <div class="model-group-header">
              <h4>${escapeHtml(modelName)}</h4>
              <span class="model-price-range">
                ${minCost === maxCost 
                  ? `${minCost} ${escapeHtml(targetCurrency)}` 
                  : `${minCost} ~ ${maxCost} ${escapeHtml(targetCurrency)}`}
              </span>
            </div>
            <table class="comparison-table model-comparison">
              <thead>
                <tr>
                  <th>${translate('resultsTable.platform')}</th>
                  <th>${translate('resultsTable.pricingMode')}</th>
                  <th>${translate('resultsTable.planName')}</th>
                  <th>${translate('resultsTable.convertedUnitCost')}</th>
                  <th>${translate('resultsTable.singleRunCost')}</th>
                  <th>${translate('resultsTable.rank')}</th>
                </tr>
              </thead>
              <tbody>
                ${rows
                  .sort((a, b) => a.singleRunCost - b.singleRunCost)
                  .map((row, index) => `
                    <tr class="${index === 0 ? 'best-price' : ''} ${index === rows.length - 1 && rows.length > 1 ? 'worst-price' : ''}">
                      <td title="${escapeHtml(row.platformName)}">${escapeHtml(row.platformName)}</td>
                      <td>${escapeHtml(getPricingModeLabel(row.pricingMode))}</td>
                      <td title="${escapeHtml(row.planName || '-')}">${escapeHtml(row.planName || '-')}</td>
                      <td>${row.convertedUnitCost != null ? `${row.convertedUnitCost} ${escapeHtml(targetCurrency)}` : '-'}</td>
                      <td><strong>${row.singleRunCost != null ? `${row.singleRunCost} ${escapeHtml(targetCurrency)}` : `<span class="text-muted">${translate('results.needPlan')}</span>`}</strong></td>
                      <td>
                        ${row.singleRunCost != null ? (
                          index === 0 ? `<span class="rank-badge best">${translate('results.lowestPrice')}</span>` :
                          index === rows.length - 1 && rows.length > 1 ? `<span class="rank-badge worst">${translate('results.highestPrice')}</span>` : ''
                        ) : ''}
                      </td>
                    </tr>
                  `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }).join('')}
      ${renderModelComparisonChart(groupedByModel, targetCurrency, translate)}
    </div>
  `;
}

function renderTotalCostComparison(translate) {
  const groupedByModel = {};
  comparisonRows.forEach((row) => {
    if (!groupedByModel[row.modelName]) {
      groupedByModel[row.modelName] = [];
    }
    groupedByModel[row.modelName].push(row);
  });

  const targetCurrency = state.preferences?.targetCurrency ?? 'CNY';
  const scenario = getScenarioFromForm();

  return `
    <div class="comparison-section">
      <h3>${translate('forms.totalCost')} - ${translate('results.modelComparison')}</h3>
      ${Object.entries(groupedByModel).map(([modelName, rows]) => {
        const totalCosts = rows.map((r) => ({
          ...r,
          totalCost: r.singleRunCost != null ? roundDisplay(r.singleRunCost * getQuantity(r.category, scenario)) : null,
        }));
        const validCosts = totalCosts.filter((r) => r.totalCost != null).map((r) => r.totalCost);
        const minCost = validCosts.length > 0 ? Math.min(...validCosts) : null;
        const maxCost = validCosts.length > 0 ? Math.max(...validCosts) : null;
        const quantity = getQuantity(rows[0]?.category, scenario);
        return `
          <div class="model-group">
            <div class="model-group-header">
              <h4>${escapeHtml(modelName)}</h4>
              <span class="model-price-range">
                ${translate('results.quantity')}: ${quantity} ${getQuantityUnit(rows[0]?.category)}
                ${minCost != null && maxCost != null
                  ? (minCost === maxCost 
                      ? ` | ${minCost} ${escapeHtml(targetCurrency)}` 
                      : ` | ${minCost} ~ ${maxCost} ${escapeHtml(targetCurrency)}`)
                  : ''}
              </span>
            </div>
            <table class="comparison-table model-comparison">
              <thead>
                <tr>
                  <th>${translate('resultsTable.platform')}</th>
                  <th>${translate('resultsTable.pricingMode')}</th>
                  <th>${translate('resultsTable.planName')}</th>
                  <th>${translate('forms.unitPrice')}</th>
                  <th>${translate('forms.totalCost')}</th>
                  <th>${translate('resultsTable.rank')}</th>
                </tr>
              </thead>
              <tbody>
                ${totalCosts
                  .sort((a, b) => (a.totalCost ?? Infinity) - (b.totalCost ?? Infinity))
                  .map((row, index) => `
                    <tr class="${index === 0 && row.totalCost != null ? 'best-price' : ''} ${index === totalCosts.length - 1 && totalCosts.length > 1 && row.totalCost != null ? 'worst-price' : ''}">
                      <td title="${escapeHtml(row.platformName)}">${escapeHtml(row.platformName)}</td>
                      <td>${escapeHtml(getPricingModeLabel(row.pricingMode))}</td>
                      <td title="${escapeHtml(row.planName || '-')}">${escapeHtml(row.planName || '-')}</td>
                      <td>${row.singleRunCost != null ? `${row.singleRunCost} ${escapeHtml(targetCurrency)}` : '-'}</td>
                      <td><strong>${row.totalCost != null ? `${row.totalCost} ${escapeHtml(targetCurrency)}` : `<span class="text-muted">${translate('results.needPlan')}</span>`}</strong></td>
                      <td>
                        ${row.totalCost != null ? (
                          index === 0 ? `<span class="rank-badge best">${translate('results.lowestPrice')}</span>` :
                          index === totalCosts.length - 1 && totalCosts.length > 1 ? `<span class="rank-badge worst">${translate('results.highestPrice')}</span>` : ''
                        ) : ''}
                      </td>
                    </tr>
                  `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }).join('')}
      ${renderTotalCostChart(groupedByModel, targetCurrency, translate, scenario)}
    </div>
  `;
}

function renderPlatformComparisonTable(translate) {
  const targetCurrency = state.preferences?.targetCurrency ?? 'CNY';

  return `
    <table class="comparison-table">
      <thead>
        <tr>
          <th>${translate('resultsTable.platform')}</th>
          <th>${translate('resultsTable.comparisonType')}</th>
          <th>${translate('resultsTable.model')}</th>
          <th>${translate('resultsTable.pricingMode')}</th>
          <th>${translate('resultsTable.planName')}</th>
          <th>${translate('resultsTable.usageAmount')}</th>
          <th>${translate('resultsTable.originalUnitCost')}</th>
          <th>${translate('resultsTable.convertedUnitCost')}</th>
          <th>${translate('resultsTable.singleRunCost')}</th>
        </tr>
      </thead>
      <tbody>
        ${comparisonRows.map((row) => `
          <tr>
            <td title="${escapeHtml(row.platformName)}">${escapeHtml(row.platformName)}</td>
            <td><span class="type-pill">${escapeHtml(getCategoryLabel(row.comparisonType))}</span></td>
            <td title="${escapeHtml(row.modelName)}">${escapeHtml(row.modelName)}</td>
            <td>${escapeHtml(getPricingModeLabel(row.pricingMode))}</td>
            <td title="${escapeHtml(row.planName || '-')}">${escapeHtml(row.planName || '-')}</td>
            <td>${formatUsageAmount(row)}</td>
            <td>${row.originalUnitCost} ${escapeHtml(row.originalCurrency)}</td>
            <td>${row.convertedUnitCost} ${escapeHtml(targetCurrency)}</td>
            <td><strong>${row.singleRunCost} ${escapeHtml(targetCurrency)}</strong></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderModelComparisonChart(groupedByModel, targetCurrency, translate) {
  const modelNames = Object.keys(groupedByModel);
  if (modelNames.length === 0) return '';

  const chartData = modelNames.map((modelName) => {
    const rows = groupedByModel[modelName];
    return {
      modelName,
      platforms: rows.map((row) => ({
        platformName: row.platformName,
        planName: row.planName,
        singleRunCost: row.singleRunCost,
      })),
    };
  });

  const allCosts = chartData.flatMap((d) => d.platforms.map((p) => p.singleRunCost));
  const maxCost = Math.max(...allCosts);
  const chartHeight = 200;

  return `
    <div class="chart-section">
      <h4>${translate('results.costChart')}</h4>
      <div class="chart-container">
        ${chartData.map((modelData) => {
          const modelCosts = modelData.platforms.map((p) => p.singleRunCost);
          const modelMin = Math.min(...modelCosts);
          const modelMax = Math.max(...modelCosts);
          return `
            <div class="chart-group">
              <div class="chart-group-header">
                <div class="chart-group-title">${escapeHtml(modelData.modelName)}</div>
                <div class="chart-group-legend">
                  <span class="legend-item legend-min">${translate('results.lowest')}: ${modelMin} ${escapeHtml(targetCurrency)}</span>
                  <span class="legend-item legend-max">${translate('results.highest')}: ${modelMax} ${escapeHtml(targetCurrency)}</span>
                </div>
              </div>
              <div class="chart-bars">
                ${modelData.platforms.map((platform) => {
                  const barHeight = maxCost > 0 ? (platform.singleRunCost / maxCost) * chartHeight : 0;
                  const isMin = platform.singleRunCost === modelMin && modelData.platforms.length > 1;
                  const isMax = platform.singleRunCost === modelMax && modelData.platforms.length > 1;
                  const label = platform.planName 
                    ? `${platform.platformName} (${platform.planName})` 
                    : platform.platformName;
                  return `
                    <div class="chart-bar-wrapper">
                      <div class="chart-bar ${isMin ? 'bar-min' : ''} ${isMax ? 'bar-max' : ''}" style="height: ${barHeight}px;">
                        <span class="chart-bar-value">${platform.singleRunCost}</span>
                      </div>
                      <div class="chart-bar-label">${escapeHtml(label)}</div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderTotalCostChart(groupedByModel, targetCurrency, translate, scenario) {
  const modelNames = Object.keys(groupedByModel);
  if (modelNames.length === 0) return '';

  const chartData = modelNames.map((modelName) => {
    const rows = groupedByModel[modelName];
    const category = rows[0]?.category;
    const quantity = getQuantity(category, scenario);
    return {
      modelName,
      category,
      quantity,
      platforms: rows.map((row) => ({
        platformName: row.platformName,
        planName: row.planName,
        totalCost: roundDisplay(row.singleRunCost * quantity),
      })),
    };
  });

  const allCosts = chartData.flatMap((d) => d.platforms.map((p) => p.totalCost));
  const maxCost = Math.max(...allCosts);
  const chartHeight = 200;

  return `
    <div class="chart-section">
      <h4>${translate('forms.totalCost')} - ${translate('results.costChart')}</h4>
      <div class="chart-container">
        ${chartData.map((modelData) => {
          const modelCosts = modelData.platforms.map((p) => p.totalCost);
          const modelMin = Math.min(...modelCosts);
          const modelMax = Math.max(...modelCosts);
          return `
            <div class="chart-group">
              <div class="chart-group-header">
                <div class="chart-group-title">${escapeHtml(modelData.modelName)}</div>
                <div class="chart-group-legend">
                  <span class="legend-item">${modelData.quantity} ${getQuantityUnit(modelData.category)}</span>
                  <span class="legend-item legend-min">${translate('results.lowest')}: ${modelMin} ${escapeHtml(targetCurrency)}</span>
                  <span class="legend-item legend-max">${translate('results.highest')}: ${modelMax} ${escapeHtml(targetCurrency)}</span>
                </div>
              </div>
              <div class="chart-bars">
                ${modelData.platforms.map((platform) => {
                  const barHeight = maxCost > 0 ? (platform.totalCost / maxCost) * chartHeight : 0;
                  const isMin = platform.totalCost === modelMin && modelData.platforms.length > 1;
                  const isMax = platform.totalCost === modelMax && modelData.platforms.length > 1;
                  const label = platform.planName 
                    ? `${platform.platformName} (${platform.planName})` 
                    : platform.platformName;
                  return `
                    <div class="chart-bar-wrapper">
                      <div class="chart-bar ${isMin ? 'bar-min' : ''} ${isMax ? 'bar-max' : ''}" style="height: ${barHeight}px;">
                        <span class="chart-bar-value">${platform.totalCost}</span>
                      </div>
                      <div class="chart-bar-label">${escapeHtml(label)}</div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
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
      <div class="card-actions">
        <button class="btn-edit" data-action="edit" data-type="platform" data-id="${platform.id}">${translate('cards.edit')}</button>
        <button class="btn-delete" data-action="delete" data-type="platform" data-id="${platform.id}">${translate('cards.delete')}</button>
      </div>
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
      <div class="card-actions">
        <button class="btn-edit" data-action="edit" data-type="plan" data-id="${plan.id}">${translate('cards.edit')}</button>
        <button class="btn-delete" data-action="delete" data-type="plan" data-id="${plan.id}">${translate('cards.delete')}</button>
      </div>
    </article>
  `;
}

function renderModelCard(model, translate) {
  return `
    <article class="card">
      <strong>${escapeHtml(model.name)}</strong>
      <span class="meta">${escapeHtml(model.category)}</span>
      <div class="card-actions">
        <button class="btn-edit" data-action="edit" data-type="model" data-id="${model.id}">${translate('cards.edit')}</button>
        <button class="btn-delete" data-action="delete" data-type="model" data-id="${model.id}">${translate('cards.delete')}</button>
      </div>
    </article>
  `;
}

function renderRuleCard(rule, translate) {
  const platform = state.platforms.find((item) => item.id === rule.platformId);
  const model = state.models.find((item) => item.id === rule.modelId);
  const platformPlans = state.plans.filter((item) => item.platformId === rule.platformId);
  const hasPlanIssue = rule.pricingMode === 'plan_credit_based' && platformPlans.length === 0;
  
  return `
    <article class="card ${hasPlanIssue ? 'card-warning' : ''}">
      <strong>${escapeHtml(model?.name || translate('cards.unknownModel'))}</strong>
      <span class="meta">${escapeHtml(platform?.name || translate('cards.unknownPlatform'))} · ${escapeHtml(getPricingModeLabel(rule.pricingMode))}</span>
      <div class="chips">
        <span class="chip">${escapeHtml(getCategoryLabel(model?.category))}</span>
        ${hasPlanIssue 
          ? '<span class="chip chip-warning">该网站无套餐</span>'
          : (platformPlans.length > 0 ? `<span class="chip chip-plan">${platformPlans.length}个套餐</span>` : '')
        }
        ${rule.unitDefinitions.map((unit) => `<span class="chip">${escapeHtml(getUnitTypeLabel(unit.unitType))}: ${unit.value}</span>`).join('')}
      </div>
      <div class="card-actions">
        <button class="btn-edit" data-action="edit" data-type="rule" data-id="${rule.id}">${translate('cards.edit')}</button>
        <button class="btn-delete" data-action="delete" data-type="rule" data-id="${rule.id}">${translate('cards.delete')}</button>
      </div>
    </article>
  `;
}

window.toggleAllCheckboxes = function(type, checked) {
  const selector = type === 'platform' ? '#platform-checkboxes' : '#model-checkboxes';
  const container = document.querySelector(selector);
  if (container) {
    container.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.checked = checked;
    });
  }
};

function bindEvents() {
  document.querySelector('#quick-entry-form')?.addEventListener('submit', handleQuickEntrySubmit);
  document.querySelector('#quick-entry-form')?.addEventListener('input', updateQuickEntryPreview);
  document.querySelector('#quick-entry-form')?.addEventListener('change', updateQuickEntryPreview);
  document.querySelector('#platform-form')?.addEventListener('submit', handlePlatformSubmit);
  document.querySelector('#plan-form')?.addEventListener('submit', handlePlanSubmit);
  document.querySelector('#model-form')?.addEventListener('submit', handleModelSubmit);
  document.querySelector('#rule-form')?.addEventListener('submit', handleRuleSubmit);
  document.querySelector('#settings-form')?.addEventListener('submit', handleSettingsSubmit);
  document.querySelector('#comparison-form')?.addEventListener('submit', handleComparisonSubmit);
  document.querySelectorAll('.compare-checkbox').forEach((cb) => {
    cb.addEventListener('change', updateScenarioFieldVisibility);
  });
  document.querySelector('#rule-form')?.addEventListener('input', handleRulePreviewChange);
  document.querySelector('#rule-form')?.addEventListener('change', handleRulePreviewChange);
  document.querySelector('#export-json')?.addEventListener('click', handleExport);
  document.querySelector('#import-json')?.addEventListener('change', handleImport);
  document.querySelector('#reset-demo')?.addEventListener('click', handleLoadDemo);
  document.querySelectorAll('[data-tab-group]').forEach((button) => {
    button.addEventListener('click', handleTabClick);
  });
  document.querySelectorAll('.card-actions').forEach((container) => {
    container.addEventListener('click', handleCardAction);
  });
  document.querySelector('#btn-fullscreen')?.addEventListener('click', openFullscreen);
  document.querySelector('#btn-close-fullscreen')?.addEventListener('click', closeFullscreen);
  document.querySelector('#platform-selector')?.addEventListener('change', handlePlatformSelectorChange);
  document.querySelector('#btn-add-platform')?.addEventListener('click', handleAddPlatformClick);
  updateRulePreview();
  updateQuickEntryPreview();
  updateScenarioFieldVisibility();
}

function handleTabClick(event) {
  const button = event.currentTarget;
  tabState[button.dataset.tabGroup] = button.dataset.tabValue;
  render();
}

function handlePlatformSelectorChange(event) {
  tabState.selectedPlatformId = event.target.value || null;
  render();
}

async function handleAddPlatformClick() {
  const locale = getLocale();
  const translate = createTranslator(locale);
  
  const name = prompt('请输入网站名称：');
  if (!name || !name.trim()) return;
  
  const currency = prompt('请输入默认币种（如 CNY、USD）：', 'CNY');
  if (!currency || !currency.trim()) return;
  
  const platform = {
    id: createId('platform'),
    name: name.trim(),
    defaultCurrency: currency.trim().toUpperCase(),
    notes: '',
  };
  
  await updateState((draft) => {
    draft.platforms.push(platform);
  }, t('flash.platformSaved'));
  
  tabState.selectedPlatformId = platform.id;
  render();
}

function openFullscreen() {
  const modal = document.querySelector('#fullscreen-modal');
  if (modal) {
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
}

function closeFullscreen() {
  const modal = document.querySelector('#fullscreen-modal');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }
}

function handleRulePreviewChange() {
  updateRulePreview();
}

async function handleQuickEntrySubmit(event) {
  event.preventDefault();

  try {
    const draft = buildQuickEntryDraftFromForm(new FormData(event.currentTarget));
    const result = buildQuickEntryMutation({ state, draft, createId });
    state = await repository.saveState(result.nextState);
    comparisonRows = [];
    setFlash('success', t('flash.quickEntrySaved'));
    render();
  } catch (error) {
    setFlash('error', error instanceof Error ? error.message : t('flash.invalidUnits'));
    render();
  }
}

async function handlePlatformSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const editId = form.dataset.editId;
  
  if (editId) {
    const platform = {
      id: editId,
      name: String(formData.get('name')).trim(),
      defaultCurrency: String(formData.get('defaultCurrency')).trim().toUpperCase(),
      notes: String(formData.get('notes')).trim(),
    };
    await updateState((draft) => {
      const index = draft.platforms.findIndex((item) => item.id === editId);
      if (index !== -1) {
        draft.platforms[index] = platform;
      }
    }, t('flash.platformUpdated'));
  } else {
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
  
  form.reset();
  delete form.dataset.editId;
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.textContent = t('forms.savePlatform');
}

async function handlePlanSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const editId = form.dataset.editId;
  
  if (editId) {
    const plan = {
      id: editId,
      platformId: String(formData.get('platformId')),
      name: String(formData.get('name')).trim(),
      price: Number(formData.get('price')),
      currency: String(formData.get('currency')).trim().toUpperCase(),
      billingCycle: String(formData.get('billingCycle')).trim(),
      creditAmount: formData.get('creditAmount') ? Number(formData.get('creditAmount')) : null,
      notes: String(formData.get('notes')).trim(),
    };
    await updateState((draft) => {
      const index = draft.plans.findIndex((item) => item.id === editId);
      if (index !== -1) {
        draft.plans[index] = plan;
      }
    }, t('flash.planUpdated'));
  } else {
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
  
  form.reset();
  delete form.dataset.editId;
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.textContent = t('forms.savePlan');
}

async function handleModelSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const editId = form.dataset.editId;
  
  if (editId) {
    const model = {
      id: editId,
      name: String(formData.get('name')).trim(),
      category: String(formData.get('category')),
    };
    await updateState((draft) => {
      const index = draft.models.findIndex((item) => item.id === editId);
      if (index !== -1) {
        draft.models[index] = model;
      }
    }, t('flash.modelUpdated'));
  } else {
    const model = {
      id: createId('model'),
      name: String(formData.get('name')).trim(),
      category: String(formData.get('category')),
    };
    await updateState((draft) => {
      draft.models.push(model);
    }, t('flash.modelSaved'));
  }
  
  form.reset();
  delete form.dataset.editId;
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.textContent = t('forms.saveModel');
}

async function handleRuleSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const editId = form.dataset.editId;
  const modelId = String(formData.get('modelId'));
  const model = state.models.find((item) => item.id === modelId);
  const pricingMode = String(formData.get('pricingMode'));

  if (!model) {
    setFlash('error', t('flash.invalidModel'));
    render();
    return;
  }

  if (pricingMode === 'plan_credit_based') {
    const platformId = String(formData.get('platformId'));
    const platformPlans = state.plans.filter((item) => item.platformId === platformId);
    if (platformPlans.length === 0) {
      setFlash('error', t('flash.requirePlan'));
      render();
      return;
    }
  }

  const unitDefinitions = buildUnitDefinitions({
    category: model.category,
    values: Object.fromEntries(formData.entries()),
  });

  if (unitDefinitions.length === 0) {
    setFlash('error', t('flash.invalidUnits'));
    render();
    return;
  }

  if (editId) {
    const rule = {
      id: editId,
      platformId: String(formData.get('platformId')),
      modelId,
      pricingMode,
      currency: String(formData.get('currency')).trim().toUpperCase(),
      unitDefinitions,
      notes: String(formData.get('notes')).trim(),
    };
    await updateState((draft) => {
      const index = draft.rules.findIndex((item) => item.id === editId);
      if (index !== -1) {
        draft.rules[index] = rule;
      }
    }, t('flash.ruleUpdated'));
  } else {
    const rule = {
      id: createId('rule'),
      platformId: String(formData.get('platformId')),
      modelId,
      pricingMode,
      currency: String(formData.get('currency')).trim().toUpperCase(),
      unitDefinitions,
      notes: String(formData.get('notes')).trim(),
    };
    await updateState((draft) => {
      draft.rules.push(rule);
    }, t('flash.ruleSaved'));
  }
  
  form.reset();
  delete form.dataset.editId;
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.textContent = t('forms.saveRule');
  updateRulePreview();
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
  const platformIds = formData.getAll('platformIds');
  const modelIds = formData.getAll('modelIds');
  const comparisonMode = String(formData.get('comparisonMode')) || 'unitPrice';
  const audioSeconds = Number(formData.get('audioMinutes')) || 0;
  const filters = {
    platformIds,
    modelIds,
    comparisonMode,
    targetCurrency: state.preferences?.targetCurrency ?? 'CNY',
    scenario: {
      textInputTokens: Number(formData.get('textInputTokens')),
      textOutputTokens: Number(formData.get('textOutputTokens')),
      imageCount: Number(formData.get('imageCount')),
      videoSeconds: Number(formData.get('videoSeconds')),
      audioMinutes: audioSeconds / 60,
    },
  };

  if (platformIds.length === 0 || modelIds.length === 0) {
    setFlash('error', t('flash.requireSelection'));
    render();
    return;
  }

  try {
    comparisonRows = buildComparisonRows({ state, filters });
    setFlash('success', `${t('flash.generatedPrefix')} ${comparisonRows.length} ${t('flash.generatedSuffix')}`);
  } catch (error) {
    setFlash('error', error instanceof Error ? error.message : t('flash.generateFailed'));
  }

  render();
}

function handleCardAction(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;

  const action = button.dataset.action;
  const type = button.dataset.type;
  const id = button.dataset.id;

  if (action === 'edit') {
    handleEdit(type, id);
  } else if (action === 'delete') {
    handleDelete(type, id);
  }
}

function handleEdit(type, id) {
  const locale = getLocale();
  const translate = createTranslator(locale);

  switch (type) {
    case 'platform': {
      const platform = state.platforms.find((item) => item.id === id);
      if (!platform) return;
      populatePlatformForm(platform, translate);
      break;
    }
    case 'plan': {
      const plan = state.plans.find((item) => item.id === id);
      if (!plan) return;
      populatePlanForm(plan, translate);
      break;
    }
    case 'model': {
      const model = state.models.find((item) => item.id === id);
      if (!model) return;
      populateModelForm(model, translate);
      break;
    }
    case 'rule': {
      const rule = state.rules.find((item) => item.id === id);
      if (!rule) return;
      populateRuleForm(rule, translate);
      break;
    }
  }
}

function handleDelete(type, id) {
  const locale = getLocale();
  const translate = createTranslator(locale);
  const confirmed = confirm(translate('cards.confirmDelete'));
  if (!confirmed) return;

  switch (type) {
    case 'platform':
      deletePlatform(id);
      break;
    case 'plan':
      deletePlan(id);
      break;
    case 'model':
      deleteModel(id);
      break;
    case 'rule':
      deleteRule(id);
      break;
  }
}

function populatePlatformForm(platform, translate) {
  const form = document.querySelector('#platform-form');
  if (!form) return;
  form.dataset.editId = platform.id;
  form.querySelector('#platform-name').value = platform.name;
  form.querySelector('#platform-currency').value = platform.defaultCurrency;
  form.querySelector('#platform-notes').value = platform.notes || '';
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.textContent = translate('forms.updatePlatform') || '更新网站';
}

function populatePlanForm(plan, translate) {
  const form = document.querySelector('#plan-form');
  if (!form) return;
  form.dataset.editId = plan.id;
  form.querySelector('#plan-platform-id').value = plan.platformId;
  form.querySelector('#plan-name').value = plan.name;
  form.querySelector('#plan-price').value = plan.price;
  form.querySelector('#plan-currency').value = plan.currency;
  form.querySelector('#plan-cycle').value = plan.billingCycle;
  form.querySelector('#plan-credits').value = plan.creditAmount || '';
  form.querySelector('#plan-notes').value = plan.notes || '';
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.textContent = translate('forms.updatePlan') || '更新套餐';
}

function populateModelForm(model, translate) {
  const form = document.querySelector('#model-form');
  if (!form) return;
  form.dataset.editId = model.id;
  form.querySelector('#model-name').value = model.name;
  form.querySelector('#model-category').value = model.category;
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.textContent = translate('forms.updateModel') || '更新模型';
}

function populateRuleForm(rule, translate) {
  const form = document.querySelector('#rule-form');
  if (!form) return;
  form.dataset.editId = rule.id;
  form.querySelector('#rule-platform-id').value = rule.platformId;
  form.querySelector('#rule-model-id').value = rule.modelId;
  form.querySelector('#rule-mode').value = rule.pricingMode;
  const planInput = form.querySelector('#rule-plan-id');
  if (planInput) {
    planInput.value = rule.planId || '';
  }
  form.querySelector('#rule-currency').value = rule.currency;
  form.querySelector('#rule-notes').value = rule.notes || '';
  
  rule.unitDefinitions.forEach((unit) => {
    const inputName = getUnitInputName(unit.unitType);
    const input = form.querySelector(`[name="${inputName}"]`);
    if (input) input.value = unit.value;
  });
  
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.textContent = translate('forms.updateRule') || '更新模型价格';
  updateRulePreview();
}

function getUnitInputName(unitType) {
  const mapping = {
    'per_1k_input_tokens': 'textInputCreditsPer1k',
    'per_1k_output_tokens': 'textOutputCreditsPer1k',
    'per_1k_cached_input_tokens': 'textCachedInputCreditsPer1k',
    'per_image': 'imageCreditsPerUnit',
    'per_second': 'videoCreditsPerSecond',
    'per_minute': 'videoCreditsPerMinute',
  };
  return mapping[unitType] || unitType;
}

async function deletePlatform(id) {
  await updateState((draft) => {
    draft.platforms = draft.platforms.filter((item) => item.id !== id);
    draft.plans = draft.plans.filter((item) => item.platformId !== id);
    draft.rules = draft.rules.filter((item) => item.platformId !== id);
  }, t('flash.platformDeleted'));
}

async function deletePlan(id) {
  await updateState((draft) => {
    draft.plans = draft.plans.filter((item) => item.id !== id);
    draft.rules = draft.rules.filter((item) => item.planId !== id);
  }, t('flash.planDeleted'));
}

async function deleteModel(id) {
  await updateState((draft) => {
    draft.models = draft.models.filter((item) => item.id !== id);
    draft.rules = draft.rules.filter((item) => item.modelId !== id);
  }, t('flash.modelDeleted'));
}

async function deleteRule(id) {
  await updateState((draft) => {
    draft.rules = draft.rules.filter((item) => item.id !== id);
  }, t('flash.ruleDeleted'));
}

function updateScenarioFieldVisibility() {
  const checkboxes = document.querySelectorAll('.compare-checkbox[data-type="model"]');
  const selectedCategories = new Set();
  checkboxes.forEach((cb) => {
    if (cb.checked) {
      selectedCategories.add(cb.dataset.category);
    }
  });

  document.querySelectorAll('.scenario-field').forEach((field) => {
    const fieldCategory = field.dataset.category;
    if (selectedCategories.size === 0) {
      field.style.display = '';
    } else {
      field.style.display = selectedCategories.has(fieldCategory) ? '' : 'none';
    }
  });
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
  setFlash('success', t('flash.exportDone'));
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
  tabState.entry = 'quickEntry';
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

function getScenarioFromForm() {
  const form = document.querySelector('#comparison-form');
  if (!form) return state.scenarioDefaults;
  const formData = new FormData(form);
  const audioSeconds = Number(formData.get('audioMinutes')) || 0;
  return {
    textInputTokens: Number(formData.get('textInputTokens')) || state.scenarioDefaults.textInputTokens,
    textOutputTokens: Number(formData.get('textOutputTokens')) || state.scenarioDefaults.textOutputTokens,
    imageCount: Number(formData.get('imageCount')) || state.scenarioDefaults.imageCount,
    videoSeconds: Number(formData.get('videoSeconds')) || state.scenarioDefaults.videoSeconds,
    audioMinutes: audioSeconds / 60,
  };
}

function getQuantity(category, scenario) {
  switch (category) {
    case 'text':
      return 1;
    case 'image':
      return scenario.imageCount || 1;
    case 'video':
      return scenario.videoSeconds || 1;
    case 'audio':
      return (scenario.audioMinutes || 1) * 60;
    default:
      return 1;
  }
}

function getQuantityUnit(category) {
  switch (category) {
    case 'text':
      return '次';
    case 'image':
      return '张';
    case 'video':
      return '秒';
    case 'audio':
      return '秒';
    default:
      return '单位';
  }
}

function roundDisplay(value) {
  return Number(value.toFixed(6));
}

function updateQuickEntryPreview() {
  const form = document.querySelector('#quick-entry-form');
  const preview = document.querySelector('#quick-entry-preview');
  if (!form || !preview) {
    return;
  }

  try {
    const draft = buildQuickEntryDraftFromForm(new FormData(form));
    const errors = validateQuickEntryDraft(draft, { state });
    if (errors.length > 0) {
      preview.innerHTML = `
        <strong>${t('quickEntry.previewTitle')}</strong>
        <p>${escapeHtml(errors.join(' '))}</p>
      `;
      return;
    }

    preview.innerHTML = `
      <strong>${t('quickEntry.previewTitle')}</strong>
      <div class="preview-grid">
        <span>${t('forms.platformName')}</span>
        <b>${escapeHtml(draft.platformName || '-')}</b>
        <span>${t('forms.modelName')}</span>
        <b>${escapeHtml(draft.modelName || '-')} (${escapeHtml(draft.modelCategory || '-')})</b>
        <span>${t('forms.pricingMode')}</span>
        <b>${escapeHtml(getPricingModeLabel(draft.pricingMode))}</b>
        <span>${t('quickEntry.normalizedUnits')}</span>
        <b>${formatUnitDefinitions(draft.unitDefinitions)}</b>
      </div>
    `;
  } catch (error) {
    preview.innerHTML = `
      <strong>${t('quickEntry.previewTitle')}</strong>
      <p>${escapeHtml(error instanceof Error ? error.message : String(error))}</p>
    `;
  }
}

function buildQuickEntryDraftFromForm(formData) {
  const values = Object.fromEntries(formData.entries());
  const pricingMode = String(formData.get('pricingMode') || 'direct_price_based');
  const modelCategory = String(formData.get('modelCategory') || '').trim();
  const unitDefinitions = pricingMode === 'direct_price_based'
    ? normalizeDirectUnitDefinitions({ category: modelCategory, values: getDirectPricingValues(values) }).unitDefinitions
    : buildUnitDefinitions({ category: modelCategory, values });

  return {
    platformName: String(formData.get('platformName') || '').trim(),
    platformCurrency: String(formData.get('platformCurrency') || '').trim().toUpperCase(),
    pricingMode,
    currency: String(formData.get('currency') || '').trim().toUpperCase(),
    planId: String(formData.get('planId') || '').trim(),
    planName: String(formData.get('planName') || '').trim(),
    planPrice: String(formData.get('planPrice') || '').trim(),
    creditAmount: String(formData.get('creditAmount') || '').trim(),
    modelName: String(formData.get('modelName') || '').trim(),
    modelCategory,
    unitDefinitions,
    notes: String(formData.get('notes') || '').trim(),
  };
}

function getDirectPricingValues(values) {
  return {
    textUnitSize: values.textUnitSize,
    textInputPrice: values.textInputPrice,
    textOutputPrice: values.textOutputPrice,
    textCachedInputPrice: values.textCachedInputPrice,
    imagePrice: values.imagePrice,
    mediaPrice: values.mediaPrice,
    mediaUnitKind: values.mediaUnitKind,
    mediaUnitSize: values.mediaUnitSize,
  };
}

function formatUnitDefinitions(unitDefinitions) {
  if (!Array.isArray(unitDefinitions) || unitDefinitions.length === 0) {
    return '-';
  }

  return unitDefinitions
    .map((unit) => `${escapeHtml(getUnitTypeLabel(unit.unitType))}: ${escapeHtml(unit.value)}`)
    .join('<br>');
}

function updateRulePreview() {
  const form = document.querySelector('#rule-form');
  const preview = document.querySelector('#rule-preview');
  if (!form || !preview) {
    return;
  }

  const formData = new FormData(form);
  const pricingMode = String(formData.get('pricingMode'));
  const plan = state.plans.find((item) => item.id === String(formData.get('planId')));
  const model = state.models.find((item) => item.id === String(formData.get('modelId')));
  updateConsumptionFieldVisibility(model?.category);
  const usage = getPrimaryUsageFromForm(formData, model?.category);
  const targetCurrency = state.preferences?.targetCurrency ?? 'CNY';

  if (pricingMode === 'plan_credit_based') {
    if (!plan?.price || !plan?.creditAmount) {
      preview.innerHTML = `
        <strong>${t('forms.conversionPreview')}</strong>
        <p>请选择包含价格和积分数量的积分包。</p>
      `;
      return;
    }

    const creditUnitCost = roundDisplay(plan.price / plan.creditAmount);
    const unitCost = usage ? roundDisplay(creditUnitCost * usage.value) : null;
    preview.innerHTML = `
      <strong>${t('forms.conversionPreview')}</strong>
      <div class="preview-grid">
        <span>每 1 积分</span>
        <b>${creditUnitCost} ${escapeHtml(plan.currency)}</b>
        <span>${usage ? `${escapeHtml(usage.label)}消耗` : '等待填写消耗'}</span>
        <b>${usage ? `${usage.value} 积分` : '-'}</b>
        <span>折算单位成本</span>
        <b>${unitCost == null ? '-' : `${unitCost} ${escapeHtml(plan.currency)}`}</b>
      </div>
    `;
    return;
  }

  preview.innerHTML = `
    <strong>${t('forms.conversionPreview')}</strong>
    <div class="preview-grid">
      <span>直接单价</span>
      <b>${usage ? `${usage.value} ${escapeHtml(String(formData.get('currency') || 'USD'))}` : '-'}</b>
      <span>目标币种</span>
      <b>${escapeHtml(targetCurrency)}</b>
    </div>
  `;
}

function updateConsumptionFieldVisibility(category) {
  const visibleFields = new Set(getVisibleConsumptionFieldNames(category));
  document.querySelectorAll('[data-consumption-field]').forEach((field) => {
    const shouldShow = visibleFields.has(field.dataset.consumptionField);
    field.hidden = !shouldShow;
    field.querySelectorAll('input').forEach((input) => {
      input.disabled = !shouldShow;
      if (!shouldShow) {
        input.value = '';
      }
    });
  });
}

function getPrimaryUsageFromForm(formData, category) {
  const usageFields = {
    text: [
      ['textInputCreditsPer1k', '每 1K 输入'],
      ['textOutputCreditsPer1k', '每 1K 输出'],
      ['textCachedInputCreditsPer1k', '每 1K 缓存输入'],
    ],
    image: [['imageCreditsPerUnit', '每张图片']],
    video: [
      ['videoCreditsPerSecond', '每秒视频'],
      ['videoCreditsPerMinute', '每分钟视频'],
    ],
    audio: [
      ['audioCreditsPerSecond', '每秒音频'],
      ['audioCreditsPerMinute', '每分钟音频'],
    ],
  };

  for (const [fieldName, label] of usageFields[category] ?? []) {
    const rawValue = formData.get(fieldName);
    if (rawValue !== '' && rawValue != null && !Number.isNaN(Number(rawValue))) {
      return { label, value: Number(rawValue) };
    }
  }

  return null;
}

function formatUsageAmount(row) {
  const suffix = row.pricingMode === 'plan_credit_based' ? '积分' : escapeHtml(row.originalCurrency);
  const usageText = row.unitCosts
    .map((unitCost) => `${escapeHtml(getUnitTypeLabel(unitCost.unitType))} ${unitCost.usageAmount} ${suffix}`)
    .join(' + ');

  return usageText || '-';
}

function getCategoryLabel(category) {
  const labels = {
    text: '文本',
    image: '图片',
    video: '视频',
    audio: '音频',
  };
  return labels[category] ?? category ?? '-';
}

function getPricingModeLabel(pricingMode) {
  const labels = {
    plan_credit_based: '积分换算',
    direct_price_based: '直接价格',
  };
  return labels[pricingMode] ?? pricingMode;
}

function getUnitTypeLabel(unitType) {
  const labels = {
    per_1k_input_tokens: '每 1K 输入',
    per_1k_output_tokens: '每 1K 输出',
    per_1k_cached_input_tokens: '每 1K 缓存输入',
    per_image: '每张图片',
    per_second: '每秒',
    per_minute: '每分钟',
  };
  return labels[unitType] ?? unitType;
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
