export function calculateUnitCostFromPlanCredits({
  planPrice,
  creditAmount,
  creditsPerUnit,
}) {
  return Number((((planPrice / creditAmount) * creditsPerUnit)).toFixed(6));
}
