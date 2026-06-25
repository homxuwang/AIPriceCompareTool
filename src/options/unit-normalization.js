const DEFAULT_TEXT_UNIT_SIZE = 1000000;

const TEXT_PRICE_FIELDS = [
  ['textInputPrice', 'per_1k_input_tokens'],
  ['textOutputPrice', 'per_1k_output_tokens'],
  ['textCachedInputPrice', 'per_1k_cached_input_tokens'],
];

const TEXT_PER_1K_FIELDS = [
  ['textInputCreditsPer1k', 'per_1k_input_tokens'],
  ['textOutputCreditsPer1k', 'per_1k_output_tokens'],
  ['textCachedInputCreditsPer1k', 'per_1k_cached_input_tokens'],
];

export function normalizeDirectUnitDefinitions({ category, values }) {
  if (category === 'text') {
    return normalizeTextUnitDefinitions(values);
  }

  if (category === 'image') {
    return {
      originalUnit: { kind: 'image', unitSize: 1 },
      unitDefinitions: compactUnitDefinitions([['per_image', values.imagePrice ?? values.imageCreditsPerUnit]]),
    };
  }

  if (category === 'video' || category === 'audio') {
    return normalizeTimedUnitDefinitions(values);
  }

  return { originalUnit: null, unitDefinitions: [] };
}

function normalizeTextUnitDefinitions(values) {
  const unitSize = parseUnitSize(values.textUnitSize ?? DEFAULT_TEXT_UNIT_SIZE);
  const factor = 1000 / unitSize;
  const normalizedFromPrices = TEXT_PRICE_FIELDS
    .map(([fieldName, unitType]) => {
      const value = parseOptionalNumber(values[fieldName]);
      if (value === null) {
        return null;
      }

      return {
        unitType,
        value: roundNormalizedValue(value * factor),
      };
    })
    .filter(Boolean);

  return {
    originalUnit: { kind: 'tokens', unitSize },
    unitDefinitions: [
      ...normalizedFromPrices,
      ...TEXT_PER_1K_FIELDS
        .map(([fieldName, unitType]) => {
          const value = parseOptionalNumber(values[fieldName]);
          return value === null ? null : { unitType, value };
        })
        .filter(Boolean),
    ],
  };
}

function normalizeTimedUnitDefinitions(values) {
  const unitKind = values.mediaUnitKind ?? 'second';
  const unitSize = parseMediaUnitSize(values.mediaUnitSize ?? 1);
  const seconds = unitKind === 'minute' ? unitSize * 60 : unitSize;
  const price = parseOptionalNumber(values.mediaPrice);

  return {
    originalUnit: { kind: unitKind, unitSize },
    unitDefinitions: price === null
      ? []
      : [{ unitType: 'per_second', value: roundNormalizedValue(price / seconds) }],
  };
}

function compactUnitDefinitions(entries) {
  return entries
    .map(([unitType, rawValue]) => {
      const value = parseOptionalNumber(rawValue);
      return value === null ? null : { unitType, value };
    })
    .filter(Boolean);
}

function parseUnitSize(rawValue) {
  const unitSize = Number(rawValue);
  if (!Number.isFinite(unitSize) || unitSize <= 0) {
    throw new Error('unit size must be positive');
  }
  return unitSize;
}

function parseMediaUnitSize(rawValue) {
  const unitSize = Number(rawValue);
  if (!Number.isFinite(unitSize) || unitSize <= 0) {
    throw new Error('media unit size must be positive');
  }
  return unitSize;
}

function parseOptionalNumber(rawValue) {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return null;
  }

  const value = Number(rawValue);
  return Number.isFinite(value) ? value : null;
}

function roundNormalizedValue(value) {
  return Number(value.toFixed(12));
}
