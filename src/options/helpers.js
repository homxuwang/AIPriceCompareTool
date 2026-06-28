import { buildComparisonRow } from '../lib/calculation.js';

export function buildUnitDefinitions({ pricingMode, category, values }) {
  if (pricingMode === 'plan_output_based') {
    return compactUnitDefinitions([[resolveOutputUnitType(category), values.includedOutputUnits]]);
  }

  switch (category) {
    case 'text':
      return compactUnitDefinitions([
        ['per_1k_input_tokens', values.textInputValue],
        ['per_1k_output_tokens', values.textOutputValue],
      ]);
    case 'image':
      return compactUnitDefinitions([['per_image', values.imageValue]]);
    case 'video':
      return compactUnitDefinitions([
        ['per_second', values.videoSecondValue],
        ['per_minute', values.videoMinuteValue],
      ]);
    case 'audio':
      return compactUnitDefinitions([
        ['per_second', values.audioSecondValue],
        ['per_minute', values.audioMinuteValue],
      ]);
    default:
      return [];
  }
}

export function buildComparisonRows({ state, filters }) {
  return state.rules
    .filter((rule) => {
      const platformMatch =
        filters.platformIds.length === 0 || filters.platformIds.includes(rule.platformId);
      const modelMatch =
        filters.modelIds.length === 0 || filters.modelIds.includes(rule.modelId);
      return platformMatch && modelMatch;
    })
    .map((rule) => {
      const platform = state.platforms.find((item) => item.id === rule.platformId);
      const model = state.models.find((item) => item.id === rule.modelId);
      const plan = state.plans.find((item) => item.id === rule.planId) ?? null;

      return buildComparisonRow({
        platform,
        model,
        plan,
        rule,
        scenario: filters.scenario,
        exchangeRates: state.exchangeRates,
        targetCurrency: filters.targetCurrency,
      });
    });
}

function compactUnitDefinitions(entries) {
  return entries
    .map(([unitType, rawValue]) => ({
      unitType,
      value: rawValue === '' ? null : Number(rawValue),
    }))
    .filter((entry) => entry.value != null && !Number.isNaN(entry.value));
}

function resolveOutputUnitType(category) {
  switch (category) {
    case 'image':
      return 'per_image';
    case 'video':
      return 'per_minute';
    case 'audio':
      return 'per_minute';
    case 'text':
    default:
      return 'per_1k_output_tokens';
  }
}
