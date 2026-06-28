import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildComparisonRow,
  calculateUnitCostFromPlanCredits,
} from '../src/lib/calculation.js';

test('calculates image unit cost from plan credits', () => {
  const result = calculateUnitCostFromPlanCredits({
    planPrice: 39,
    creditAmount: 400,
    creditsPerUnit: 20,
  });

  assert.equal(result, 1.95);
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
    scenario: {
      imageCount: 1,
      textInputTokens: 1000,
      textOutputTokens: 500,
      videoSeconds: 5,
      audioMinutes: 1,
    },
    exchangeRates: { baseCurrency: 'CNY', rates: { CNY: 1 } },
    targetCurrency: 'CNY',
  });

  assert.equal(row.convertedUnitCost, 1.95);
  assert.equal(row.singleRunCost, 1.95);
  assert.equal(row.unitUsageDescription, 'per_image: 20');
  assert.equal(row.totalCredits, 400);
});

test('builds text comparison row from direct pricing', () => {
  const row = buildComparisonRow({
    platform: { name: 'Bar AI' },
    model: { name: 'gpt-4.1', category: 'text' },
    plan: null,
    rule: {
      pricingMode: 'direct_price_based',
      currency: 'USD',
      unitDefinitions: [
        { unitType: 'per_1k_input_tokens', value: 0.2 },
        { unitType: 'per_1k_output_tokens', value: 0.4 },
      ],
    },
    scenario: {
      imageCount: 1,
      textInputTokens: 1000,
      textOutputTokens: 500,
      videoSeconds: 5,
      audioMinutes: 1,
    },
    exchangeRates: { baseCurrency: 'CNY', rates: { CNY: 1, USD: 7.2 } },
    targetCurrency: 'CNY',
  });

  assert.equal(row.convertedUnitCost, 1.44);
  assert.equal(row.singleRunCost, 2.88);
});

test('treats missing text output pricing as zero', () => {
  const row = buildComparisonRow({
    platform: { name: 'Lite AI' },
    model: { name: 'gpt-lite', category: 'text' },
    plan: null,
    rule: {
      pricingMode: 'direct_price_based',
      currency: 'USD',
      unitDefinitions: [{ unitType: 'per_1k_input_tokens', value: 0.1 }],
    },
    scenario: {
      imageCount: 1,
      textInputTokens: 2000,
      textOutputTokens: 500,
      videoSeconds: 5,
      audioMinutes: 1,
    },
    exchangeRates: { baseCurrency: 'CNY', rates: { CNY: 1, USD: 7.2 } },
    targetCurrency: 'CNY',
  });

  assert.equal(row.singleRunCost, 1.44);
});

test('builds image comparison row from plan output pricing', () => {
  const row = buildComparisonRow({
    platform: { name: 'Output AI' },
    model: { name: 'gpt-image-2-1k', category: 'image' },
    plan: { name: 'Starter', price: 19, currency: 'USD', creditAmount: null },
    rule: {
      pricingMode: 'plan_output_based',
      unitDefinitions: [{ unitType: 'per_image', value: 2000 }],
    },
    scenario: {
      imageCount: 3,
      textInputTokens: 1000,
      textOutputTokens: 500,
      videoSeconds: 5,
      audioMinutes: 1,
    },
    exchangeRates: { baseCurrency: 'CNY', rates: { CNY: 1, USD: 7.2 } },
    targetCurrency: 'CNY',
  });

  assert.equal(row.convertedUnitCost, 0.0684);
  assert.equal(row.singleRunCost, 0.2052);
  assert.equal(row.includedUnits, 2000);
  assert.equal(row.unitUsageDescription, 'per_image: 2000');
});
