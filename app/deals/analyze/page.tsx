import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { getShowById } from "@/lib/queries";
import { DealAnalyzer } from "./deal-analyzer";

const RETROSPECTIVE_NOTE = /\s*\(Note added [^)]+\)\s*/gi;

function stripRetrospectiveNotes(text: string): string {
  return text.replace(RETROSPECTIVE_NOTE, " ").trim();
}

export default async function DealAnalyzePage({
  searchParams,
}: {
  searchParams: Promise<{ showId?: string }>;
}) {
  const { showId } = await searchParams;

  let initialText = "";
  let showLabel: string | null = null;
  if (showId) {
    const data = await getShowById(showId);
    if (data?.deal?.dealNotesFreetext) {
      initialText = stripRetrospectiveNotes(data.deal.dealNotesFreetext);
      showLabel = `${data.artist?.name ?? "Show"} · ${data.show.date}`;
    }
  }

  return (
    <div className="px-12 py-10 max-w-3xl">
      <Link
        href={showId ? `/shows/${showId}` : "/shows"}
        className="inline-flex items-center gap-1 text-[12px] text-ink-400 hover:text-ink-900 mb-8 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />{" "}
        {showId ? "Back to show" : "Back to shows"}
      </Link>

      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-4 w-4 text-brand-700" />
          <div className="eyebrow text-[10px] text-ink-500">
            Deal-email analyzer
          </div>
        </div>
        <h1
          className="font-display text-[34px] font-medium text-ink-900 leading-[1.1]"
          style={{ letterSpacing: "-0.02em" }}
        >
          Catch the ambiguity before the show.
        </h1>
        <p className="text-[13px] text-ink-500 mt-3 leading-relaxed max-w-2xl">
          Paste the deal email or your deal notes. The analyzer extracts the
          structured fields and flags any place where the language has two valid
          readings — the kind of ambiguity that becomes a settlement dispute
          weeks later. Resolve each ambiguity here, once, instead of arguing
          about it post-show with $720 on the line.
        </p>
        {showLabel && (
          <p className="text-[12px] text-ink-400 mt-3">
            Pre-filled from <span className="text-ink-700 font-medium">{showLabel}</span>
            . Retrospective notes stripped — analyzing the deal terms as they
            were originally written.
          </p>
        )}
      </div>

      <DealAnalyzer initialText={initialText} />
    </div>
  );
}
