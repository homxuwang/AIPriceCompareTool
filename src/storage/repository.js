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
    exchangeRates: structuredClone(DEFAULT_EXCHANGE_RATES),
    scenarioDefaults: structuredClone(DEFAULT_SCENARIO),
  };
}

export function createInMemoryRepository(initialState = createEmptyState()) {
  let state = structuredClone(initialState);

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
  return {
    ...createEmptyState(),
    ...structuredClone(nextState),
  };
}
