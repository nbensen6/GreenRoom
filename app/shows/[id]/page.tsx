import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  FileSpreadsheet,
  AlertCircle,
  Clock,
  TrendingUp,
  Sparkles,
  AlertTriangle,
  Mail,
  Send,
  CheckCircle2,
  AlertOctagon,
} from "lucide-react";
import { getShowById } from "@/lib/queries";
import { Field } from "@/components/ui/card";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { StatusBadge, DealTypeBadge, PlainBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { calculateSettlement, parseBonuses } from "@/lib/dealMath";
import {
  formatMoney,
  formatMoneyCompact,
  formatShowDateFull,
  relativeShowDate,
} from "@/lib/format";
import type { Bonus } from "@/db/schema";
import { ShowPipeline } from "./show-pipeline";
import { parseReviewState } from "@/lib/settlement-review";
import { parseEmails } from "@/lib/settlement-emails";
import { EmailSection } from "./settle/email-section";
import { SettlementWorksheetCard } from "./settle/worksheet-card";
import {
  parseAdjustments,
  sumAdjustments,
} from "@/lib/settlement-adjustments";
import {
  WorksheetHero,
  WorksheetBody,
  BonusesNotTriggeredBody,
  UnsupportedDealBody,
  RecoupsBody,
  SignoffBody,
} from "./settle/sections";

const COMP_LABELS: Record<string, string> = {
  artist_gl: "Artist guest list",
  label: "Label / management",
  press: "Press",
  venue_staff: "Venue staff",
  sponsor: "Sponsor",
  promo: "Promo / radio",
  other: "Other",
};

export default async function ShowDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getShowById(id);
  if (!data) notFound();

  const {
    show,
    artist,
    agent,
    agency,
    deal,
    settlement,
    ticketSales,
    expenses,
    comps,
    recoups,
  } = data;

  const grossSoFar = ticketSales.reduce((sum, t) => sum + t.gross, 0);
  const totalFees = ticketSales.reduce((sum, t) => sum + t.fees, 0);
  const totalTickets = ticketSales.reduce((sum, t) => sum + (t.qty ?? 0), 0);
  const totalExpenses = expenses
    .filter((e) => !e.absorbedByVenue)
    .reduce((sum, e) => sum + e.amount, 0);
  const absorbedTotal = expenses
    .filter((e) => e.absorbedByVenue)
    .reduce((sum, e) => sum + e.amount, 0);

  const totalCompCount = comps.reduce((s, c) => s + c.count, 0);
  const compsCountingTowardGross = comps
    .filter((c) => c.countsTowardGross)
    .reduce((s, c) => s + c.count, 0);

  const bonuses = deal ? parseBonuses(deal) : [];

  const isDisputed = settlement?.status === "disputed";

  const calc = deal
    ? calculateSettlement({
        deal,
        ticketSales,
        expenses,
        venueCapacity: data.venue?.capacity ?? undefined,
      })
    : null;
  const disputedRecoups = recoups.filter((r) => r.status === "disputed");
  const disputedRecoupValue = disputedRecoups.reduce((s, r) => s + r.amount, 0);
  const settlementIsDisputed =
    settlement?.status === "disputed" ||
    settlement?.status === "revised" ||
    !!settlement?.disputedAt;
  const review = settlement ? parseReviewState(settlement.reviewJson) : null;
  const emails = settlement ? parseEmails(settlement.emailsJson) : [];
  const adjustments = settlement
    ? parseAdjustments(settlement.worksheetAdjustmentsJson)
    : [];
  const adjustmentsTotal = sumAdjustments(adjustments);

  const showSettlementSection = !!deal;
  const defaultRecipientName = agent
    ? `${agent.name}${agency ? ` (${agency.name})` : ""}`
    : "";

  return (
    <div className="max-w-7xl">
      {/* Poster header */}
      <div
        className={`px-12 pt-10 pb-14 ${isDisputed ? "bg-gradient-to-b from-rose-50/40 to-canvas" : "bg-gradient-to-b from-brand-50/30 to-canvas"}`}
      >
        <Link
          href="/shows"
          className="inline-flex items-center gap-1 text-[12px] text-ink-400 hover:text-ink-900 mb-8 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All shows
        </Link>

        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-1.5 mb-4">
              <StatusBadge status={show.status} />
              {deal && <DealTypeBadge type={deal.dealType} />}
              {isDisputed && <PlainBadge variant="rose">Disputed</PlainBadge>}
              {bonuses.length > 0 && (
                <PlainBadge variant="brand">
                  {bonuses.length} bonus{bonuses.length === 1 ? "" : "es"}
                </PlainBadge>
              )}
            </div>
            <h1
              className="font-display text-[56px] font-medium text-ink-900 leading-[1.02]"
              style={{ letterSpacing: "-0.025em", fontOpticalSizing: "auto" }}
            >
              {artist?.name ?? "—"}
            </h1>
            <div className="text-[14px] text-ink-400 mt-3 flex items-center gap-2">
              <span className="text-ink-600 font-medium">
                {formatShowDateFull(show.date)}
              </span>
              <span className="text-ink-300">·</span>
              <span>{relativeShowDate(show.date)}</span>
              <span className="text-ink-200">·</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                doors {show.doorsTime} · set {show.setTime}
              </span>
            </div>
          </div>
          {showSettlementSection && (
            <Link href="#settlement" className="mt-6 shrink-0">
              <Button variant="brand" size="lg">
                <FileSpreadsheet className="h-4 w-4" />
                {settlement ? "Jump to settlement" : "Open settlement"}
              </Button>
            </Link>
          )}
        </div>

        {/* Key numbers strip */}
        <div className="flex items-baseline gap-10 mt-8 pt-5 border-t border-ink-200/40">
          <MiniStat label="Gross" value={formatMoneyCompact(grossSoFar)} />
          <MiniStat label="Tickets" value={String(totalTickets)} />
          <MiniStat
            label="Expenses"
            value={formatMoneyCompact(totalExpenses)}
          />
          {settlement?.totalToArtist != null && (
            <MiniStat
              label="To artist"
              value={formatMoneyCompact(settlement.totalToArtist)}
              accent
            />
          )}
        </div>
      </div>

      <div className="px-12 pb-12">
        <ShowPipeline data={data} />

        {show.internalNotes && (
          <div className="mb-6 rounded-lg bg-amber-50/50 ring-1 ring-amber-200/60 p-5 flex gap-3">
            <AlertCircle className="h-4 w-4 text-amber-700 mt-0.5 shrink-0" />
            <div>
              <div className="eyebrow text-[10px] text-amber-800 mb-1.5">
                Mariana&apos;s notes
              </div>
              <div className="text-[13px] text-ink-800 leading-relaxed">
                {show.internalNotes}
              </div>
            </div>
          </div>
        )}

        {/* Email — cross-cutting communication tool, used at any point in the deal */}
        {showSettlementSection && (
          <div id="email" className="mb-8 scroll-mt-12">
            <EmailSection
              showId={show.id}
              emails={emails}
              defaultRecipientName={defaultRecipientName}
              deal={deal ?? null}
            />
          </div>
        )}

        {/* ---------------- 1. Show details (pre-show) ---------------- */}
        <section id="details" className="mt-2 scroll-mt-12">
          <SectionHeader
            eyebrow="1 · Pre-show"
            title="Show details"
            subtitle="What was negotiated, who's playing, and what's been sold so far. Locked in before show night."
          />

          <div className="space-y-5">
            <CollapsibleCard
              id="deal-terms"
              title="Deal terms"
              description="What was negotiated. Mariana enters this from the email thread with the agent."
              badge={deal && <DealTypeBadge type={deal.dealType} />}
              headerAction={
                deal ? (
                  <div className="flex items-center gap-1.5">
                    {deal.dealNotesFreetext && (
                      <Link
                        href={`/deals/analyze?showId=${show.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11.5px] font-medium ring-1 ring-inset bg-white text-ink-700 ring-ink-200/80 hover:bg-ink-50 transition-colors whitespace-nowrap"
                      >
                        <Sparkles className="h-3 w-3 text-brand-700" />
                        Analyze with AI
                      </Link>
                    )}
                    <Link
                      href={`?intent=confirm_deal_terms#email`}
                      scroll={false}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11.5px] font-medium ring-1 ring-inset bg-white text-ink-700 ring-ink-200/80 hover:bg-ink-50 transition-colors whitespace-nowrap"
                    >
                      <Mail className="h-3 w-3 text-brand-700" />
                      Email to confirm
                    </Link>
                  </div>
                ) : null
              }
              defaultOpen
            >
              {deal ? (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <Field
                      label="Guarantee"
                      mono
                      value={
                        deal.guaranteeAmount != null
                          ? formatMoney(deal.guaranteeAmount)
                          : "—"
                      }
                    />
                    <Field
                      label="Percentage"
                      mono
                      value={
                        deal.percentage != null
                          ? `${(deal.percentage * 100).toFixed(0)}% ${deal.percentageBasis ? `of ${deal.percentageBasis}` : ""}`
                          : "—"
                      }
                    />
                    <Field
                      label="Expense cap"
                      mono
                      value={
                        deal.expenseCap != null
                          ? formatMoney(deal.expenseCap)
                          : "—"
                      }
                    />
                    <Field
                      label="Hospitality cap"
                      mono
                      value={
                        deal.hospitalityCap != null
                          ? formatMoney(deal.hospitalityCap)
                          : "—"
                      }
                    />
                  </div>

                  {bonuses.length > 0 && (
                    <div className="rounded-lg ring-1 ring-brand-200/50 bg-brand-50/20 p-4">
                      <div className="flex items-center gap-1.5 mb-2.5">
                        <TrendingUp className="h-3.5 w-3.5 text-brand-700" />
                        <div className="eyebrow text-[10px] text-brand-800">
                          Bonuses & escalators (structured)
                        </div>
                      </div>
                      <ul className="space-y-2">
                        {bonuses.map((b, i) => (
                          <li
                            key={i}
                            className="text-[12.5px] text-ink-800 flex items-start gap-2"
                          >
                            <BonusBadge type={b.type} />
                            <span className="leading-relaxed">{b.label}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="text-[11px] text-ink-400 mt-3 leading-snug">
                        Stored in{" "}
                        <code className="font-mono text-[10px] bg-white/80 px-1 py-0.5 rounded ring-1 ring-ink-200/40">
                          bonuses_json
                        </code>
                        . The in-app tool only reads structured bonuses —
                        anything in the prose below is invisible to it.
                      </div>
                    </div>
                  )}

                  {deal.dealNotesFreetext && (
                    <div>
                      <div className="eyebrow text-[10px] text-ink-500 mb-2">
                        Deal notes (free text — what Mariana actually trusts)
                      </div>
                      <div
                        className="text-[13px] text-ink-800 bg-canvas-soft rounded-lg p-4 ring-1 ring-ink-200/50 leading-relaxed font-[450]"
                        style={{ fontStyle: "italic" }}
                      >
                        {deal.dealNotesFreetext}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-[13px] text-ink-400">
                  No deal entered yet.
                </div>
              )}
            </CollapsibleCard>

            <CollapsibleCard
              id="artist-agent"
              title="Artist & agent"
              defaultOpen={false}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Field label="Artist" value={artist?.name ?? "—"} />
                <Field
                  label="Genre"
                  value={
                    <span className="capitalize">{artist?.genre ?? "—"}</span>
                  }
                />
                <Field
                  label="Prior shows here"
                  value={String(artist?.priorShowCount ?? 0)}
                  mono
                />
                <Field
                  label="Agent"
                  value={
                    agent
                      ? `${agent.name}${agency ? ` · ${agency.name}` : ""}`
                      : "—"
                  }
                />
              </div>
              {agent?.preferencesNotes && (
                <div className="mt-5">
                  <div className="eyebrow text-[10px] text-ink-500 mb-2">
                    Agent notes
                  </div>
                  <div className="text-[12.5px] text-ink-800 bg-amber-50/50 ring-1 ring-amber-200/50 rounded-lg p-3 leading-relaxed">
                    {agent.preferencesNotes}
                  </div>
                </div>
              )}
            </CollapsibleCard>

            <CollapsibleCard
              id="box-office"
              title="Box office"
              description="From integrated ticketing."
              defaultOpen={false}
            >
              <div className="space-y-3">
                <div>
                  <div className="eyebrow text-[10px] text-ink-400">Gross</div>
                  <div className="text-[28px] font-mono tabular font-semibold text-ink-900 mt-1 leading-none">
                    {formatMoneyCompact(grossSoFar)}
                  </div>
                </div>
                {totalTickets > 0 ? (
                  <div className="text-[12px] text-ink-500 pt-4 border-t border-ink-100/80 leading-relaxed">
                    <span className="font-mono tabular font-medium text-ink-700">
                      {totalTickets}
                    </span>{" "}
                    tickets ·{" "}
                    <span className="font-mono tabular">
                      {formatMoney(totalFees)}
                    </span>{" "}
                    in fees
                    <div className="mt-1.5 text-ink-400">
                      Net{" "}
                      <span className="font-mono tabular text-ink-700">
                        {formatMoneyCompact(grossSoFar - totalFees)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-[12px] text-ink-400 pt-3 border-t border-ink-100/80">
                    No sales yet.
                  </div>
                )}
              </div>
            </CollapsibleCard>

            <CollapsibleCard
              id="comps"
              title="Comps"
              description={
                <>
                  {totalCompCount} comp tickets across {comps.length} categor
                  {comps.length === 1 ? "y" : "ies"}.
                  {compsCountingTowardGross > 0 && (
                    <>
                      {" "}
                      <span className="text-amber-700 font-medium">
                        {compsCountingTowardGross} count toward gross.
                      </span>
                    </>
                  )}
                </>
              }
              badge={
                <PlainBadge variant="default">
                  {totalCompCount} total
                </PlainBadge>
              }
              defaultOpen={false}
            >
              {comps.length === 0 ? (
                <div className="text-[13px] text-ink-400">
                  No comps recorded for this show.
                </div>
              ) : (
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-left border-b border-ink-100/80">
                      <th className="py-2 eyebrow text-[10px] text-ink-400 font-semibold">
                        Category
                      </th>
                      <th className="py-2 eyebrow text-[10px] text-ink-400 font-semibold text-right">
                        Count
                      </th>
                      <th className="py-2 eyebrow text-[10px] text-ink-400 font-semibold text-right">
                        Face value
                      </th>
                      <th className="py-2 eyebrow text-[10px] text-ink-400 font-semibold text-right">
                        Counts toward gross?
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100/60">
                    {comps.map((c) => (
                      <tr key={c.id}>
                        <td className="py-2.5">
                          {COMP_LABELS[c.category] ?? c.category}
                          {c.notes && (
                            <span className="text-ink-400 ml-1">
                              · {c.notes}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 text-right font-mono tabular">
                          {c.count}
                        </td>
                        <td className="py-2.5 text-right font-mono tabular text-ink-500">
                          {formatMoney(c.faceValue * c.count)}
                        </td>
                        <td className="py-2.5 text-right">
                          {c.countsTowardGross ? (
                            <span className="text-amber-700 font-medium">
                              Yes
                            </span>
                          ) : (
                            <span className="text-ink-400">No</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CollapsibleCard>

            <CollapsibleCard
              id="expenses"
              title="Expenses"
              description="Entered during the week, often incompletely."
              badge={
                absorbedTotal > 0 ? (
                  <PlainBadge variant="amber">
                    {formatMoney(absorbedTotal)} absorbed
                  </PlainBadge>
                ) : null
              }
              defaultOpen={false}
            >
              {expenses.length === 0 ? (
                <div className="text-[13px] text-ink-400">
                  No expenses entered yet.
                </div>
              ) : (
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-left border-b border-ink-100/80">
                      <th className="py-2 eyebrow text-[10px] text-ink-400 font-semibold">
                        Category
                      </th>
                      <th className="py-2 eyebrow text-[10px] text-ink-400 font-semibold">
                        Description
                      </th>
                      <th className="py-2 eyebrow text-[10px] text-ink-400 font-semibold text-right">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100/60">
                    {expenses.map((e) => (
                      <tr key={e.id}>
                        <td className="py-2.5 capitalize">
                          {e.category}
                          {e.absorbedByVenue && (
                            <PlainBadge variant="amber" className="ml-2">
                              absorbed
                            </PlainBadge>
                          )}
                        </td>
                        <td className="py-2.5 text-ink-500">
                          {e.description ?? "—"}
                        </td>
                        <td className="py-2.5 text-right font-mono tabular">
                          {formatMoney(e.amount)}
                        </td>
                      </tr>
                    ))}
                    <tr className="font-medium">
                      <td className="py-3" colSpan={2}>
                        Total (passed through)
                      </td>
                      <td className="py-3 text-right font-mono tabular">
                        {formatMoney(totalExpenses)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}
            </CollapsibleCard>
          </div>
        </section>

        {/* ---------------- 2. Settlement (post-show) ---------------- */}
        {showSettlementSection && (
          <section id="settlement" className="mt-12 scroll-mt-12">
            <SectionHeader
              eyebrow="2 · Post-show"
              title={settlement ? "Settle the show" : "Settlement preview"}
              subtitle={
                settlement
                  ? "Reconcile, send for sign-off, and chase payment — all from one place."
                  : "Forecast of what the artist owes based on the deal + sales so far."
              }
            />

            {settlementIsDisputed && disputedRecoupValue > 0 && (
              <div className="mb-5 rounded-lg border border-rose-200/60 bg-rose-50/40 p-5 flex gap-3">
                <AlertTriangle className="h-4 w-4 text-rose-700 mt-0.5 shrink-0" />
                <div>
                  <div className="text-[13px] font-semibold text-rose-800">
                    {disputedRecoups.length} recoup
                    {disputedRecoups.length === 1 ? "" : "s"} in dispute ·{" "}
                    {formatMoney(disputedRecoupValue)} contested
                  </div>
                  <p className="text-[12.5px] text-ink-600 mt-1 leading-relaxed">
                    The artist team has flagged recoup line items. This
                    settlement cannot be finalized until the dispute is
                    resolved.
                  </p>
                </div>
              </div>
            )}

            {/* Hero number — only when calc is supported */}
            {calc?.supported && (
              <div className="mb-6 rounded-lg bg-white ring-1 ring-ink-200/60 px-6">
                <WorksheetHero
                  calc={calc}
                  existingSettlement={settlement ?? null}
                  adjustmentsTotal={adjustmentsTotal}
                />
              </div>
            )}

            <div className="space-y-5">
              {/* a. Worksheet (with AI chip + Review chip) */}
              {calc && (
                <SettlementWorksheetCard
                  showId={show.id}
                  title={
                    calc.supported
                      ? "Settlement worksheet"
                      : "Worksheet inputs"
                  }
                  description={
                    calc.supported ? (
                      <span className="font-mono">{calc.finalFormula}</span>
                    ) : undefined
                  }
                  accent={calc.supported ? "brand" : undefined}
                  canAnalyze={!!settlement}
                  reviewChip={
                    settlement ? (
                      <ReviewChip showId={show.id} review={review} />
                    ) : undefined
                  }
                  adjustments={settlement ? adjustments : undefined}
                  baseTotal={
                    settlement && calc.supported ? calc.totalToArtist : undefined
                  }
                  defaultOpen
                >
                  {calc.supported ? (
                    <WorksheetBody calc={calc} />
                  ) : (
                    <UnsupportedDealBody
                      dealType={calc.dealType}
                      deal={deal}
                      existingSettlement={settlement ?? null}
                      grossSoFar={grossSoFar}
                      totalFees={totalFees}
                      totalExpenses={totalExpenses}
                      ticketCount={totalTickets}
                      expenseRowCount={expenses.length}
                    />
                  )}
                </SettlementWorksheetCard>
              )}

              {calc?.supported && calc.bonusesNotTriggered.length > 0 && (
                <CollapsibleCard
                  title="Bonuses not triggered"
                  description="Structured bonuses on this deal that didn't hit. Shown for transparency — useful when the agent asks 'what about that gross threshold bonus?'"
                  defaultOpen={false}
                >
                  <BonusesNotTriggeredBody calc={calc} />
                </CollapsibleCard>
              )}

              {/* c. Recoups */}
              {recoups.length > 0 && (
                <CollapsibleCard
                  id="recoups"
                  accent={disputedRecoupValue > 0 ? "rose" : undefined}
                  title="Recoups"
                  description="Venue costs taken off the top before artist payment. Often the disputed line items."
                  badge={
                    <PlainBadge
                      variant={disputedRecoupValue > 0 ? "rose" : "default"}
                    >
                      {formatMoney(recoups.reduce((s, r) => s + r.amount, 0))}{" "}
                      total
                    </PlainBadge>
                  }
                  defaultOpen={false}
                >
                  <RecoupsBody recoups={recoups} />
                </CollapsibleCard>
              )}

              {/* d. Sign-off & notes */}
              {settlement && (settlement.signoffText || settlement.notes) && (
                <CollapsibleCard
                  id="signoff"
                  title="Sign-off & notes"
                  description="Captured signoff blurb plus Mariana's free-text notes."
                  defaultOpen={false}
                >
                  <SignoffBody settlement={settlement} />
                </CollapsibleCard>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="eyebrow text-[9px] text-ink-400">{label}</div>
      <div
        className={`text-[18px] font-mono tabular font-semibold mt-0.5 leading-none ${accent ? "text-brand-700" : "text-ink-900"}`}
      >
        {value}
      </div>
    </div>
  );
}

function BonusBadge({ type }: { type: Bonus["type"] }) {
  const labels: Record<Bonus["type"], string> = {
    gross_threshold: "gross",
    sellout: "sellout",
    attendance_threshold: "attend",
    tier_ratchet: "ratchet",
  };
  return (
    <span className="inline-flex shrink-0 items-center px-1.5 py-px rounded text-[9px] font-mono uppercase tracking-wider bg-white ring-1 ring-brand-200/50 text-brand-800">
      {labels[type]}
    </span>
  );
}

function ReviewChip({
  showId,
  review,
}: {
  showId: string;
  review: ReturnType<typeof parseReviewState>;
}) {
  if (!review) {
    return (
      <Link
        href={`/shows/${showId}/settle/review`}
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11.5px] font-medium ring-1 ring-inset bg-white text-ink-700 ring-ink-200/80 hover:bg-ink-50 transition-colors whitespace-nowrap"
      >
        <Send className="h-3 w-3 text-brand-700" />
        Send for review
      </Link>
    );
  }
  const accepted = review.line_items.filter(
    (l) => l.status === "accepted",
  ).length;
  const contested = review.line_items.filter(
    (l) => l.status === "contested",
  ).length;
  const hasContested = contested > 0;

  return (
    <Link
      href={`/shows/${showId}/settle/review`}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11.5px] font-medium ring-1 ring-inset transition-colors whitespace-nowrap ${
        hasContested
          ? "bg-rose-50/60 text-rose-800 ring-rose-200/70 hover:bg-rose-50"
          : "bg-brand-50/60 text-brand-800 ring-brand-200/70 hover:bg-brand-50"
      }`}
    >
      {hasContested ? (
        <AlertOctagon className="h-3 w-3 text-rose-700" />
      ) : (
        <CheckCircle2 className="h-3 w-3 text-brand-700" />
      )}
      Review: {accepted} accepted
      {hasContested && `, ${contested} contested`}
    </Link>
  );
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-5">
      <div className="eyebrow text-[10px] text-ink-500 mb-1.5">{eyebrow}</div>
      <h2
        className="font-display text-[24px] font-medium text-ink-900 leading-tight"
        style={{ letterSpacing: "-0.02em" }}
      >
        {title}
      </h2>
      {subtitle && (
        <p className="text-[13px] text-ink-500 mt-1.5 leading-relaxed max-w-2xl">
          {subtitle}
        </p>
      )}
    </div>
  );
}
