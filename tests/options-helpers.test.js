import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildComparisonRows,
  buildUnitDefinitions,
  getVisibleConsumptionFieldNames,
} from '../src/options/helpers.js';

test('builds image unit definitions from form values', () => {
  const unitDefinitions = buildUnitDefinitions({
    category: 'image',
    values: {
      imageValue: '20',
    },
  });

  assert.deepEqual(unitDefinitions, [{ unitType: 'per_image', value: 20 }]);
});

test('builds image unit definitions from guided credit consumption fields', () => {
  const unitDefinitions = buildUnitDefinitions({
    category: 'image',
    values: {
      imageCreditsPerUnit: '20',
    },
  });

  assert.deepEqual(unitDefinitions, [{ unitType: 'per_image', value: 20 }]);
});

test('shows only image consumption fields for image models', () => {
  assert.deepEqual(getVisibleConsumptionFieldNames('image'), ['imageCreditsPerUnit']);
});

test('builds partial text unit definitions from form values', () => {
  const unitDefinitions = buildUnitDefinitions({
    category: 'text',
    values: {
      textInputValue: '0.1',
      textOutputValue: '',
    },
  });

  assert.deepEqual(unitDefinitions, [{ unitType: 'per_1k_input_tokens', value: 0.1 }]);
});

test('builds partial text unit definitions from guided per-1k consumption fields', () => {
  const unitDefinitions = buildUnitDefinitions({
    category: 'text',
    values: {
      textInputCreditsPer1k: '0.0009',
      textOutputCreditsPer1k: '',
    },
  });

  assert.deepEqual(unitDefinitions, [{ unitType: 'per_1k_input_tokens', value: 0.0009 }]);
});

test('shows text per-1k consumption fields including cached input for text models', () => {
  assert.deepEqual(getVisibleConsumptionFieldNames('text'), [
    'textInputCreditsPer1k',
    'textOutputCreditsPer1k',
    'textCachedInputCreditsPer1k',
  ]);
});

test('builds cached-input text unit definitions from guided per-1k consumption fields', () => {
  const unitDefinitions = buildUnitDefinitions({
    category: 'text',
    values: {
      textCachedInputCreditsPer1k: '0.00009',
    },
  });

  assert.deepEqual(unitDefinitions, [
    { unitType: 'per_1k_cached_input_tokens', value: 0.00009 },
  ]);
});

test('builds comparison rows using selected platforms and models', () => {
  const rows = buildComparisonRows({
    state: {
      platforms: [{ id: 'p1', name: 'Foo AI', defaultCurrency: 'CNY' }],
      plans: [{ id: 'pl1', platformId: 'p1', name: 'Pro', price: 39, currency: 'CNY', creditAmount: 400 }],
      models: [{ id: 'm1', name: 'gpt-image-1', category: 'image' }],
      rules: [{
        id: 'r1',
        platformId: 'p1',
        modelId: 'm1',
        pricingMode: 'plan_credit_based',
        planId: 'pl1',
        unitDefinitions: [{ unitType: 'per_image', value: 20 }],
      }],
      exchangeRates: { baseCurrency: 'CNY', rates: { CNY: 1 }, updatedAt: '2026-06-18T00:00:00.000Z' },
    },
    filters: {
      platformIds: ['p1'],
      modelIds: ['m1'],
      scenario: {
        textInputTokens: 1000,
        textOutputTokens: 500,
        imageCount: 1,
        videoSeconds: 5,
        audioMinutes: 1,
      },
      targetCurrency: 'CNY',
    },
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].singleRunCost, 1.95);
});
