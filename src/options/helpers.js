import { buildComparisonRow } from '../lib/calculation.js';

const RESULT_EXPORT_COLUMNS = [
  ['platformName', 'Platform'],
  ['modelName', 'Model'],
  ['category', 'Category'],
  ['pricingMode', 'Pricing Mode'],
  ['planName', 'Plan Name'],
  ['planTotalPrice', 'Plan Total Price'],
  ['totalCredits', 'Total Credits'],
  ['includedUnits', '套餐总可生成数量'],
  ['unitUsageDescription', 'Unit Usage Description'],
  ['originalUnitCostWithCurrency', 'Original Currency Unit Cost'],
  ['exchangeRate', 'Exchange Rate'],
  ['convertedUnitCost', 'Converted Unit Cost'],
  ['singleRunCost', 'Typical Single-Run Cost'],
];

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

export function formatComparisonRowsAsCsv(rows) {
  return [
    RESULT_EXPORT_COLUMNS.map(([, label]) => formatCsvCell(label)).join(','),
    ...rows.map((row) => RESULT_EXPORT_COLUMNS
      .map(([key]) => formatCsvCell(resolveExportValue(row, key)))
      .join(',')),
  ].join('\n');
}

export function formatComparisonRowsAsMarkdown(rows) {
  const headers = RESULT_EXPORT_COLUMNS.map(([, label]) => label);
  const separator = headers.map(() => '---');
  const body = rows.map((row) => RESULT_EXPORT_COLUMNS
    .map(([key]) => formatMarkdownCell(resolveExportValue(row, key))));

  return [
    '# AI SaaS Price Comparison Results',
    '',
    formatMarkdownRow(headers),
    formatMarkdownRow(separator),
    ...body.map(formatMarkdownRow),
  ].join('\n');
}

function compactUnitDefinitions(entries) {
  return entries
    .map(([unitType, rawValue]) => ({
      unitType,
      value: rawValue === '' ? null : Number(rawValue),
    }))
    .filter((entry) => entry.value != null && !Number.isNaN(entry.value));
}

function resolveExportValue(row, key) {
  if (key === 'originalUnitCostWithCurrency') {
    return `${row.originalUnitCost} ${row.originalCurrency}`;
  }

  return row[key] ?? '';
}

function formatCsvCell(value) {
  const text = String(value);
  if (!/[",\n\r]/.test(text)) {
    return text;
  }

  return `"${text.replaceAll('"', '""')}"`;
}

function formatMarkdownRow(values) {
  return `| ${values.join(' | ')} |`;
}

function formatMarkdownCell(value) {
  return String(value).replaceAll('|', '\\|').replaceAll('\n', '<br>');
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
