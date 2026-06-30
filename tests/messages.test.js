import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCalculationSections,
  createTranslator,
} from '../src/options/messages.js';

test('creates a translator for zh-CN messages', () => {
  const t = createTranslator('zh-CN');

  assert.equal(t('controls.calculation'), '计算说明');
  assert.equal(t('results.title'), '结果输出');
});

test('labels quick entry text price unit as default 1M tokens', () => {
  const t = createTranslator('zh-CN');

  assert.match(t('quickEntry.textUnitSize'), /1M tokens/);
});

test('labels settings and comparison text fields as 1M token units', () => {
  const t = createTranslator('zh-CN');

  assert.match(t('forms.defaultTextInput'), /1M tokens/);
  assert.match(t('forms.defaultTextOutput'), /1M tokens/);
  assert.match(t('forms.runtimeTextInput'), /1M tokens/);
  assert.match(t('forms.runtimeTextOutput'), /1M tokens/);
});

test('builds calculation sections with formulas for zh-CN', () => {
  const sections = buildCalculationSections('zh-CN');
  const titles = sections.map((section) => section.title);

  assert.deepEqual(titles, [
    '汇率换算',
    '积分套餐折算',
    '套餐产能模式',
    '单个模型单位成本',
    '文本模型单次成本',
  ]);
  assert.match(sections[2].formula, /套餐价格/);
  assert.match(sections[4].example, /单次文本成本/);
});
