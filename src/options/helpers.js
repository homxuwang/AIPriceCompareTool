import { buildComparisonRow } from '../lib/calculation.js';

const consumptionFieldsByCategory = {
  text: ['textInputCreditsPer1k', 'textOutputCreditsPer1k'],
  image: ['imageCreditsPerUnit'],
  video: ['videoCreditsPerSecond', 'videoCreditsPerMinute'],
  audio: ['audioCreditsPerSecond', 'audioCreditsPerMinute'],
};

export function buildUnitDefinitions({ category, values }) {
  switch (category) {
    case 'text':
      return compactUnitDefinitions([
        ['per_1k_input_tokens', values.textInputCreditsPer1k ?? values.textInputValue],
        ['per_1k_output_tokens', values.textOutputCreditsPer1k ?? values.textOutputValue],
      ]);
    case 'image':
      return compactUnitDefinitions([['per_image', values.imageCreditsPerUnit ?? values.imageValue]]);
    case 'video':
      return compactUnitDefinitions([
        ['per_second', values.videoCreditsPerSecond ?? values.videoSecondValue],
        ['per_minute', values.videoCreditsPerMinute ?? values.videoMinuteValue],
      ]);
    case 'audio':
      return compactUnitDefinitions([
        ['per_second', values.audioCreditsPerSecond ?? values.audioSecondValue],
        ['per_minute', values.audioCreditsPerMinute ?? values.audioMinuteValue],
      ]);
    default:
      return [];
  }
}

export function getVisibleConsumptionFieldNames(category) {
  return consumptionFieldsByCategory[category] ?? [];
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
    .filter((rule) => {
      if (filters.modelIds.length === 0) return true;
      const model = state.models.find((item) => item.id === rule.modelId);
      if (!model) return false;
      const selectedModels = state.models.filter((m) => filters.modelIds.includes(m.id));
      const selectedCategories = new Set(selectedModels.map((m) => m.category));
      return selectedCategories.size === 0 || selectedCategories.has(model.category);
    })
    .flatMap((rule) => {
      const platform = state.platforms.find((item) => item.id === rule.platformId);
      const model = state.models.find((item) => item.id === rule.modelId);

      if (rule.pricingMode === 'plan_credit_based') {
        const platformPlans = state.plans.filter((item) => item.platformId === rule.platformId);
        
        if (platformPlans.length === 0) {
          return [buildComparisonRow({
            platform,
            model,
            plan: null,
            rule,
            scenario: filters.scenario,
            exchangeRates: state.exchangeRates,
            targetCurrency: filters.targetCurrency,
          })];
        }
        
        return platformPlans.map((plan) =>
          buildComparisonRow({
            platform,
            model,
            plan,
            rule,
            scenario: filters.scenario,
            exchangeRates: state.exchangeRates,
            targetCurrency: filters.targetCurrency,
          })
        );
      }
      
      return [buildComparisonRow({
        platform,
        model,
        plan: null,
        rule,
        scenario: filters.scenario,
        exchangeRates: state.exchangeRates,
        targetCurrency: filters.targetCurrency,
      })];
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
