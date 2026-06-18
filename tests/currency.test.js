import test from 'node:test';
import assert from 'node:assert/strict';
import { convertCurrency } from '../src/lib/currency.js';

test('converts usd to cny using configured rates', () => {
  const converted = convertCurrency({
    amount: 2,
    fromCurrency: 'USD',
    toCurrency: 'CNY',
    rates: { CNY: 1, USD: 7.2 },
  });

  assert.equal(converted, 14.4);
});
