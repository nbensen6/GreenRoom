"use client";

import { useState } from "react";
import {
  Sparkles,
  AlertTriangle,
  Info,
  AlertOctagon,
  Loader2,
  ArrowRight,
  Clipboard,
  ClipboardCheck,
  Mail,
  Wrench,
  FileSpreadsheet,
  ExternalLink,
} from "lucide-react";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { Button } from "@/components/ui/button";
import { WorksheetAdjustments } from "./worksheet-adjustments";
import type { WorksheetAdjustment } from "@/lib/settlement-adjustments";

type Severity = "info" | "warning" | "contradiction";
type Confidence = "high" | "medium" | "low";
type Location = "greenroom" | "spreadsheet" | "email" | "eng-ticket";

type Flag = {
  severity: Severity;
  type: string;
  evidence: string;
  explanation: string;
};

type ActionStep = {
  description: string;
  location: Location;
  anchor: string | null;
};

type Analysis = {
  bottom_line: string;
  plain_english_status: string;
  confidence: Confidence;
  flags: Flag[];
  recommended_action: { summary: string; steps: ActionStep[] } | null;
};

type ApiResponse = {
  analysis: Analysis;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens: number;
    cache_creation_input_tokens: number;
  };
};

const SEVERITY_STYLES: Record<
  Severity,
  { badge: string; icon: typeof Info }
> = {
  info: { badge: "bg-sky-50 text-sky-800 ring-sky-200/80", icon: Info },
  warning: {
    badge: "bg-amber-50 text-amber-800 ring-amber-200/80",
    icon: AlertTriangle,
  },
  contradiction: {
    badge: "bg-rose-50 text-rose-800 ring-rose-200/80",
    icon: AlertOctagon,
  },
};

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
};

const LOCATION_META: Record<
  Location,
  {
    groupHeading: string;
    audience: string;
    icon: typeof Info;
    badge: string;
  }
> = {
  greenroom: {
    groupHeading: "Inside Greenroom",
    audience: "Mariana — click around to verify before any structural change",
    icon: ExternalLink,
    badge: "bg-brand-50 text-brand-800 ring-brand-200/70",
  },
  spreadsheet: {
    groupHeading: "In your spreadsheet",
    audience: "Mariana — your settlement spreadsheet",
    icon: FileSpreadsheet,
    badge: "bg-emerald-50 text-emerald-800 ring-emerald-200/70",
  },
  email: {
    groupHeading: "Email follow-up",
    audience: "the agent / tour manager / management",
    icon: Mail,
    badge: "bg-sky-50 text-sky-800 ring-sky-200/70",
  },
  "eng-ticket": {
    groupHeading: "For engineering",
    audience:
      "the eng team — file as a ticket in Linear or post in #settlement-ops",
    icon: Wrench,
    badge: "bg-amber-50 text-amber-800 ring-amber-200/70",
  },
};

const LOCATION_ORDER: Location[] = [
  "eng-ticket",
  "email",
  "spreadsheet",
  "greenroom",
];

function buildHandoffMarkdown(showId: string, analysis: Analysis): string {
  const lines: string[] = [];
  lines.push(`# Settlement update — ${showId}`);
  lines.push("");
  lines.push(`**Bottom line:** ${analysis.bottom_line}`);
  lines.push("");
  lines.push(`**Detail:** ${analysis.plain_english_status}`);
  lines.push("");

  if (analysis.flags.length > 0) {
    lines.push("## Findings");
    for (const f of analysis.flags) {
      lines.push(
        `- **[${f.severity.toUpperCase()}]** ${f.type} — ${f.explanation}`,
      );
      lines.push(`  > ${f.evidence}`);
    }
    lines.push("");
  }

  if (analysis.recommended_action) {
    lines.push(`**Plan:** ${analysis.recommended_action.summary}`);
    lines.push("");
    const groups: Record<Location, ActionStep[]> = {
      greenroom: [],
      spreadsheet: [],
      email: [],
      "eng-ticket": [],
    };
    for (const step of analysis.recommended_action.steps) {
      groups[step.location].push(step);
    }
    for (const loc of LOCATION_ORDER) {
      const stepsForLoc = groups[loc];
      if (stepsForLoc.length === 0) continue;
      const meta = LOCATION_META[loc];
      lines.push(`## ${meta.groupHeading}`);
      lines.push(`_Audience: ${meta.audience}_`);
      lines.push("");
      for (const step of stepsForLoc) {
        lines.push(`- [ ] ${step.description}`);
      }
      lines.push("");
    }
  }
  return lines.join("\n");
}

