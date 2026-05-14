import Link from "next/link";
import {
  Check,
  ChevronRight,
  Sparkles,
  FileSpreadsheet,
  Eye,
  PenLine,
  Wallet,
  Calendar,
} from "lucide-react";
import type { getShowById } from "@/lib/queries";
import { parseReviewState } from "@/lib/settlement-review";
import { cn } from "@/lib/utils";

type StepStatus = "done" | "current" | "upcoming";

type Step = {
  key: string;
  label: string;
  status: StepStatus;
  href: string | null;
  icon: typeof Check;
  /** One-line description shown only for the current step. */
  whatsNext?: string;
};

function computeSteps(
  data: NonNullable<Awaited<ReturnType<typeof getShowById>>>,
): Step[] {
  const { show, deal, settlement } = data;

  const showDate = new Date(show.date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const showHappened = showDate < today;

  const dealLocked =
    !!deal && (deal.guaranteeAmount != null || deal.percentage != null);

  const settlementDrafted =
    !!settlement &&
    (settlement.totalToArtist != null ||
      (settlement.status && settlement.status !== "draft"));

  const review = parseReviewState(settlement?.reviewJson ?? null);
  const reviewSent = !!review;

  const signed =
    !!settlement &&
    (settlement.signedAt != null ||
      ["signed", "finalized", "paid"].includes(settlement.status ?? ""));

  const paid = !!settlement?.paidAt;

  const statuses: Record<string, boolean> = {
    deal: dealLocked,
    show: showHappened,
    drafted: settlementDrafted,
    review: reviewSent,
    signed,
    paid,
  };

  // First step that isn't done becomes "current".
  const order = ["deal", "show", "drafted", "review", "signed", "paid"];
  const firstUndone = order.find((k) => !statuses[k]) ?? null;

  function status(key: string): StepStatus {
    if (statuses[key]) return "done";
    if (key === firstUndone) return "current";
    return "upcoming";
  }

  return [
    {
      key: "deal",
      label: "Deal locked in",
      status: status("deal"),
      href: `/deals/analyze?showId=${show.id}`,
      icon: Sparkles,
      whatsNext: "Paste the agent email into the AI deal parser to lock terms.",
    },
    {
      key: "show",
      label: "Show happened",
      status: status("show"),
      href: null,
      icon: Calendar,
      whatsNext: "Waiting on show date.",
    },
    {
      key: "drafted",
      label: "Settlement drafted",
      status: status("drafted"),
      href: `#worksheet`,
      icon: FileSpreadsheet,
      whatsNext: "Open the worksheet below to reconcile totals and recoups.",
    },
    {
      key: "review",
      label: "Sent for review",
      status: status("review"),
      href: `/shows/${show.id}/settle/review`,
      icon: Eye,
      whatsNext: "Send the settlement to the artist team for line-by-line sign-off.",
    },
    {
      key: "signed",
      label: "Signed",
      status: status("signed"),
      href: `#signoff`,
      icon: PenLine,
      whatsNext: "Capture sign-off below once review comes back clean.",
    },
    {
      key: "paid",
      label: "Paid",
      status: status("paid"),
      href: `#settlement`,
      icon: Wallet,
      whatsNext: "Mark paid when funds clear (or chase via the email composer).",
    },
  ];
}

const STATUS_STYLES: Record<
  StepStatus,
  { pill: string; iconWrap: string; label: string }
> = {
  done: {
    pill:
      "bg-brand-600 text-white ring-1 ring-inset ring-brand-700/40 hover:bg-brand-700",
    iconWrap: "text-white/90",
    label: "text-white",
  },
  current: {
    pill:
      "bg-white text-brand-800 ring-2 ring-brand-500 shadow-sm hover:bg-brand-50/40",
    iconWrap: "text-brand-700",
    label: "text-brand-900 font-semibold",
  },
  upcoming: {
    pill:
      "bg-ink-50 text-ink-400 ring-1 ring-inset ring-ink-200/70",
    iconWrap: "text-ink-300",
    label: "text-ink-500",
  },
};

export function ShowPipeline({
  data,
}: {
  data: NonNullable<Awaited<ReturnType<typeof getShowById>>>;
}) {
  const steps = computeSteps(data);
  const currentStep = steps.find((s) => s.status === "current");

  return (
    <div className="mt-1 mb-7 rounded-xl bg-canvas-soft/60 ring-1 ring-ink-200/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="eyebrow text-[10px] text-ink-500">
          Settlement workflow
        </div>
        {currentStep && (
          <div className="text-[11.5px] text-ink-500">
            Next:{" "}
            <span className="text-brand-800 font-medium">
              {currentStep.label}
            </span>
          </div>
        )}
      </div>

      <ol className="flex flex-wrap items-center gap-y-2">
        {steps.map((step, i) => {
          const style = STATUS_STYLES[step.status];
          const Icon = step.status === "done" ? Check : step.icon;
          const isLast = i === steps.length - 1;

          const pillInner = (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors",
                style.pill,
              )}
            >
              <Icon className={cn("h-3 w-3", style.iconWrap)} />
              <span className={style.label}>{step.label}</span>
            </span>
          );

          return (
            <li key={step.key} className="flex items-center">
              {step.href && step.status !== "upcoming" ? (
                <Link href={step.href}>{pillInner}</Link>
              ) : (
                pillInner
              )}
              {!isLast && (
                <ChevronRight className="h-3.5 w-3.5 text-ink-300 mx-1" />
              )}
            </li>
          );
        })}
      </ol>

      {currentStep?.whatsNext && (
        <div className="mt-3 flex items-start gap-2 text-[12px] text-ink-600 pl-0.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-500 mt-1.5 shrink-0" />
          <span>
            <span className="text-ink-800 font-medium">
              {currentStep.label}.
            </span>{" "}
            {currentStep.whatsNext}
            {currentStep.href && (
              <>
                {" "}
                <Link
                  href={currentStep.href}
                  className="text-brand-700 hover:text-brand-900 underline underline-offset-2 decoration-brand-300 hover:decoration-brand-700"
                >
                  Go there
                </Link>
                .
              </>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
