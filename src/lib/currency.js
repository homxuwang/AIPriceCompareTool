export function convertCurrency({ amount, fromCurrency, toCurrency, rates }) {
  if (fromCurrency === toCurrency) {
    return amount;
  }

  const fromRate = rates[fromCurrency];
  const toRate = rates[toCurrency];

  if (fromRate == null || toRate == null) {
    throw new Error(`Missing exchange rate for ${fromCurrency} or ${toCurrency}`);
  }

  return (amount * fromRate) / toRate;
}
