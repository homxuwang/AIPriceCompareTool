import {
  DEFAULT_EXCHANGE_RATES,
  DEFAULT_SCENARIO,
} from '../lib/defaults.js';

const STORAGE_KEY = 'ai-saas-price-compare-state';

export function createEmptyState() {
  return {
    platforms: [],
    plans: [],
    models: [],
    rules: [],
    compareQueue: [],
    exchangeRates: structuredClone(DEFAULT_EXCHANGE_RATES),
    scenarioDefaults: structuredClone(DEFAULT_SCENARIO),
    preferences: {
      locale: 'zh-CN',
      targetCurrency: 'CNY',
    },
    lastUsed: {
      planPlatformId: null,
      planBillingCycle: 'monthly',
    },
  };
}

export function createInMemoryRepository(initialState = createEmptyState()) {
  let state = normalizeState(initialState);

  return {
    async loadState() {
      return structuredClone(state);
    },
    async saveState(nextState) {
      state = normalizeState(nextState);
      return structuredClone(state);
    },
    async exportState() {
      return structuredClone(state);
    },
    async importState(nextState) {
      state = normalizeState(nextState);
      return structuredClone(state);
    },
  };
}

export function createChromeStorageRepository(storageArea = chrome.storage.local) {
  return {
    async loadState() {
      const result = await storageArea.get(STORAGE_KEY);
      return normalizeState(result[STORAGE_KEY] ?? createEmptyState());
    },
    async saveState(nextState) {
      const normalized = normalizeState(nextState);
      await storageArea.set({ [STORAGE_KEY]: normalized });
      return structuredClone(normalized);
    },
    async exportState() {
      return this.loadState();
    },
    async importState(nextState) {
      return this.saveState(nextState);
    },
  };
}

function normalizeState(nextState) {
  const normalized = {
    ...createEmptyState(),
    ...structuredClone(nextState),
    scenarioDefaults: {
      ...DEFAULT_SCENARIO,
      ...(nextState?.scenarioDefaults ?? {}),
    },
  };
  normalized.scenarioDefaults = normalizeScenarioDefaults(normalized.scenarioDefaults);
  return normalized;
}

function normalizeScenarioDefaults(scenarioDefaults) {
  return {
    ...scenarioDefaults,
    textInputTokens: migrateLegacyDefaultTokens(
      scenarioDefaults.textInputTokens,
      1000,
    ),
    textOutputTokens: migrateLegacyDefaultTokens(
      scenarioDefaults.textOutputTokens,
      500,
    ),
  };
}

function migrateLegacyDefaultTokens(value, legacyDefault) {
  return Number(value) === legacyDefault ? 1000000 : value;
}
