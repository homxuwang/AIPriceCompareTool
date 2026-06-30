import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInMemoryRepository,
  createEmptyState,
} from '../src/storage/repository.js';

test('empty state defaults text scenarios to one million tokens', () => {
  const state = createEmptyState();

  assert.equal(state.scenarioDefaults.textInputTokens, 1000000);
  assert.equal(state.scenarioDefaults.textOutputTokens, 1000000);
});

test('normalizes legacy default text scenario values to one million tokens', async () => {
  const repository = createInMemoryRepository({
    ...createEmptyState(),
    scenarioDefaults: {
      textInputTokens: 1000,
      textOutputTokens: 500,
      imageCount: 1,
      videoSeconds: 5,
      audioMinutes: 1,
    },
  });

  const state = await repository.loadState();

  assert.equal(state.scenarioDefaults.textInputTokens, 1000000);
  assert.equal(state.scenarioDefaults.textOutputTokens, 1000000);
});

test('exports and imports repository state as json-safe data', async () => {
  const repository = createInMemoryRepository();

  await repository.saveState({
    ...createEmptyState(),
    platforms: [{ id: 'p1', name: 'Foo AI', defaultCurrency: 'CNY' }],
    exchangeRates: {
      baseCurrency: 'CNY',
      rates: { CNY: 1 },
      updatedAt: '2026-06-18T00:00:00.000Z',
    },
  });

  const exported = await repository.exportState();
  assert.equal(exported.platforms.length, 1);

  await repository.importState({
    ...createEmptyState(),
    models: [{ id: 'm1', name: 'gpt-image-1', category: 'image' }],
  });

  const imported = await repository.loadState();
  assert.equal(imported.models[0].name, 'gpt-image-1');
  assert.equal(imported.platforms.length, 0);
});
