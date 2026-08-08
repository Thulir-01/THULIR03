/**
 * Pure helpers shared by the printable report/invoice documents and the
 * in-app toolbar (kept out of component files so fast-refresh works).
 */

export function getFlag(
  result: string | null,
  refLow: number | null,
  refHigh: number | null,
): "high" | "low" | null {
  if (!result || (refLow === null && refHigh === null)) return null;
  const val = parseFloat(result);
  if (isNaN(val)) return null;
  if (refHigh !== null && val > refHigh) return "high";
  if (refLow !== null && val < refLow) return "low";
  return null;
}

/** Public verification URL encoded in the printed QR and shared via WhatsApp. */
export function getReportVerifyUrl(orderNumber: string): string {
  return `${window.location.origin}/verify-report?ref=${encodeURIComponent(
    orderNumber,
  )}`;
}
