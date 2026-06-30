export const DEFAULT_SCENARIO = {
  textInputTokens: 1000000,
  textOutputTokens: 1000000,
  imageCount: 1,
  videoSeconds: 5,
  audioMinutes: 1,
};

export const COMMON_CURRENCIES = [
  { code: 'CNY', name: '人民币' },
  { code: 'USD', name: '美元' },
  { code: 'EUR', name: '欧元' },
  { code: 'GBP', name: '英镑' },
  { code: 'JPY', name: '日元' },
  { code: 'HKD', name: '港币' },
];

export const DEFAULT_EXCHANGE_RATES = {
  baseCurrency: 'CNY',
  rates: {
    CNY: 1,
    USD: 7.2,
    HKD: 0.92,
  },
  updatedAt: '2026-06-18T00:00:00.000Z',
};
