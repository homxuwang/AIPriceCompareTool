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
    
    let creditUnitCost = null;
    if (rule.pricingMode === 'plan_credit_based') {
      if (plan && plan.price && plan.creditAmount) {
        creditUnitCost = plan.price / plan.creditAmount;
      } else {
        creditUnitCost = null;
      }
    }
    
    let originalUnitCost = null;
    if (rule.pricingMode === 'plan_credit_based') {
      if (creditUnitCost !== null && unitDefinition.value != null) {
        originalUnitCost = creditUnitCost * unitDefinition.value;
      } else {
        originalUnitCost = null;
      }
    } else {
      originalUnitCost = unitDefinition.value != null ? Number(unitDefinition.value) : null;
    }

    const convertedUnitCost = originalUnitCost !== null
      ? roundCurrency(
          convertCurrency({
            amount: originalUnitCost,
            fromCurrency: sourceCurrency,
            toCurrency: targetCurrency,
            rates: exchangeRates.rates,
          }),
        )
      : null;

    return {
      unitType: unitDefinition.unitType,
      usageAmount: unitDefinition.value,
      creditUnitCost,
      originalUnitCost,
      convertedUnitCost,
      sourceCurrency,
    };
  });

  const hasValidCosts = unitCosts.some((uc) => uc.convertedUnitCost !== null);
  const singleRunCost = hasValidCosts
    ? roundCurrency(
        unitCosts.reduce((total, unitCost) => {
          const cost = unitCost.convertedUnitCost ?? 0;
          return total + cost * getScenarioMultiplier(unitCost.unitType, model.category, scenario);
        }, 0),
      )
    : null;

  return {
    platformName: platform.name,
    modelName: model.name,
    category: model.category,
    comparisonType: model.category,
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
    primaryUsageAmount: unitCosts[0]?.usageAmount ?? 0,
    creditUnitCost: unitCosts[0]?.creditUnitCost ?? null,
    convertedUnitCost: unitCosts[0]?.convertedUnitCost ?? null,
    originalUnitCost: unitCosts[0]?.originalUnitCost ?? null,
    originalCurrency: unitCosts[0]?.sourceCurrency ?? targetCurrency,
    singleRunCost,
    unitCosts,
  };
}

function calculateCreditUnitCost({ planPrice, creditAmount }) {
  return roundCurrency(planPrice / creditAmount);
}

function getScenarioMultiplier(unitType, category, scenario) {
  switch (unitType) {
    case 'per_1k_input_tokens':
      return scenario.textInputTokens / 1000;
    case 'per_1k_output_tokens':
      return scenario.textOutputTokens / 1000;
    case 'per_1k_cached_input_tokens':
      return (scenario.cachedInputTokens ?? 0) / 1000;
    // Retain legacy million-token units used by existing saved pricing data.
    case 'per_1m_input_tokens':
      return scenario.textInputTokens / 1000000;
    case 'per_1m_output_tokens':
      return scenario.textOutputTokens / 1000000;
    case 'per_image':
      return scenario.imageCount;
    case 'per_second':
      return category === 'audio' ? (scenario.audioMinutes || 0) * 60 : scenario.videoSeconds;
    case 'per_minute':
      return category === 'video' ? scenario.videoSeconds / 60 : scenario.audioMinutes;
    default:
      return 0;
  }
}

function roundCurrency(value) {
  return Number(value.toFixed(6));
}
