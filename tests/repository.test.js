import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInMemoryRepository,
  createEmptyState,
} from '../src/storage/repository.js';

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
