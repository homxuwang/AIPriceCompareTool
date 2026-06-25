import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDirectUnitDefinitions } from '../src/options/unit-normalization.js';

test('normalizes text prices from one million tokens to one thousand tokens', () => {
  const result = normalizeDirectUnitDefinitions({
    category: 'text',
    values: {
      textInputPrice: '0.9',
      textOutputPrice: '4.5',
      textCachedInputPrice: '0.09',
      textUnitSize: '1000000',
    },
  });

  assert.equal(result.originalUnit.unitSize, 1000000);
  assert.deepEqual(result, {
    originalUnit: { kind: 'tokens', unitSize: 1000000 },
    unitDefinitions: [
      { unitType: 'per_1k_input_tokens', value: 0.0009 },
      { unitType: 'per_1k_output_tokens', value: 0.0045 },
      { unitType: 'per_1k_cached_input_tokens', value: 0.00009 },
    ],
  });
});

test('normalizes text prices from custom token unit size', () => {
  const result = normalizeDirectUnitDefinitions({
    category: 'text',
    values: {
      textInputPrice: '0.02',
      textOutputPrice: '0.08',
      textUnitSize: '2000',
    },
  });

  assert.deepEqual(result, {
    originalUnit: { kind: 'tokens', unitSize: 2000 },
    unitDefinitions: [
      { unitType: 'per_1k_input_tokens', value: 0.01 },
      { unitType: 'per_1k_output_tokens', value: 0.04 },
    ],
  });
});

test('normalizes video minute prices to seconds', () => {
  const result = normalizeDirectUnitDefinitions({
    category: 'video',
    values: {
      mediaPrice: '12',
      mediaUnitKind: 'minute',
      mediaUnitSize: '2',
    },
  });

  assert.deepEqual(result, {
    originalUnit: { kind: 'minute', unitSize: 2 },
    unitDefinitions: [{ unitType: 'per_second', value: 0.1 }],
  });
});

test('keeps image prices per image', () => {
  const result = normalizeDirectUnitDefinitions({
    category: 'image',
    values: {
      imagePrice: '0.04',
    },
  });

  assert.deepEqual(result, {
    originalUnit: { kind: 'image', unitSize: 1 },
    unitDefinitions: [{ unitType: 'per_image', value: 0.04 }],
  });
});

test('rejects non-positive custom token unit size', () => {
  assert.throws(
    () => normalizeDirectUnitDefinitions({
      category: 'text',
      values: {
        textInputPrice: '0.02',
        textUnitSize: '0',
      },
    }),
    /unit size must be positive/,
  );
});
