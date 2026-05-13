import Link from "next/link";
import { Send, CheckCircle2, AlertOctagon, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlainBadge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/format";
import type { ReviewState } from "@/lib/settlement-review";

export function SendForReviewButton({ showId }: { showId: string }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-1.5">
            <Send className="h-3.5 w-3.5 text-ink-600" />
            Pre-settlement review
          </CardTitle>
          <CardDescription>
            Send the worksheet to the artist team for line-item sign-off
            <em> before</em> finalizing. Each line gets accepted or contested
            with a reason — captured as structured agreement, not buried in a
            prose signoff.
          </CardDescription>
        </div>
        <Link href={`/shows/${showId}/settle/review`} className="shrink-0">
          <Button variant="brand" size="sm" className="whitespace-nowrap">
            <Send className="h-3.5 w-3.5" />
            Send for artist review
          </Button>
        </Link>
      </CardHeader>
    </Card>
  );
}

export function ReviewStatusCard({
  review,
  showId,
}: {
  review: ReviewState;
  showId: string;
}) {
  const acceptedCount = review.line_items.filter((d) => d.status === "accepted").length;
  const contestedCount = review.line_items.filter((d) => d.status === "contested").length;
  const allAccepted = contestedCount === 0;

  return (
    <Card accent={allAccepted ? "brand" : "rose"}>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-1.5">
            {allAccepted ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-brand-700" />
            ) : (
              <AlertOctagon className="h-3.5 w-3.5 text-rose-700" />
            )}
            Artist team review
            {allAccepted ? (
              <PlainBadge variant="brand" className="ml-1">
                All accepted
              </PlainBadge>
            ) : (
              <PlainBadge variant="rose" className="ml-1">
                {contestedCount} contested
              </PlainBadge>
            )}
          </CardTitle>
          <CardDescription>
            Submitted by <span className="text-ink-700 font-medium">{review.submitted_by}</span>
            {review.reviewer_role && (
              <>
                {" "}
                <span className="text-ink-400">· {review.reviewer_role}</span>
              </>
            )}{" "}
            on{" "}
            {new Date(review.submitted_at).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </CardDescription>
        </div>
        <Link href={`/shows/${showId}/settle/review`} className="shrink-0">
          <Button variant="secondary" size="sm" className="whitespace-nowrap">
            View / amend
            <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="divide-y divide-ink-100/80 py-2">
        {review.line_items.map((d) => (
          <div key={d.key} className="py-3">
            <div className="flex items-baseline justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] text-ink-800 leading-snug">
                  {d.label}
                </div>
              </div>
              <div className="text-[12.5px] font-mono tabular text-ink-700 shrink-0">
                {formatMoney(d.amount)}
              </div>
              <div className="shrink-0 w-20 text-right">
                {d.status === "accepted" ? (
                  <PlainBadge variant="brand">Accepted</PlainBadge>
                ) : (
                  <PlainBadge variant="rose">Contested</PlainBadge>
                )}
              </div>
            </div>
            {d.status === "contested" && d.contest_reason && (
              <div className="text-[11.5px] text-rose-800 mt-1.5 leading-relaxed bg-rose-50/40 rounded px-2.5 py-1.5 ring-1 ring-rose-200/40">
                <span className="font-medium">Reason:</span> {d.contest_reason}
              </div>
            )}
          </div>
        ))}
        {review.notes && (
          <div className="py-3">
            <div className="eyebrow text-[10px] text-ink-500 mb-1">
              Reviewer notes
            </div>
            <div className="text-[12.5px] text-ink-700 leading-relaxed">
              {review.notes}
            </div>
          </div>
        )}
        <div className="py-3 text-[11px] text-ink-400 leading-relaxed">
          {acceptedCount} accepted · {contestedCount} contested. Captured as
          structured per-line agreement — survives in the audit trail even if
          settlement.signoff_text never gets filled in.
        </div>
      </CardContent>
    </Card>
  );
}
