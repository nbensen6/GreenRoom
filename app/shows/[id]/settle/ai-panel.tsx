"use client";

import { useState } from "react";
import { Sparkles, AlertTriangle, Info, AlertOctagon, Loader2, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Severity = "info" | "warning" | "contradiction";
type Confidence = "high" | "medium" | "low";

type Flag = {
  severity: Severity;
  type: string;
  evidence: string;
  explanation: string;
};

type Analysis = {
  plain_english_status: string;
  confidence: Confidence;
  flags: Flag[];
  recommended_next_action: string | null;
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

const SEVERITY_STYLES: Record<Severity, { badge: string; icon: typeof Info }> = {
  info: {
    badge: "bg-sky-50 text-sky-800 ring-sky-200/80",
    icon: Info,
  },
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

export function AISettlePanel({ showId }: { showId: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runAnalysis() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/settle/${showId}/analyze`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      setResult(data as ApiResponse);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const analysis = result?.analysis;
  const hasContradictions =
    analysis?.flags.some((f) => f.severity === "contradiction") ?? false;

  return (
    <Card accent={hasContradictions ? "rose" : "brand"}>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-brand-700" />
            AI settlement check
          </CardTitle>
          <CardDescription>
            Reads the structured status, timestamps, recoups, signoff text, notes, and deal terms. Flags places where the system&apos;s status disagrees with the prose evidence.
          </CardDescription>
        </div>
        {!analysis && !loading && (
          <Button variant="brand" size="sm" onClick={runAnalysis}>
            <Sparkles className="h-3.5 w-3.5" />
            Summarize settlement
          </Button>
        )}
        {analysis && (
          <Button variant="secondary" size="sm" onClick={runAnalysis} disabled={loading}>
            Re-run
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-5 py-5">
        {!analysis && !loading && !error && (
          <div className="text-[12.5px] text-ink-400 leading-relaxed">
            Click <span className="text-ink-700 font-medium">Summarize settlement</span> to ask Claude to read every field on this show and tell you, in plain English, whether the structured status matches what actually happened.
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-[13px] text-ink-500 py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Reading settlement, recoups, notes, and deal terms...
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-rose-50/60 ring-1 ring-rose-200/60 p-3 text-[12.5px] text-rose-900">
            <div className="font-medium mb-0.5">Analysis failed</div>
            <div className="text-rose-800">{error}</div>
          </div>
        )}

        {analysis && (
          <>
            {/* Plain-English status */}
            <div>
              <div className="eyebrow text-[10px] text-ink-500 mb-2">
                What&apos;s actually happening
              </div>
              <div className="text-[13.5px] text-ink-900 leading-relaxed">
                {analysis.plain_english_status}
              </div>
              <div className="text-[11px] text-ink-400 mt-2 font-mono">
                {CONFIDENCE_LABEL[analysis.confidence]}
              </div>
            </div>

            {/* Flags */}
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
                No contradictions found. Structured status matches the prose evidence.
              </div>
            )}

            {/* Recommended action */}
            {analysis.recommended_next_action && (
              <div className="rounded-lg bg-brand-50/40 ring-1 ring-brand-200/50 p-3.5 flex items-start gap-2.5">
                <ArrowRight className="h-3.5 w-3.5 text-brand-700 mt-0.5 shrink-0" />
                <div>
                  <div className="eyebrow text-[10px] text-brand-800 mb-1">
                    Suggested next step
                  </div>
                  <div className="text-[12.5px] text-ink-800 leading-relaxed">
                    {analysis.recommended_next_action}
                  </div>
                </div>
              </div>
            )}

            {/* Token usage (small, for transparency) */}
            {result && (
              <div className="text-[10px] text-ink-300 font-mono pt-1 border-t border-ink-100/60">
                {result.usage.input_tokens} in · {result.usage.output_tokens} out
                {result.usage.cache_read_input_tokens > 0 && (
                  <> · {result.usage.cache_read_input_tokens} cached</>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
