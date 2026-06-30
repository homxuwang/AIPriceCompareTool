import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildComparisonRows,
  buildUnitDefinitions,
  formatComparisonRowsAsCsv,
  formatComparisonRowsAsMarkdown,
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

test('builds partial text unit definitions from form values', () => {
  const unitDefinitions = buildUnitDefinitions({
    pricingMode: 'direct_price_based',
    category: 'text',
    values: {
      textInputValue: '0.1',
      textOutputValue: '',
    },
  });

  assert.deepEqual(unitDefinitions, [{ unitType: 'per_1k_input_tokens', value: 0.1 }]);
});

test('builds included output units from form values', () => {
  const unitDefinitions = buildUnitDefinitions({
    pricingMode: 'plan_output_based',
    category: 'image',
    values: {
      includedOutputUnits: '2000',
    },
  });

  assert.deepEqual(unitDefinitions, [{ unitType: 'per_image', value: 2000 }]);
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

test('formats comparison rows as csv with escaped values', () => {
  const csv = formatComparisonRowsAsCsv([{
    platformName: 'Foo, AI',
    modelName: 'gpt-image-1',
    category: 'image',
    pricingMode: 'plan_credit_based',
    planName: 'Pro "Plus"',
    planTotalPrice: 39,
    totalCredits: 400,
    includedUnits: null,
    unitUsageDescription: '20 credits / image',
    originalUnitCost: 1.95,
    originalCurrency: 'CNY',
    exchangeRate: 1,
    convertedUnitCost: 1.95,
    singleRunCost: 1.95,
  }]);

  assert.equal(
    csv,
    [
      'Platform,Model,Category,Pricing Mode,Plan Name,Plan Total Price,Total Credits,套餐总可生成数量,Unit Usage Description,Original Currency Unit Cost,Exchange Rate,Converted Unit Cost,Typical Single-Run Cost',
      '"Foo, AI",gpt-image-1,image,plan_credit_based,"Pro ""Plus""",39,400,,20 credits / image,1.95 CNY,1,1.95,1.95',
    ].join('\n'),
  );
});

test('formats comparison rows as markdown table', () => {
  const markdown = formatComparisonRowsAsMarkdown([{
    platformName: 'Foo AI',
    modelName: 'gpt-image-1',
    category: 'image',
    pricingMode: 'plan_credit_based',
    planName: 'Pro',
    planTotalPrice: 39,
    totalCredits: 400,
    includedUnits: null,
    unitUsageDescription: '20 credits | image',
    originalUnitCost: 1.95,
    originalCurrency: 'CNY',
    exchangeRate: 1,
    convertedUnitCost: 1.95,
    singleRunCost: 1.95,
  }]);

  assert.equal(
    markdown,
    [
      '# AI SaaS Price Comparison Results',
      '',
      '| Platform | Model | Category | Pricing Mode | Plan Name | Plan Total Price | Total Credits | 套餐总可生成数量 | Unit Usage Description | Original Currency Unit Cost | Exchange Rate | Converted Unit Cost | Typical Single-Run Cost |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      '| Foo AI | gpt-image-1 | image | plan_credit_based | Pro | 39 | 400 |  | 20 credits \\| image | 1.95 CNY | 1 | 1.95 | 1.95 |',
    ].join('\n'),
  );
});
