"use client";

import { useState, useMemo } from "react";
import {
  Sparkles,
  Loader2,
  AlertOctagon,
  Check,
  Info,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Field } from "@/components/ui/card";
import { PlainBadge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/format";

type ArtistImpact = "more_to_artist" | "less_to_artist" | "neutral";

type Interpretation = {
  key: string;
  label: string;
  explanation: string;
  artist_impact: ArtistImpact;
};

type Ambiguity = {
  id: string;
  question: string;
  evidence_quote: string;
  why_it_matters: string;
  interpretations: Interpretation[];
  default_recommendation: string | null;
};

type Bonus = {
  type: "gross_threshold" | "sellout" | "attendance_threshold" | "tier_ratchet";
  label: string;
  amount: number | null;
  threshold: number | null;
};

type Recoup = {
  category:
    | "marketing"
    | "hospitality_overage"
    | "production_overage"
    | "prior_advance"
    | "damages"
    | "other";
  label: string;
  amount: number;
};

type Extracted = {
  deal_type: "flat" | "percentage_of_gross" | "percentage_of_net" | "vs" | "door" | null;
  guarantee_amount: number | null;
  percentage: number | null;
  percentage_basis: "gross" | "net" | null;
  expense_cap: number | null;
  hospitality_cap: number | null;
  bonuses: Bonus[];
  recoups: Recoup[];
};

type Analysis = {
  summary: string;
  extracted: Extracted;
  ambiguities: Ambiguity[];
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

const IMPACT_META: Record<ArtistImpact, { icon: typeof Info; color: string; label: string }> = {
  more_to_artist: { icon: TrendingUp, color: "text-brand-700", label: "More to artist" },
  less_to_artist: { icon: TrendingDown, color: "text-rose-700", label: "Less to artist" },
  neutral: { icon: Minus, color: "text-ink-500", label: "Neutral" },
};

const DEAL_TYPE_LABEL: Record<NonNullable<Extracted["deal_type"]>, string> = {
  flat: "Flat guarantee",
  percentage_of_gross: "Percentage of gross",
  percentage_of_net: "Percentage of net",
  vs: "Vs (guarantee or %)",
  door: "Door split",
};

export function DealAnalyzer({ initialText }: { initialText: string }) {
  const [dealText, setDealText] = useState(initialText);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Record<string, string>>({});

  async function analyze() {
    if (!dealText.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setDecisions({});
    try {
      const res = await fetch("/api/deals/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deal_text: dealText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      const apiResp = data as ApiResponse;
      setResult(apiResp);

      // Pre-select default recommendations for each ambiguity
      const initial: Record<string, string> = {};
      for (const a of apiResp.analysis.ambiguities) {
        if (a.default_recommendation) {
          initial[a.id] = a.default_recommendation;
        }
      }
      setDecisions(initial);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function setDecision(ambiguityId: string, interpretationKey: string) {
    setDecisions((prev) => ({ ...prev, [ambiguityId]: interpretationKey }));
  }

  const analysis = result?.analysis;
  const allResolved = useMemo(() => {
    if (!analysis) return false;
    return analysis.ambiguities.every((a) => decisions[a.id]);
  }, [analysis, decisions]);

  const resolvedDecisions = useMemo(() => {
    if (!analysis) return [];
    return analysis.ambiguities.map((a) => {
      const chosenKey = decisions[a.id];
      const chosen = a.interpretations.find((i) => i.key === chosenKey);
      return { ambiguity: a, chosen };
    });
  }, [analysis, decisions]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Deal email / deal notes</CardTitle>
            <CardDescription>
              Paste the raw prose. Don&apos;t pre-translate it into structured fields — the analyzer does that.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 py-4">
          <textarea
            value={dealText}
            onChange={(e) => setDealText(e.target.value)}
            placeholder="e.g., $5,000 vs 80% of net after expenses, whichever greater. Expenses capped $2,500. Marketing recoup of $900 against gross..."
            className="w-full rounded-md border border-ink-200 bg-white text-[13px] text-ink-900 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400 font-mono leading-relaxed"
            rows={6}
          />
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11.5px] text-ink-400">
              {dealText.length} characters
            </div>
            <Button
              variant="brand"
              onClick={analyze}
              disabled={loading || !dealText.trim()}
              className="shrink-0 whitespace-nowrap"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Analyze deal
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-lg bg-rose-50/60 ring-1 ring-rose-200/60 p-3 text-[12.5px] text-rose-900">
          <div className="font-medium mb-0.5">Analysis failed</div>
          <div className="text-rose-800">{error}</div>
        </div>
      )}

      {analysis && (
        <>
          {/* Summary */}
          <Card accent="brand">
            <CardContent className="py-5">
              <div className="eyebrow text-[10px] text-brand-800 mb-2">
                What this deal looks like
              </div>
              <div className="text-[14.5px] text-ink-900 leading-relaxed">
                {analysis.summary}
              </div>
            </CardContent>
          </Card>

          {/* Extracted fields */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Extracted structured fields</CardTitle>
                <CardDescription>
                  What can be saved to Greenroom&apos;s structured deal record once ambiguities are resolved.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="py-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-5">
                <Field
                  label="Deal type"
                  value={
                    analysis.extracted.deal_type
                      ? DEAL_TYPE_LABEL[analysis.extracted.deal_type]
                      : "—"
                  }
                />
                <Field
                  label="Guarantee"
                  mono
                  value={
                    analysis.extracted.guarantee_amount != null
                      ? formatMoney(analysis.extracted.guarantee_amount)
                      : "—"
                  }
                />
                <Field
                  label="Percentage"
                  mono
                  value={
                    analysis.extracted.percentage != null
                      ? `${(analysis.extracted.percentage * 100).toFixed(0)}% ${analysis.extracted.percentage_basis ? `of ${analysis.extracted.percentage_basis}` : ""}`
                      : "—"
                  }
                />
                <Field
                  label="Expense cap"
                  mono
                  value={
                    analysis.extracted.expense_cap != null
                      ? formatMoney(analysis.extracted.expense_cap)
                      : "—"
                  }
                />
                <Field
                  label="Hospitality cap"
                  mono
                  value={
                    analysis.extracted.hospitality_cap != null
                      ? formatMoney(analysis.extracted.hospitality_cap)
                      : "—"
                  }
                />
                <Field
                  label="Recoups"
                  mono
                  value={String(analysis.extracted.recoups.length)}
                />
              </div>

              {analysis.extracted.bonuses.length > 0 && (
                <div className="mt-4">
                  <div className="eyebrow text-[10px] text-ink-500 mb-2">
                    Bonuses ({analysis.extracted.bonuses.length})
                  </div>
                  <ul className="space-y-1.5">
                    {analysis.extracted.bonuses.map((b, i) => (
                      <li key={i} className="text-[12.5px] text-ink-700 flex items-start gap-2">
                        <span className="mt-1.5 h-1 w-1 rounded-full bg-ink-400 shrink-0" />
                        <span>
                          {b.label}{" "}
                          <span className="text-ink-400 font-mono ml-1">
                            ({b.type}
                            {b.threshold ? ` · threshold ${formatMoney(b.threshold)}` : ""}
                            {b.amount ? ` · ${formatMoney(b.amount)}` : ""})
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {analysis.extracted.recoups.length > 0 && (
                <div className="mt-4">
                  <div className="eyebrow text-[10px] text-ink-500 mb-2">
                    Recoups ({analysis.extracted.recoups.length})
                  </div>
                  <ul className="space-y-1.5">
                    {analysis.extracted.recoups.map((r, i) => (
                      <li key={i} className="text-[12.5px] text-ink-700 flex items-start gap-2">
                        <span className="mt-1.5 h-1 w-1 rounded-full bg-ink-400 shrink-0" />
                        <span>
                          <span className="font-medium">{r.label}</span>{" "}
                          <span className="text-ink-400">· {r.category} ·</span>{" "}
                          <span className="font-mono">{formatMoney(r.amount)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Ambiguities */}
          {analysis.ambiguities.length > 0 ? (
            <Card accent="amber">
              <CardHeader>
                <div>
                  <CardTitle className="flex items-center gap-1.5">
                    <AlertOctagon className="h-3.5 w-3.5 text-amber-700" />
                    Ambiguities to resolve ({analysis.ambiguities.length})
                  </CardTitle>
                  <CardDescription>
                    Each of these has two valid reads of the prose. Pick the one that matches the actual deal intent — the agent should confirm by email if you&apos;re unsure.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="divide-y divide-ink-100/80 py-2">
                {analysis.ambiguities.map((a) => {
                  const selected = decisions[a.id];
                  return (
                    <div key={a.id} className="py-4">
                      <div className="text-[13.5px] font-semibold text-ink-900 mb-2 leading-snug">
                        {a.question}
                      </div>
                      <div className="text-[11.5px] text-ink-500 font-mono bg-canvas-soft/60 rounded px-2.5 py-1.5 ring-1 ring-ink-200/40 mb-2 leading-relaxed">
                        &ldquo;{a.evidence_quote}&rdquo;
                      </div>
                      <div className="text-[12px] text-ink-600 mb-3 leading-relaxed">
                        <span className="font-medium">Why it matters:</span>{" "}
                        {a.why_it_matters}
                      </div>
                      <div className="space-y-2">
                        {a.interpretations.map((opt) => {
                          const impact = IMPACT_META[opt.artist_impact];
                          const ImpactIcon = impact.icon;
                          const isSelected = selected === opt.key;
                          const isDefault = a.default_recommendation === opt.key;
                          return (
                            <button
                              key={opt.key}
                              type="button"
                              onClick={() => setDecision(a.id, opt.key)}
                              className={`w-full text-left rounded-lg ring-1 ring-inset p-3 transition-colors ${
                                isSelected
                                  ? "bg-brand-50/60 ring-brand-300"
                                  : "bg-white ring-ink-200/60 hover:bg-ink-50/40"
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div
                                  className={`mt-0.5 h-3.5 w-3.5 rounded-full ring-2 shrink-0 ${
                                    isSelected
                                      ? "bg-brand-700 ring-brand-700"
                                      : "bg-white ring-ink-300"
                                  }`}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[13px] font-medium text-ink-900">
                                      {opt.label}
                                    </span>
                                    {isDefault && (
                                      <PlainBadge variant="default">
                                        Industry default
                                      </PlainBadge>
                                    )}
                                    <span
                                      className={`inline-flex items-center gap-1 text-[10.5px] font-medium ${impact.color}`}
                                    >
                                      <ImpactIcon className="h-3 w-3" />
                                      {impact.label}
                                    </span>
                                  </div>
                                  <div className="text-[12px] text-ink-600 mt-1 leading-relaxed">
                                    {opt.explanation}
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ) : (
            <Card accent="brand">
              <CardContent className="py-5">
                <div className="flex items-start gap-2.5">
                  <Check className="h-4 w-4 text-brand-700 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-[13px] font-semibold text-ink-900">
                      No ambiguities found
                    </div>
                    <div className="text-[12px] text-ink-600 mt-1 leading-relaxed">
                      The prose is unambiguous. Structured fields above can be saved as-is.
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Resolved-deal preview */}
          {analysis.ambiguities.length > 0 && (
            <Card accent={allResolved ? "brand" : undefined}>
              <CardHeader>
                <div>
                  <CardTitle>Resolved deal record</CardTitle>
                  <CardDescription>
                    {allResolved
                      ? "All ambiguities resolved. This is what gets saved to Greenroom."
                      : "Resolve each ambiguity above to see the final deal record."}
                  </CardDescription>
                </div>
                {allResolved && (
                  <PlainBadge variant="brand">Ready to save</PlainBadge>
                )}
              </CardHeader>
              <CardContent className="py-4">
                {!allResolved ? (
                  <div className="text-[12.5px] text-ink-400 italic">
                    {analysis.ambiguities.length - Object.keys(decisions).length} of{" "}
                    {analysis.ambiguities.length} ambiguities still need a decision.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {resolvedDecisions.map(({ ambiguity, chosen }) => {
                      if (!chosen) return null;
                      const impact = IMPACT_META[chosen.artist_impact];
                      const ImpactIcon = impact.icon;
                      return (
                        <div
                          key={ambiguity.id}
                          className="rounded-lg bg-canvas-soft/60 ring-1 ring-ink-200/50 p-3"
                        >
                          <div className="text-[12px] text-ink-500 mb-1 leading-snug">
                            {ambiguity.question}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[13px] font-medium text-ink-900">
                              {chosen.label}
                            </span>
                            <span className={`inline-flex items-center gap-1 text-[10.5px] font-medium ${impact.color}`}>
                              <ImpactIcon className="h-3 w-3" />
                              {impact.label}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    <div className="text-[11px] text-ink-400 pt-2 border-t border-ink-200/60 leading-relaxed">
                      <Info className="h-3 w-3 inline mr-1" />
                      Prototype scope: this would persist as a structured deal_resolutions record on the deal, alongside the original prose. The settlement engine would consume these resolutions instead of re-parsing the prose at settle time.
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Token usage */}
          {result && (
            <div className="text-[10px] text-ink-300 font-mono text-right">
              {result.usage.input_tokens} in · {result.usage.output_tokens} out
              {result.usage.cache_read_input_tokens > 0 && (
                <> · {result.usage.cache_read_input_tokens} cached</>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
