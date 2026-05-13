"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Check, AlertOctagon, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoney } from "@/lib/format";
import type {
  ReviewLineItem,
  ReviewDecision,
  ReviewDecisionStatus,
  ReviewState,
} from "@/lib/settlement-review";

type ItemState = {
  status: ReviewDecisionStatus | null;
  contestReason: string;
};

export function ReviewForm({
  showId,
  lineItems,
  defaultReviewerRole,
  existing,
}: {
  showId: string;
  lineItems: ReviewLineItem[];
  defaultReviewerRole: string;
  existing: ReviewState | null;
}) {
  const router = useRouter();

  const initialItemState: Record<string, ItemState> = useMemo(() => {
    const map: Record<string, ItemState> = {};
    for (const li of lineItems) {
      const prior = existing?.line_items.find((d) => d.key === li.key);
      map[li.key] = {
        status: prior?.status ?? null,
        contestReason: prior?.contest_reason ?? "",
      };
    }
    return map;
  }, [lineItems, existing]);

  const [items, setItems] = useState<Record<string, ItemState>>(initialItemState);
  const [reviewerName, setReviewerName] = useState(existing?.submitted_by ?? "");
  const [reviewerRole, setReviewerRole] = useState(
    existing?.reviewer_role ?? defaultReviewerRole,
  );
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function decide(key: string, status: ReviewDecisionStatus) {
    setItems((prev) => ({
      ...prev,
      [key]: { ...prev[key], status },
    }));
  }

  function setReason(key: string, contestReason: string) {
    setItems((prev) => ({
      ...prev,
      [key]: { ...prev[key], contestReason },
    }));
  }

  const allDecided = lineItems.every((li) => items[li.key]?.status != null);
  const contestedWithoutReason = lineItems.some(
    (li) =>
      items[li.key]?.status === "contested" &&
      !items[li.key]?.contestReason.trim(),
  );
  const canSubmit =
    allDecided && !contestedWithoutReason && reviewerName.trim().length > 0;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const decisions: ReviewDecision[] = lineItems.map((li) => {
        const state = items[li.key];
        const decision: ReviewDecision = {
          key: li.key,
          label: li.label,
          amount: li.amount,
          status: state.status as ReviewDecisionStatus,
        };
        if (state.status === "contested") {
          decision.contest_reason = state.contestReason.trim();
        }
        return decision;
      });
      const res = await fetch(`/api/settle/${showId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submitted_by: reviewerName.trim(),
          reviewer_role: reviewerRole.trim() || undefined,
          notes: notes.trim() || undefined,
          line_items: decisions,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setSubmitted(true);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const acceptedCount = lineItems.filter(
    (li) => items[li.key]?.status === "accepted",
  ).length;
  const contestedCount = lineItems.filter(
    (li) => items[li.key]?.status === "contested",
  ).length;

  if (submitted) {
    return (
      <Card accent={contestedCount > 0 ? "rose" : "brand"}>
        <CardContent className="py-10 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 ring-1 ring-brand-200/80 mb-5">
            <Check className="h-5 w-5 text-brand-700" />
          </div>
          <h2
            className="font-display text-[22px] font-medium text-ink-900 mb-2"
            style={{ letterSpacing: "-0.02em" }}
          >
            Review submitted
          </h2>
          <p className="text-[13px] text-ink-500 max-w-md mx-auto leading-relaxed">
            {contestedCount > 0
              ? `${contestedCount} line item${contestedCount === 1 ? "" : "s"} contested. The venue has been notified and will follow up.`
              : "All lines accepted. The venue will finalize the settlement and wire payment."}
          </p>
          <div className="mt-6">
            <a
              href={`/shows/${showId}/settle`}
              className="inline-flex items-center gap-1 text-[12.5px] text-brand-700 hover:text-brand-800 font-medium"
            >
              Back to settlement <ArrowRight className="h-3 w-3" />
            </a>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {existing && (
        <div className="rounded-lg bg-sky-50/60 ring-1 ring-sky-200/60 p-3.5 text-[12.5px] text-ink-700">
          A review was already submitted by{" "}
          <span className="font-medium">{existing.submitted_by}</span> on{" "}
          {new Date(existing.submitted_at).toLocaleString()}. You can adjust and
          resubmit below — the prior decisions are pre-filled.
        </div>
      )}

      <Card>
        <CardContent className="divide-y divide-ink-100/80 py-2">
          {lineItems.map((li) => {
            const state = items[li.key];
            const isAccepted = state.status === "accepted";
            const isContested = state.status === "contested";
            return (
              <div key={li.key} className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div
                      className={`text-[13.5px] ${
                        li.isTotal ? "font-semibold text-ink-900" : "text-ink-800"
                      } leading-snug`}
                    >
                      {li.label}
                    </div>
                    {li.hint && (
                      <div className="text-[11.5px] text-ink-400 mt-0.5">
                        {li.hint}
                      </div>
                    )}
                  </div>
                  <div
                    className={`text-[14px] font-mono tabular shrink-0 ${
                      li.isTotal ? "font-semibold text-ink-900" : "text-ink-700"
                    }`}
                  >
                    {li.negative ? "−" : ""}
                    {formatMoney(li.amount)}
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-2.5">
                  <button
                    type="button"
                    onClick={() => decide(li.key, "accepted")}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11.5px] font-medium ring-1 ring-inset transition-colors ${
                      isAccepted
                        ? "bg-brand-700 text-white ring-brand-800/30"
                        : "bg-white text-ink-700 ring-ink-200/80 hover:bg-ink-50"
                    }`}
                  >
                    <Check className="h-3 w-3" />
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => decide(li.key, "contested")}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11.5px] font-medium ring-1 ring-inset transition-colors ${
                      isContested
                        ? "bg-rose-700 text-white ring-rose-800/30"
                        : "bg-white text-ink-700 ring-ink-200/80 hover:bg-ink-50"
                    }`}
                  >
                    <AlertOctagon className="h-3 w-3" />
                    Contest
                  </button>
                  {state.status == null && (
                    <span className="text-[11px] text-ink-400 ml-1">
                      Decision required
                    </span>
                  )}
                </div>

                {isContested && (
                  <div className="mt-3">
                    <label className="block text-[11px] eyebrow text-ink-500 mb-1.5">
                      Why are you contesting this?
                    </label>
                    <textarea
                      value={state.contestReason}
                      onChange={(e) => setReason(li.key, e.target.value)}
                      placeholder="e.g., Marketing recoup should be inside the $2,500 expense cap, not separate from it."
                      className="w-full rounded-md border border-ink-200 bg-white text-[12.5px] text-ink-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-400/40 focus:border-rose-400"
                      rows={2}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-5 space-y-4">
          <div>
            <label className="block text-[11px] eyebrow text-ink-500 mb-1.5">
              Your name (required)
            </label>
            <input
              type="text"
              value={reviewerName}
              onChange={(e) => setReviewerName(e.target.value)}
              placeholder="e.g., Daniel Hwang"
              className="w-full rounded-md border border-ink-200 bg-white text-[13px] text-ink-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400"
            />
          </div>
          <div>
            <label className="block text-[11px] eyebrow text-ink-500 mb-1.5">
              Your role / affiliation
            </label>
            <input
              type="text"
              value={reviewerRole}
              onChange={(e) => setReviewerRole(e.target.value)}
              placeholder="e.g., Agent (WME)"
              className="w-full rounded-md border border-ink-200 bg-white text-[13px] text-ink-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400"
            />
          </div>
          <div>
            <label className="block text-[11px] eyebrow text-ink-500 mb-1.5">
              Any general notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything beyond per-line objections."
              className="w-full rounded-md border border-ink-200 bg-white text-[12.5px] text-ink-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400"
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-lg bg-rose-50/60 ring-1 ring-rose-200/60 p-3 text-[12.5px] text-rose-900">
          <div className="font-medium mb-0.5">Submission failed</div>
          <div className="text-rose-800">{error}</div>
        </div>
      )}

      <div className="flex items-center justify-between gap-4 pt-2">
        <div className="text-[12px] text-ink-500">
          {acceptedCount} accepted · {contestedCount} contested ·{" "}
          {lineItems.length - acceptedCount - contestedCount} pending
        </div>
        <Button
          variant="brand"
          onClick={submit}
          disabled={!canSubmit || submitting}
          className="shrink-0"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              Submit review
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>

      {!canSubmit && !submitting && (
        <div className="text-[11.5px] text-ink-400 text-right">
          {!allDecided && "Decide on every line item to submit. "}
          {contestedWithoutReason && "Each contested line needs a reason. "}
          {!reviewerName.trim() && "Add your name."}
        </div>
      )}
    </div>
  );
}
