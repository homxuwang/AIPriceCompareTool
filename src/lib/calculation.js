import { convertCurrency } from './currency.js';

export function calculateUnitCostFromPlanCredits({
  planPrice,
  creditAmount,
  creditsPerUnit,
}) {
  return roundCurrency((planPrice / creditAmount) * creditsPerUnit);
}

export function buildComparisonRow({
  platform,
  model,
  plan,
  rule,
  scenario,
  exchangeRates,
  targetCurrency,
}) {
  const unitCosts = rule.unitDefinitions.map((unitDefinition) => {
    const sourceCurrency = plan?.currency ?? rule.currency ?? targetCurrency;
    const originalUnitCost =
      rule.pricingMode === 'plan_credit_based'
        ? calculateUnitCostFromPlanCredits({
            planPrice: plan.price,
            creditAmount: plan.creditAmount,
            creditsPerUnit: unitDefinition.value,
          })
        : roundCurrency(unitDefinition.value);

    const convertedUnitCost = roundCurrency(
      convertCurrency({
        amount: originalUnitCost,
        fromCurrency: sourceCurrency,
        toCurrency: targetCurrency,
        rates: exchangeRates.rates,
      }),
    );

    return {
      unitType: unitDefinition.unitType,
      originalUnitCost,
      convertedUnitCost,
      sourceCurrency,
    };
  });

  const singleRunCost = roundCurrency(
    unitCosts.reduce((total, unitCost) => {
      return total + unitCost.convertedUnitCost * getScenarioMultiplier(unitCost.unitType, model.category, scenario);
    }, 0),
  );

  return {
    platformName: platform.name,
    modelName: model.name,
    category: model.category,
    pricingMode: rule.pricingMode,
    planName: plan?.name ?? '',
    planTotalPrice: plan?.price ?? null,
    totalCredits: plan?.creditAmount ?? null,
    exchangeRate:
      exchangeRates.rates[unitCosts[0]?.sourceCurrency ?? targetCurrency] /
      exchangeRates.rates[targetCurrency],
    unitUsageDescription: rule.unitDefinitions
      .map((unitDefinition) => `${unitDefinition.unitType}: ${unitDefinition.value}`)
      .join(', '),
    convertedUnitCost: unitCosts[0]?.convertedUnitCost ?? 0,
    originalUnitCost: unitCosts[0]?.originalUnitCost ?? 0,
    originalCurrency: unitCosts[0]?.sourceCurrency ?? targetCurrency,
    singleRunCost,
    unitCosts,
  };
}

function getScenarioMultiplier(unitType, category, scenario) {
  switch (unitType) {
    case 'per_1k_input_tokens':
      return scenario.textInputTokens / 1000;
    case 'per_1k_output_tokens':
      return scenario.textOutputTokens / 1000;
    case 'per_image':
      return scenario.imageCount;
    case 'per_second':
      return category === 'audio' ? scenario.audioMinutes * 60 : scenario.videoSeconds;
    case 'per_minute':
      return category === 'video' ? scenario.videoSeconds / 60 : scenario.audioMinutes;
    default:
      return 0;
  }
}

function roundCurrency(value) {
  return Number(value.toFixed(6));
}
