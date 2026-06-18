import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateUnitCostFromPlanCredits } from '../src/lib/calculation.js';

test('calculates image unit cost from plan credits', () => {
  const result = calculateUnitCostFromPlanCredits({
    planPrice: 39,
    creditAmount: 400,
    creditsPerUnit: 20,
  });

  assert.equal(result, 1.95);
});
