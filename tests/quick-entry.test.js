import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildQuickEntryMutation,
  validateQuickEntryDraft,
} from '../src/options/quick-entry.js';

function createState(overrides = {}) {
  return {
    platforms: [],
    plans: [],
    models: [],
    rules: [],
    ...overrides,
  };
}

test('buildQuickEntryMutation reuses existing platform and model by trimmed case-insensitive name', () => {
  const state = createState({
    platforms: [{ id: 'p1', name: 'OpenAI', defaultCurrency: 'USD' }],
    models: [{ id: 'm1', name: 'gpt-4.1', category: 'text' }],
  });

  const result = buildQuickEntryMutation({
    state,
    draft: {
      platformName: ' openai ',
      modelName: 'GPT-4.1',
      modelCategory: 'text',
      pricingMode: 'direct_price_based',
      currency: 'USD',
      unitDefinitions: [{ unitType: 'per_1k_input_tokens', value: 0.001 }],
    },
  });

  assert.equal(result.platform.id, 'p1');
  assert.equal(result.model.id, 'm1');
  assert.equal(result.nextState.platforms.length, 1);
  assert.equal(result.nextState.models.length, 1);
  assert.equal(result.nextState.rules.length, 1);
  assert.equal(result.rule.platformId, 'p1');
  assert.equal(result.rule.modelId, 'm1');
  assert.equal(result.rule.planId, undefined);
  assert.equal(state.rules.length, 0);
});

test('buildQuickEntryMutation creates missing platform and model for valid direct price', () => {
  const result = buildQuickEntryMutation({
    state: createState(),
    createId: createSequentialId(),
    draft: {
      platformName: 'New AI',
      modelName: 'fast-text',
      modelCategory: 'text',
      pricingMode: 'direct_price_based',
      currency: 'usd',
      unitDefinitions: [{ unitType: 'per_1k_input_tokens', value: 0.002 }],
    },
  });

  assert.equal(result.nextState.platforms.length, 1);
  assert.equal(result.nextState.models.length, 1);
  assert.equal(result.nextState.rules.length, 1);
  assert.equal(result.platform.id, 'platform-1');
  assert.equal(result.platform.name, 'New AI');
  assert.equal(result.platform.defaultCurrency, 'USD');
  assert.equal(result.model.id, 'model-2');
  assert.equal(result.model.name, 'fast-text');
  assert.equal(result.model.category, 'text');
  assert.equal(result.rule.id, 'rule-3');
  assert.equal(result.rule.pricingMode, 'direct_price_based');
  assert.equal(result.rule.currency, 'USD');
  assert.equal(result.rule.planId, undefined);
});

test('validateQuickEntryDraft requires a plan for credit conversion without plan details', () => {
  const errors = validateQuickEntryDraft({
    platformName: 'OpenAI',
    modelName: 'gpt-4.1',
    modelCategory: 'text',
    pricingMode: 'plan_credit_based',
    unitDefinitions: [{ unitType: 'per_1k_input_tokens', value: 1 }],
  });

  assert.deepEqual(errors, ['Credit conversion requires a plan or new plan details.']);
});

test('buildQuickEntryMutation rejects nonexistent selected plan for resolved platform', () => {
  const state = createState({
    platforms: [
      { id: 'p1', name: 'OpenAI', defaultCurrency: 'USD' },
      { id: 'p2', name: 'Other AI', defaultCurrency: 'USD' },
    ],
    plans: [{ id: 'plan-other', platformId: 'p2', name: 'Other plan', price: 10, currency: 'USD', creditAmount: 100 }],
    models: [{ id: 'm1', name: 'gpt-4.1', category: 'text' }],
  });
  const draft = {
    platformName: 'openai',
    modelName: 'gpt-4.1',
    modelCategory: 'text',
    pricingMode: 'plan_credit_based',
    planId: 'plan-other',
    unitDefinitions: [{ unitType: 'per_1k_input_tokens', value: 1 }],
  };

  assert.deepEqual(
    validateQuickEntryDraft(draft, { state }),
    ['Selected plan does not exist for this platform.'],
  );
  assert.throws(
    () => buildQuickEntryMutation({ state, draft }),
    /Selected plan does not exist for this platform\./,
  );
});

test('validateQuickEntryDraft rejects unsupported pricing modes before build', () => {
  const draft = {
    platformName: 'OpenAI',
    modelName: 'gpt-4.1',
    modelCategory: 'text',
    pricingMode: 'direct-price-based',
    currency: 'USD',
    unitDefinitions: [{ unitType: 'per_1k_input_tokens', value: 0.001 }],
  };

  assert.deepEqual(validateQuickEntryDraft(draft), ['Unsupported pricing mode.']);
  assert.throws(
    () => buildQuickEntryMutation({ state: createState(), draft }),
    /Unsupported pricing mode\./,
  );
});

test('validateQuickEntryDraft rejects invalid unit definitions before build', () => {
  const invalidUnitDefinitions = [
    [{}],
    [{ unitType: 'per_unknown', value: 1 }],
    [{ unitType: 'per_1k_input_tokens', value: 0 }],
    [{ unitType: 'per_1k_input_tokens', value: -1 }],
    [{ unitType: 'per_1k_input_tokens', value: '1' }],
    [{ unitType: 'per_1k_input_tokens', value: NaN }],
  ];

  for (const unitDefinitions of invalidUnitDefinitions) {
    const draft = {
      platformName: 'OpenAI',
      modelName: 'gpt-4.1',
      modelCategory: 'text',
      pricingMode: 'direct_price_based',
      currency: 'USD',
      unitDefinitions,
    };

    assert.deepEqual(
      validateQuickEntryDraft(draft),
      ['At least one valid unit definition is required.'],
    );
    assert.throws(
      () => buildQuickEntryMutation({ state: createState(), draft }),
      /At least one valid unit definition is required\./,
    );
  }
});

test('buildQuickEntryMutation stores only valid unit definitions', () => {
  const result = buildQuickEntryMutation({
    state: createState(),
    createId: createSequentialId(),
    draft: {
      platformName: 'Mixed Units AI',
      modelName: 'mixed-model',
      modelCategory: 'text',
      pricingMode: 'direct_price_based',
      currency: 'USD',
      unitDefinitions: [
        { unitType: 'per_1k_input_tokens', value: 1 },
        { unitType: 'per_unknown', value: 1 },
        { unitType: 'per_1k_output_tokens', value: 0 },
      ],
    },
  });

  assert.deepEqual(result.rule.unitDefinitions, [
    { unitType: 'per_1k_input_tokens', value: 1 },
  ]);
});

function createSequentialId() {
  let next = 1;
  return (prefix) => `${prefix}-${next++}`;
}
