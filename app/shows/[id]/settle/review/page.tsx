import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getShowById } from "@/lib/queries";
import { formatShowDateFull } from "@/lib/format";
import {
  buildReviewLineItems,
  parseReviewState,
} from "@/lib/settlement-review";
import { ReviewForm } from "./review-form";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getShowById(id);
  if (!data) notFound();

  const { show, artist, agent, agency, settlement, recoups } = data;

  if (!settlement) {
    return (
      <div className="px-12 py-10 max-w-3xl">
        <Link
          href={`/shows/${show.id}/settle`}
          className="inline-flex items-center gap-1 text-[12px] text-ink-400 hover:text-ink-900 mb-8 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to settlement
        </Link>
        <div className="text-[13px] text-ink-500">
          No settlement record yet. The venue needs to draft a settlement before sending it for artist review.
        </div>
      </div>
    );
  }

  const lineItems = buildReviewLineItems(settlement, recoups);
  const existingReview = parseReviewState(settlement.reviewJson);

  return (
    <div className="px-12 py-10 max-w-3xl">
      <Link
        href={`/shows/${show.id}/settle`}
        className="inline-flex items-center gap-1 text-[12px] text-ink-400 hover:text-ink-900 mb-8 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to settlement
      </Link>

      <div className="mb-8">
        <div className="eyebrow text-[10px] text-ink-500 mb-2">
          Settlement review
        </div>
        <h1
          className="font-display text-[34px] font-medium text-ink-900 leading-[1.1]"
          style={{ letterSpacing: "-0.02em" }}
        >
          {artist?.name ?? "Artist"} &middot;{" "}
          <span className="text-ink-500">{formatShowDateFull(show.date)}</span>
        </h1>
        <p className="text-[13px] text-ink-500 mt-3 leading-relaxed">
          Review each line below before the venue finalizes. Accept anything that
          matches what you negotiated. Contest anything that doesn&apos;t — your
          reason will go to the venue with your submission. Every line item is
          captured as structured agreement, so there&apos;s a clean record if
          questions come up later.
        </p>
      </div>

      <ReviewForm
        showId={show.id}
        lineItems={lineItems}
        defaultReviewerRole={
          agent ? `Agent (${agent.name}${agency ? ` · ${agency.name}` : ""})` : ""
        }
        existing={existingReview}
      />
    </div>
  );
}
