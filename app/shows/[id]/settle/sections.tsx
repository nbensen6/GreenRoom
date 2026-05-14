import {
  Check,
  AlertTriangle,
  Mail,
  Pencil,
  XCircle,
  Wallet,
  TrendingUp,
  FileWarning,
} from "lucide-react";
import { Field } from "@/components/ui/card";
import { PlainBadge } from "@/components/ui/badge";
import type { Settlement, Recoup } from "@/db/schema";
import type { getShowById } from "@/lib/queries";
import { calculateSettlement } from "@/lib/dealMath";
import { formatMoney } from "@/lib/format";

export const RECOUP_LABELS: Record<Recoup["category"], string> = {
  marketing: "Marketing",
  hospitality_overage: "Hospitality overage",
  production_overage: "Production overage",
  prior_advance: "Prior advance",
  damages: "Damages",
  other: "Other",
};

/* -------------------------------------------------------------------------- */
/*  Lifecycle                                                                  */
/* -------------------------------------------------------------------------- */

type Stage = {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  timestamp?: Date | null;
};

export function LifecycleBody({
  settlement,
  disputedRecoups,
}: {
  settlement: Settlement;
  disputedRecoups: number;
}) {
  if (settlement.status === "voided") {
    return (
      <div className="flex items-center gap-3">
        <XCircle className="h-4 w-4 text-ink-400" />
        <div>
          <div className="text-[13px] font-medium text-ink-900">
            Settlement voided
          </div>
          <div className="text-[11.5px] text-ink-400 mt-0.5">
            The show was cancelled or the settlement was scrapped.
          </div>
        </div>
      </div>
    );
  }

  const stages: Stage[] = [
    {
      key: "draft",
      label: "Drafted",
      icon: Pencil,
      timestamp: settlement.draftedAt,
    },
    {
      key: "submitted",
      label: "Submitted",
      icon: Mail,
      timestamp: settlement.submittedAt,
    },
    {
      key: "review",
      label: "Reviewed",
      icon: TrendingUp,
      timestamp: settlement.reviewStartedAt,
    },
    {
      key: "signed",
      label: settlement.disputedAt ? "Finalized" : "Signed",
      icon: Check,
      timestamp: settlement.finalizedAt ?? settlement.signedAt,
    },
    {
      key: "paid",
      label: "Paid",
      icon: Wallet,
      timestamp: settlement.paidAt,
    },
  ];

  const currentIndex = (() => {
    switch (settlement.status) {
      case "draft":
        return 0;
      case "submitted":
        return 1;
      case "in_review":
        return 2;
      case "disputed":
      case "signed":
      case "revised":
      case "finalized":
        return 3;
      case "paid":
        return 4;
      default:
        return 0;
    }
  })();

  const isDisputed =
    settlement.status === "disputed" ||
    settlement.status === "revised" ||
    !!settlement.disputedAt;

  return (
    <div>
      {isDisputed && (
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-rose-700 mb-4">
          <AlertTriangle className="h-3 w-3" />
          {settlement.status === "disputed"
            ? "In dispute"
            : settlement.status === "revised"
              ? "Revision sent"
              : "Resolved after dispute"}
          {disputedRecoups > 0 && (
            <span className="text-rose-600">
              · {disputedRecoups} disputed recoup
              {disputedRecoups === 1 ? "" : "s"}
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-5 gap-1 relative">
        <div className="absolute top-3.5 left-[10%] right-[10%] h-px bg-ink-200/60" />

        {stages.map((stage, i) => {
          const isComplete = i < currentIndex;
          const isCurrent = i === currentIndex;
          const isFuture = i > currentIndex;
          const Icon = stage.icon;

          const stageDot = (() => {
            if (isComplete) {
              return "bg-brand-700 ring-brand-700 text-white";
            }
            if (isCurrent) {
              return isDisputed
                ? "bg-rose-50 ring-rose-500 text-rose-700"
                : "bg-brand-50 ring-brand-700 text-brand-700";
            }
            return "bg-white ring-ink-200/80 text-ink-300";
          })();

          return (
            <div
              key={stage.key}
              className="flex flex-col items-center text-center"
            >
              <div
                className={`relative z-10 w-7 h-7 rounded-full ring-2 flex items-center justify-center ${stageDot}`}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div
                className={`mt-2.5 text-[11px] font-medium leading-tight ${
                  isFuture ? "text-ink-300" : "text-ink-900"
                }`}
              >
                {stage.label}
              </div>
              <div className="text-[10px] text-ink-400 mt-0.5 font-mono tabular leading-tight min-h-[12px]">
                {stage.timestamp
                  ? new Date(stage.timestamp).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  : ""}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Worksheet (supported)                                                      */
/* -------------------------------------------------------------------------- */

export function WorksheetHero({
  calc,
  existingSettlement,
}: {
  calc: Extract<ReturnType<typeof calculateSettlement>, { supported: true }>;
  existingSettlement: NonNullable<
    Awaited<ReturnType<typeof getShowById>>
  >["settlement"];
}) {
  return (
    <div className="text-center py-8">
      <div className="eyebrow text-[10px] text-ink-400 mb-3">
        Total to artist
      </div>
      <div
        className="text-[72px] font-mono tabular font-bold text-ink-900 leading-none"
        style={{ letterSpacing: "-0.03em" }}
      >
        {formatMoney(calc.totalToArtist)}
      </div>
      {existingSettlement && (
        <div className="mt-3">
          {existingSettlement.status === "paid" ? (
            <PlainBadge variant="brand">Paid</PlainBadge>
          ) : existingSettlement.status === "signed" ||
            existingSettlement.status === "finalized" ? (
            <PlainBadge variant="brand">Signed</PlainBadge>
          ) : existingSettlement.status === "disputed" ? (
            <PlainBadge variant="rose">Disputed</PlainBadge>
          ) : null}
        </div>
      )}
      {existingSettlement?.totalToArtist != null &&
        existingSettlement.totalToArtist !== calc.totalToArtist && (
          <div className="text-[12px] text-ink-400 mt-2">
            Originally settled at{" "}
            <span className="font-mono tabular text-ink-600">
              {formatMoney(existingSettlement.totalToArtist)}
            </span>
          </div>
        )}
    </div>
  );
}

export function WorksheetBody({
  calc,
}: {
  calc: Extract<ReturnType<typeof calculateSettlement>, { supported: true }>;
}) {
  return (
    <div className="divide-y divide-ink-100/80">
      <Row label="Gross box office" value={formatMoney(calc.grossBoxOffice)} />
      <Row label="Net box office" value={formatMoney(calc.netBoxOffice)} />
      <Row
        label="Total expenses (passed through)"
        value={formatMoney(calc.totalExpenses)}
      />
      <div className="pt-3" />
      {calc.steps.map((step, i) => (
        <Row
          key={i}
          label={step.label}
          value={formatMoney(step.value)}
          note={step.note}
        />
      ))}
      <div className="pt-3" />
      <div className="flex items-baseline justify-between py-3 font-semibold">
        <span className="text-[13px] text-ink-900">Total to artist</span>
        <span className="text-[18px] font-mono tabular text-ink-900">
          {formatMoney(calc.totalToArtist)}
        </span>
      </div>
    </div>
  );
}

export function BonusesNotTriggeredBody({
  calc,
}: {
  calc: Extract<ReturnType<typeof calculateSettlement>, { supported: true }>;
}) {
  return (
    <div className="divide-y divide-ink-100/80">
      {calc.bonusesNotTriggered.map((b, i) => (
        <div
          key={i}
          className="py-3 flex items-baseline justify-between gap-4"
        >
          <div className="min-w-0">
            <div className="text-[13px] text-ink-600">{b.label}</div>
            <div className="text-[11.5px] text-ink-400 mt-0.5">{b.reason}</div>
          </div>
          <div className="text-[12.5px] text-ink-300 font-mono tabular line-through">
            {formatMoney(b.amount)}
          </div>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Worksheet (unsupported)                                                    */
/* -------------------------------------------------------------------------- */

export function UnsupportedDealBody({
  dealType,
  deal,
  existingSettlement,
  grossSoFar,
  totalFees,
  totalExpenses,
  ticketCount,
  expenseRowCount,
}: {
  dealType: string;
  deal: NonNullable<Awaited<ReturnType<typeof getShowById>>>["deal"];
  existingSettlement: NonNullable<
    Awaited<ReturnType<typeof getShowById>>
  >["settlement"];
  grossSoFar: number;
  totalFees: number;
  totalExpenses: number;
  ticketCount: number;
  expenseRowCount: number;
}) {
  const friendly: Record<string, string> = {
    flat: "flat guarantee",
    percentage_of_gross: "percentage of gross",
    percentage_of_net: "percentage of net",
    vs: "vs deal",
    door: "door deal",
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg ring-1 ring-amber-200/60 bg-amber-50/40 px-5 py-6 text-center">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-100/80 ring-1 ring-amber-200/80 mb-3">
          <FileWarning className="h-4 w-4 text-amber-700" />
        </div>
        <h4
          className="font-display text-[18px] font-medium text-ink-900 mb-1"
          style={{ letterSpacing: "-0.02em" }}
        >
          The in-app tool can&apos;t settle a {friendly[dealType] ?? dealType}{" "}
          yet.
        </h4>
        <p className="text-[12.5px] text-ink-500 max-w-md mx-auto leading-relaxed">
          Mariana would do this on a Google Sheet at 2am tonight. The inputs are
          below — but the math doesn&apos;t happen here.
        </p>
      </div>

      <div>
        <div className="eyebrow text-[10px] text-ink-500 mb-3">
          Inputs the system has
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <Field
            label="Gross box office"
            mono
            value={formatMoney(grossSoFar)}
          />
          <Field label="Fees" mono value={formatMoney(totalFees)} />
          <Field
            label="Net box office"
            mono
            value={formatMoney(grossSoFar - totalFees)}
          />
        </div>
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-5">
          <Field label="Tickets sold" mono value={String(ticketCount)} />
          <Field
            label="Expenses (line items)"
            mono
            value={String(expenseRowCount)}
          />
          <Field
            label="Expenses (passed through)"
            mono
            value={formatMoney(totalExpenses)}
          />
        </div>
      </div>

      {deal?.dealNotesFreetext && (
        <div>
          <div className="eyebrow text-[10px] text-ink-500 mb-2">
            Deal notes (free text — what Mariana actually trusts)
          </div>
          <div
            className="text-[12.5px] text-ink-800 bg-canvas-soft rounded-lg p-4 ring-1 ring-ink-200/60 leading-relaxed font-[450]"
            style={{ fontStyle: "italic" }}
          >
            {deal.dealNotesFreetext}
          </div>
        </div>
      )}

      {existingSettlement?.totalToArtist != null && (
        <div className="rounded-lg ring-1 ring-brand-200/60 bg-brand-50/30 p-5">
          <div className="flex items-center justify-between mb-1">
            <div className="eyebrow text-[10px] text-brand-800">
              Actually settled (off-platform)
            </div>
            {existingSettlement.status === "disputed" ? (
              <PlainBadge variant="rose">Disputed</PlainBadge>
            ) : (
              <PlainBadge variant="brand">Signed</PlainBadge>
            )}
          </div>
          <p className="text-[12px] text-ink-600 mb-3">
            Mariana ran this in a spreadsheet. Here&apos;s the result that was
            logged back into Greenroom afterward.
          </p>
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] text-ink-600">Total to artist</span>
            <span
              className="text-[28px] font-mono tabular font-semibold text-ink-900"
              style={{ letterSpacing: "-0.02em" }}
            >
              {formatMoney(existingSettlement.totalToArtist)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Recoups                                                                    */
/* -------------------------------------------------------------------------- */

export function RecoupsBody({ recoups }: { recoups: Recoup[] }) {
  return (
    <div className="divide-y divide-ink-100/80">
      {recoups.map((r) => (
        <div
          key={r.id}
          className="py-3.5 grid grid-cols-[1fr_auto_auto] items-center gap-3"
        >
          <div className="min-w-0">
            <div className="text-[13px] text-ink-900 leading-tight">
              {r.label}
            </div>
            <div className="text-[11.5px] text-ink-400 mt-0.5">
              {RECOUP_LABELS[r.category]}
            </div>
          </div>
          <div>
            {r.status === "disputed" ? (
              <PlainBadge variant="rose">Disputed</PlainBadge>
            ) : r.status === "withdrawn" ? (
              <PlainBadge variant="default">Withdrawn</PlainBadge>
            ) : (
              <PlainBadge variant="brand">Agreed</PlainBadge>
            )}
          </div>
          <div className="text-[13.5px] font-mono tabular text-ink-900 text-right min-w-[80px]">
            {formatMoney(r.amount)}
          </div>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sign-off / notes                                                           */
/* -------------------------------------------------------------------------- */

export function SignoffBody({ settlement }: { settlement: Settlement }) {
  return (
    <div className="space-y-5">
      {settlement.signoffText && (
        <div>
          <div className="eyebrow text-[10px] text-ink-500 mb-2">
            From the artist team
          </div>
          <div className="text-[13px] text-ink-800 bg-canvas-soft rounded-lg p-4 ring-1 ring-ink-200/60 leading-relaxed">
            &ldquo;{settlement.signoffText}&rdquo;
          </div>
        </div>
      )}
      {settlement.notes && (
        <div>
          <div className="eyebrow text-[10px] text-ink-500 mb-2">
            Mariana&apos;s settlement notes
          </div>
          <div className="text-[12.5px] text-ink-800 bg-canvas-soft rounded-lg p-4 ring-1 ring-ink-200/60 leading-relaxed">
            {settlement.notes}
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function Row({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="flex items-baseline justify-between py-2.5">
      <div>
        <div className="text-[13px] text-ink-600">{label}</div>
        {note && (
          <div className="text-[11.5px] text-ink-400 mt-0.5 max-w-md leading-snug">
            {note}
          </div>
        )}
      </div>
      <div className="text-[13.5px] text-ink-900 font-mono tabular">
        {value}
      </div>
    </div>
  );
}