export function SettlementWorksheetCard({
  showId,
  title,
  description,
  accent,
  defaultOpen = true,
  canAnalyze,
  reviewChip,
  adjustments,
  baseTotal,
  children,
}: {
  showId: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  accent?: "brand" | "amber" | "rose" | "sky";
  defaultOpen?: boolean;
  /** If false, hides the Analyze chip (e.g., when there's no settlement yet). */
  canAnalyze: boolean;
  /** Optional second chip rendered next to "Analyze with AI" (e.g. Send-for-review). */
  reviewChip?: React.ReactNode;
  /** Manual worksheet adjustments — rendered as a collapsible at the bottom. */
  adjustments?: WorksheetAdjustment[];
  /** Pre-adjustment payout used by the adjustments section to show the adjusted total. */
  baseTotal?: number;
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function runAnalysis() {
    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      const res = await fetch(`/api/settle/${showId}/analyze`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setResult(data as ApiResponse);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function copyHandoff() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(
        buildHandoffMarkdown(showId, result.analysis),
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Couldn't access clipboard — copy manually.");
    }
  }

  const analysis = result?.analysis;
  const hasContradictions =
    analysis?.flags.some((f) => f.severity === "contradiction") ?? false;

  const analyzeChip = canAnalyze && (
    <button
      type="button"
      onClick={runAnalysis}
      disabled={loading}
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11.5px] font-medium ring-1 ring-inset bg-white text-ink-700 ring-ink-200/80 hover:bg-ink-50 transition-colors whitespace-nowrap disabled:opacity-60"
    >
      {loading ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          Analyzing...
        </>
      ) : (
        <>
          <Sparkles className="h-3 w-3 text-brand-700" />
          {analysis ? "Re-run AI" : "Analyze with AI"}
        </>
      )}
    </button>
  );

  const headerChips =
    analyzeChip || reviewChip ? (
      <div className="flex items-center gap-1.5">
        {analyzeChip}
        {reviewChip}
      </div>
    ) : undefined;

  return (
    <CollapsibleCard
      id="worksheet"
      title={title}
      description={description}
      accent={hasContradictions ? "rose" : accent}
      headerAction={headerChips}
      defaultOpen={defaultOpen}
    >
      {children}

      {adjustments && baseTotal != null && (
        <WorksheetAdjustments
          showId={showId}
          baseTotal={baseTotal}
          initialAdjustments={adjustments}
        />
      )}

      {error && (
        <div className="mt-5 rounded-lg bg-rose-50/60 ring-1 ring-rose-200/60 p-3 text-[12.5px] text-rose-900">
          <div className="font-medium mb-0.5">Analysis failed</div>
          <div className="text-rose-800">{error}</div>
        </div>
      )}

      {analysis && (
        <div className="mt-6 pt-5 border-t border-ink-200/60 space-y-5">
          <div className="flex items-center gap-1.5 text-[10px] eyebrow text-brand-800">
            <Sparkles className="h-3 w-3 text-brand-700" />
            AI settlement check
            <span className="ml-1 text-ink-300 font-mono normal-case tracking-normal">
              {CONFIDENCE_LABEL[analysis.confidence]}
            </span>
          </div>

          {/* Bottom line */}
          <div className="rounded-lg bg-ink-900/[0.03] ring-1 ring-ink-200/60 p-4">
            <div className="eyebrow text-[10px] text-ink-500 mb-2">
              Bottom line
            </div>
            <div
              className="text-[15px] text-ink-900 leading-relaxed font-medium"
              style={{ letterSpacing: "-0.005em" }}
            >
              {analysis.bottom_line}
            </div>
          </div>

          {/* Detail (collapsible) */}
          <details className="group">
            <summary className="cursor-pointer text-[10px] eyebrow text-ink-500 hover:text-ink-700 inline-flex items-center gap-1 select-none">
              <span className="group-open:rotate-90 transition-transform inline-block">
                ›
              </span>
              More detail
            </summary>
            <div className="text-[13px] text-ink-700 leading-relaxed mt-2 pl-4">
              {analysis.plain_english_status}
            </div>
          </details>

          {/* Findings */}
          {analysis.flags.length > 0 && (
            <div>
              <div className="eyebrow text-[10px] text-ink-500 mb-2">
                Findings ({analysis.flags.length})
              </div>
              <div className="space-y-2.5">
                {analysis.flags.map((flag, i) => {
                  const { badge, icon: Icon } = SEVERITY_STYLES[flag.severity];
                  return (
                    <div
                      key={i}
                      className="rounded-lg ring-1 ring-ink-200/60 bg-canvas-soft/40 p-3.5"
                    >
                      <div className="flex items-start gap-2.5">
                        <div
                          className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ring-1 ring-inset ${badge}`}
                        >
                          <Icon className="h-2.5 w-2.5" />
                          {flag.severity}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[12.5px] font-semibold text-ink-900 leading-snug">
                            {flag.type}
                          </div>
                          <div className="text-[12px] text-ink-700 mt-1.5 leading-relaxed">
                            {flag.explanation}
                          </div>
                          <div className="text-[11.5px] text-ink-500 mt-2 leading-relaxed font-mono bg-white/60 rounded px-2 py-1.5 ring-1 ring-ink-100/80">
                            {flag.evidence}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {analysis.flags.length === 0 && (
            <div className="text-[12.5px] text-ink-500 italic">
              No contradictions found. Structured status matches the prose
              evidence.
            </div>
          )}

          {/* Recommended action */}
          {analysis.recommended_action && (
            <div className="rounded-lg bg-brand-50/40 ring-1 ring-brand-200/50 p-4">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-start gap-2.5 min-w-0">
                  <ArrowRight className="h-3.5 w-3.5 text-brand-700 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="eyebrow text-[10px] text-brand-800 mb-1">
                      Plan to close this out
                    </div>
                    <div className="text-[12.5px] text-ink-800 leading-relaxed">
                      {analysis.recommended_action.summary}
                    </div>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={copyHandoff}
                  className="shrink-0 whitespace-nowrap"
                >
                  {copied ? (
                    <>
                      <ClipboardCheck className="h-3.5 w-3.5" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Clipboard className="h-3.5 w-3.5" />
                      Copy checklist
                    </>
                  )}
                </Button>
              </div>

              <div className="space-y-3.5">
                {LOCATION_ORDER.map((loc) => {
                  const stepsForLoc =
                    analysis.recommended_action!.steps.filter(
                      (s) => s.location === loc,
                    );
                  if (stepsForLoc.length === 0) return null;
                  const meta = LOCATION_META[loc];
                  const HeadIcon = meta.icon;
                  return (
                    <div key={loc}>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-medium uppercase tracking-wider ring-1 ring-inset ${meta.badge}`}
                        >
                          <HeadIcon className="h-2.5 w-2.5" />
                          {meta.groupHeading}
                        </span>
                        <span className="text-[10.5px] text-ink-400 leading-tight">
                          {meta.audience}
                        </span>
                      </div>
                      <ul className="space-y-1.5 pl-3 border-l-2 border-brand-200/50">
                        {stepsForLoc.map((step, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="mt-1.5 h-1 w-1 rounded-full bg-ink-400 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="text-[12.5px] text-ink-800 leading-relaxed">
                                {step.description}
                              </div>
                              {step.anchor && (
                                <a
                                  href={step.anchor}
                                  className="text-[10.5px] text-brand-700 hover:text-brand-800 hover:underline inline-flex items-center gap-0.5 font-medium mt-0.5"
                                >
                                  Jump to section
                                  <ArrowRight className="h-2.5 w-2.5" />
                                </a>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Token usage */}
          {result && (
            <div className="text-[10px] text-ink-300 font-mono pt-1 border-t border-ink-100/60">
              {result.usage.input_tokens} in · {result.usage.output_tokens} out
              {result.usage.cache_read_input_tokens > 0 && (
                <> · {result.usage.cache_read_input_tokens} cached</>
              )}
            </div>
          )}
        </div>
      )}
    </CollapsibleCard>
  );
}
