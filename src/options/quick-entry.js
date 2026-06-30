const VALID_MODEL_CATEGORIES = new Set(['text', 'image', 'video', 'audio']);
const DIRECT_PRICE_MODE = 'direct_price_based';
const CREDIT_PRICE_MODE = 'plan_credit_based';
const VALID_PRICING_MODES = new Set([DIRECT_PRICE_MODE, CREDIT_PRICE_MODE]);
const VALID_UNIT_TYPES = new Set([
  'per_1k_input_tokens',
  'per_1k_output_tokens',
  'per_1k_cached_input_tokens',
  'per_1m_input_tokens',
  'per_1m_output_tokens',
  'per_image',
  'per_second',
  'per_minute',
]);

export function validateQuickEntryDraft(draft, options = {}) {
  const errors = [];
  const pricingMode = draft.pricingMode ?? DIRECT_PRICE_MODE;

  if (!VALID_PRICING_MODES.has(pricingMode)) {
    errors.push('Unsupported pricing mode.');
  }

  if (!trimValue(draft.platformName)) {
    errors.push('Platform name is required.');
  }

  if (!trimValue(draft.modelName)) {
    errors.push('Model name is required.');
  }

  if (!VALID_MODEL_CATEGORIES.has(trimValue(draft.modelCategory))) {
    errors.push('Model category is required.');
  }

  if (!hasValidUnitDefinition(draft.unitDefinitions)) {
    errors.push('At least one valid unit definition is required.');
  }

  if (pricingMode === DIRECT_PRICE_MODE && !trimValue(draft.currency)) {
    errors.push('Direct pricing requires a currency.');
  }

  if (pricingMode === CREDIT_PRICE_MODE && !hasExistingPlan(draft) && !hasNewPlanDetails(draft)) {
    errors.push('Credit conversion requires a plan or new plan details.');
  }

  if (pricingMode === CREDIT_PRICE_MODE && hasExistingPlan(draft) && options.state) {
    const platform = findPlatform(options.state, draft);
    if (!findPlanForPlatform(options.state, draft.planId, platform?.id)) {
      errors.push('Selected plan does not exist for this platform.');
    }
  }

  return errors;
}

export function buildQuickEntryMutation({ state, draft, createId = createGeneratedId }) {
  const errors = validateQuickEntryDraft(draft, { state });
  if (errors.length > 0) {
    throw new Error(errors.join(' '));
  }

  const nextState = structuredClone(state);
  const platform = resolvePlatform(nextState, draft, createId);
  const plan = draft.pricingMode === CREDIT_PRICE_MODE ? resolvePlan(nextState, draft, platform, createId) : null;
  const model = resolveModel(nextState, draft, createId);
  const rule = buildRule({ draft, platform, plan, model, createId });

  nextState.rules.push(rule);

  return { nextState, platform, plan, model, rule };
}

export function deletePlatformWithDependents(state, platformId) {
  const nextState = structuredClone(state);
  nextState.platforms = nextState.platforms.filter((item) => item.id !== platformId);
  nextState.plans = nextState.plans.filter((item) => item.platformId !== platformId);
  nextState.rules = nextState.rules.filter((item) => item.platformId !== platformId);
  return nextState;
}

export function deletePlanWithDependents(state, planId) {
  const nextState = structuredClone(state);
  nextState.plans = nextState.plans.filter((item) => item.id !== planId);
  nextState.rules = nextState.rules.filter((item) => item.planId !== planId);
  return nextState;
}

export function deleteModelWithDependents(state, modelId) {
  const nextState = structuredClone(state);
  nextState.models = nextState.models.filter((item) => item.id !== modelId);
  nextState.rules = nextState.rules.filter((item) => item.modelId !== modelId);
  return nextState;
}

export function clearComparisonRowsAfterSavedDataChange(_rows = []) {
  return [];
}

