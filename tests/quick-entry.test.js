import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildQuickEntryMutation,
  clearComparisonRowsAfterSavedDataChange,
  deleteModelWithDependents,
  deletePlanWithDependents,
  deletePlatformWithDependents,
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

test('deletePlatformWithDependents removes platform p1, plans where platformId p1, and rules where platformId p1', () => {
  const state = createState({
    platforms: [
      { id: 'p1', name: 'Delete AI', defaultCurrency: 'USD' },
      { id: 'p2', name: 'Keep AI', defaultCurrency: 'EUR' },
    ],
    plans: [
      { id: 'plan-p1', platformId: 'p1', name: 'Delete plan' },
      { id: 'plan-p2', platformId: 'p2', name: 'Keep plan' },
    ],
    models: [{ id: 'm1', name: 'Shared model', category: 'text' }],
    rules: [
      { id: 'rule-p1', platformId: 'p1', modelId: 'm1', planId: 'plan-p1' },
      { id: 'rule-p2', platformId: 'p2', modelId: 'm1', planId: 'plan-p2' },
    ],
  });

  const nextState = deletePlatformWithDependents(state, 'p1');

  assert.deepEqual(nextState.platforms, [state.platforms[1]]);
  assert.deepEqual(nextState.plans, [state.plans[1]]);
  assert.deepEqual(nextState.models, state.models);
  assert.deepEqual(nextState.rules, [state.rules[1]]);
  assert.equal(state.platforms.length, 2);
  assert.equal(state.plans.length, 2);
  assert.equal(state.rules.length, 2);
});

test('deletePlanWithDependents removes plan id and rules with that planId, but leaves direct-price rules without that planId', () => {
  const state = createState({
    platforms: [{ id: 'p1', name: 'AI', defaultCurrency: 'USD' }],
    plans: [
      { id: 'plan-delete', platformId: 'p1', name: 'Delete plan' },
      { id: 'plan-keep', platformId: 'p1', name: 'Keep plan' },
    ],
    models: [{ id: 'm1', name: 'Model', category: 'text' }],
    rules: [
      { id: 'rule-plan-delete', platformId: 'p1', modelId: 'm1', pricingMode: 'plan_credit_based', planId: 'plan-delete' },
      { id: 'rule-plan-keep', platformId: 'p1', modelId: 'm1', pricingMode: 'plan_credit_based', planId: 'plan-keep' },
      { id: 'rule-direct', platformId: 'p1', modelId: 'm1', pricingMode: 'direct_price_based', currency: 'USD' },
    ],
  });

  const nextState = deletePlanWithDependents(state, 'plan-delete');

  assert.deepEqual(nextState.plans, [state.plans[1]]);
  assert.deepEqual(nextState.rules, [state.rules[1], state.rules[2]]);
  assert.equal(state.plans.length, 2);
  assert.equal(state.rules.length, 3);
});

test('deleteModelWithDependents removes model id and rules with that modelId', () => {
  const state = createState({
    platforms: [{ id: 'p1', name: 'AI', defaultCurrency: 'USD' }],
    plans: [{ id: 'plan-1', platformId: 'p1', name: 'Plan' }],
    models: [
      { id: 'model-delete', name: 'Delete model', category: 'text' },
      { id: 'model-keep', name: 'Keep model', category: 'image' },
    ],
    rules: [
      { id: 'rule-delete', platformId: 'p1', modelId: 'model-delete' },
      { id: 'rule-keep', platformId: 'p1', modelId: 'model-keep' },
    ],
  });

  const nextState = deleteModelWithDependents(state, 'model-delete');

  assert.deepEqual(nextState.models, [state.models[1]]);
  assert.deepEqual(nextState.rules, [state.rules[1]]);
  assert.deepEqual(nextState.platforms, state.platforms);
  assert.deepEqual(nextState.plans, state.plans);
  assert.equal(state.models.length, 2);
  assert.equal(state.rules.length, 2);
});

test('clearComparisonRowsAfterSavedDataChange clears cached comparison rows', () => {
  const rows = [
    { platformName: 'Deleted AI', modelName: 'stale-model' },
  ];

  assert.deepEqual(clearComparisonRowsAfterSavedDataChange(rows), []);
  assert.equal(rows.length, 1);
});

function createSequentialId() {
  let next = 1;
  return (prefix) => `${prefix}-${next++}`;
}
