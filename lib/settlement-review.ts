import type { Settlement, Recoup } from "@/db/schema";

/**
 * Line items that the artist team reviews. Derived from the existing
 * settlement record's structured fields + parsed recoups, so this works
 * even for deal types the in-app math engine doesn't support yet.
 */
export type ReviewLineItem = {
  key: string;
  label: string;
  amount: number;
  /** Sub-description shown below the label. */
  hint?: string;
  /** True when this line subtracts from gross (display with minus sign). */
  negative?: boolean;
  /** True when this is the bottom-line total. */
  isTotal?: boolean;
};

export type ReviewDecisionStatus = "accepted" | "contested";

export type ReviewDecision = {
  key: string;
  label: string;
  amount: number;
  status: ReviewDecisionStatus;
  contest_reason?: string;
};

export type ReviewState = {
  submitted_at: string;
  submitted_by: string;
  reviewer_role?: string;
  line_items: ReviewDecision[];
  notes?: string;
};

const RECOUP_CATEGORY_LABELS: Record<Recoup["category"], string> = {
  marketing: "Marketing recoup",
  hospitality_overage: "Hospitality overage",
  production_overage: "Production overage",
  prior_advance: "Prior advance",
  damages: "Damages",
  other: "Other recoup",
};

export function buildReviewLineItems(
  settlement: Settlement,
  recoups: Recoup[],
): ReviewLineItem[] {
  const items: ReviewLineItem[] = [];

  if (settlement.grossBoxOffice != null) {
    items.push({
      key: "gross_box_office",
      label: "Gross box office",
      amount: settlement.grossBoxOffice,
    });
  }

  if (settlement.netBoxOffice != null) {
    items.push({
      key: "net_box_office",
      label: "Net box office (after fees)",
      amount: settlement.netBoxOffice,
    });
  }

  if (settlement.totalExpenses != null && settlement.totalExpenses > 0) {
    items.push({
      key: "total_expenses",
      label: "Total expenses (passed through)",
      amount: settlement.totalExpenses,
      negative: true,
    });
  }

  for (const r of recoups) {
    items.push({
      key: `recoup_${r.id}`,
      label: `${RECOUP_CATEGORY_LABELS[r.category]}: ${r.label}`,
      amount: r.amount,
      hint: `Currently marked ${r.status}`,
      negative: true,
    });
  }

  if (settlement.totalToArtist != null) {
    items.push({
      key: "total_to_artist",
      label: "Total to artist",
      amount: settlement.totalToArtist,
      isTotal: true,
    });
  }

  return items;
}

export function parseReviewState(json: string | null): ReviewState | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.submitted_at === "string" &&
      Array.isArray(parsed.line_items)
    ) {
      return parsed as ReviewState;
    }
  } catch {
    // ignore
  }
  return null;
}