function resolvePlatform(nextState, draft, createId) {
  const platformName = trimValue(draft.platformName);
  const existing = findPlatform(nextState, draft);

  if (existing) {
    return existing;
  }

  const platform = {
    id: createId('platform'),
    name: platformName,
    defaultCurrency: normalizeCurrency(draft.platformCurrency || draft.currency || 'USD'),
    notes: '',
  };
  nextState.platforms.push(platform);
  return platform;
}

function resolvePlan(nextState, draft, platform, createId) {
  if (hasExistingPlan(draft)) {
    return findPlanForPlatform(nextState, draft.planId, platform.id);
  }

  const plan = {
    id: createId('plan'),
    platformId: platform.id,
    name: trimValue(draft.planName),
    price: Number(draft.planPrice),
    currency: normalizeCurrency(draft.planCurrency || draft.platformCurrency || draft.currency || platform.defaultCurrency || 'USD'),
    billingCycle: trimValue(draft.billingCycle) || 'custom',
    creditAmount: Number(draft.creditAmount),
    notes: '',
  };
  nextState.plans.push(plan);
  return plan;
}

function resolveModel(nextState, draft, createId) {
  const modelName = trimValue(draft.modelName);
  const modelCategory = trimValue(draft.modelCategory);
  const existing = nextState.models.find(
    (model) => namesMatch(model.name, modelName) && model.category === modelCategory,
  );

  if (existing) {
    return existing;
  }

  const model = {
    id: createId('model'),
    name: modelName,
    category: modelCategory,
  };
  nextState.models.push(model);
  return model;
}

function buildRule({ draft, platform, plan, model, createId }) {
  const pricingMode = draft.pricingMode ?? DIRECT_PRICE_MODE;
  const rule = {
    id: createId('rule'),
    platformId: platform.id,
    modelId: model.id,
    pricingMode,
    unitDefinitions: getValidUnitDefinitions(draft.unitDefinitions),
    notes: trimValue(draft.notes),
  };

  if (pricingMode === CREDIT_PRICE_MODE) {
    rule.planId = plan.id;
  } else {
    rule.currency = normalizeCurrency(draft.currency);
  }

  return rule;
}

function hasExistingPlan(draft) {
  return Boolean(trimValue(draft.planId));
}

function hasNewPlanDetails(draft) {
  return Boolean(
    trimValue(draft.planName) &&
      Number(draft.planPrice) > 0 &&
      Number(draft.creditAmount) > 0,
  );
}

function hasValidUnitDefinition(unitDefinitions) {
  return Array.isArray(unitDefinitions) && unitDefinitions.some(isValidUnitDefinition);
}

function getValidUnitDefinitions(unitDefinitions) {
  return unitDefinitions
    .filter(isValidUnitDefinition)
    .map((unitDefinition) => structuredClone(unitDefinition));
}

function isValidUnitDefinition(unitDefinition) {
  return Boolean(
    unitDefinition &&
      VALID_UNIT_TYPES.has(unitDefinition.unitType) &&
      typeof unitDefinition.value === 'number' &&
      Number.isFinite(unitDefinition.value) &&
      unitDefinition.value > 0,
  );
}

function findPlatform(state, draft) {
  const platformName = trimValue(draft.platformName);
  return state.platforms.find((platform) => namesMatch(platform.name, platformName)) ?? null;
}

function findPlanForPlatform(state, planId, platformId) {
  const selectedPlanId = trimValue(planId);
  return state.plans.find(
    (plan) => plan.id === selectedPlanId && plan.platformId === platformId,
  ) ?? null;
}

function namesMatch(left, right) {
  return normalizeName(left) === normalizeName(right);
}

function normalizeName(value) {
  return trimValue(value).toLocaleLowerCase();
}

function normalizeCurrency(value) {
  return trimValue(value).toUpperCase();
}

function trimValue(value) {
  return String(value ?? '').trim();
}

function createGeneratedId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
