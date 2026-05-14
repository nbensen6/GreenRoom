/**
 * Manual worksheet adjustments — the escape hatch for deal shapes the
 * structured math engine can't represent (custom co-bills, mid-show
 * negotiated changes, tier ratchets before they're properly modeled).
 *
 * Adjustments are simple labeled amounts (positive or negative) that get
 * added to the structured payout. Total to artist = calc.totalToArtist +
 * sum(adjustments).
 */

export type WorksheetAdjustment = {
  id: string;
  label: string;
  amount: number;
  note?: string;
  added_at: string;
};

export function parseAdjustments(json: string | null): WorksheetAdjustment[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (a): a is WorksheetAdjustment =>
        a &&
        typeof a === "object" &&
        typeof a.id === "string" &&
        typeof a.label === "string" &&
        typeof a.amount === "number" &&
        typeof a.added_at === "string",
    );
  } catch {
    return [];
  }
}

export function sumAdjustments(adjustments: WorksheetAdjustment[]): number {
  return adjustments.reduce((s, a) => s + a.amount, 0);
}
