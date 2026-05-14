"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Mail,
  Sparkles,
  Loader2,
  Send,
  ChevronDown,
  ChevronUp,
  Check,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { PlainBadge } from "@/components/ui/badge";
import {
  EMAIL_INTENT_LABELS,
  type EmailIntent,
  type EmailRecord,
} from "@/lib/settlement-emails";
import type { Deal, Bonus } from "@/db/schema";
import { parseBonuses } from "@/lib/dealMath";
import { formatMoney } from "@/lib/format";

const INTENT_OPTIONS: EmailIntent[] = [
  "confirm_deal_terms",
  "send_for_review",
  "follow_up_payment",
  "confirm_recoup",
  "thank_you",
  "custom",
];

const VALID_INTENTS = new Set<EmailIntent>(INTENT_OPTIONS);

export function EmailSection({
  showId,
  emails,
  defaultRecipientName,
  deal,
}: {
  showId: string;
  emails: EmailRecord[];
  defaultRecipientName: string;
  deal: Deal | null;
}) {
  const router = useRouter();
  const [composerOpen, setComposerOpen] = useState(false);
  const [intent, setIntent] = useState<EmailIntent>("send_for_review");
  const [customContext, setCustomContext] = useState("");
  const [recipientName, setRecipientName] = useState(defaultRecipientName);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftedByAi, setDraftedByAi] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Open the composer with a specific intent — triggered by chips elsewhere
  // on the page (e.g. "Email to confirm" on Deal terms).
  useEffect(() => {
    function openWithIntent(intent: string) {
      if (!VALID_INTENTS.has(intent as EmailIntent)) return;
      setIntent(intent as EmailIntent);
      setComposerOpen(true);
      requestAnimationFrame(() => {
        document
          .getElementById("email")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }

    // 1) Event-based (same-page chip clicks) — fires after this component
    //    is mounted, so we listen rather than checking on mount.
    function handler(e: Event) {
      const ce = e as CustomEvent<{ intent?: string }>;
      if (ce.detail?.intent) openWithIntent(ce.detail.intent);
    }
    window.addEventListener("greenroom:open-email-composer", handler);

    // 2) URL-based (direct deep-link from elsewhere or a refresh) — runs once.
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const requested = sp.get("intent");
      if (requested) {
        openWithIntent(requested);
        sp.delete("intent");
        const query = sp.toString();
        router.replace(query ? `?${query}#email` : `#email`, { scroll: false });
      }
    }

    return () => {
      window.removeEventListener("greenroom:open-email-composer", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bonuses = deal ? parseBonuses(deal) : [];

  function resetComposer() {
    setIntent("send_for_review");
    setCustomContext("");
    setSubject("");
    setBody("");
    setError(null);
    setDraftedByAi(false);
  }

  async function generateDraft() {
    setDrafting(true);
    setError(null);
    try {
      const res = await fetch(`/api/settle/${showId}/email/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent,
          custom_context: intent === "custom" ? customContext : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setSubject(data.draft.subject);
      setBody(data.draft.body);
      setDraftedByAi(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDrafting(false);
    }
  }

  async function sendEmail() {
    if (!recipientName.trim() || !subject.trim() || !body.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/settle/${showId}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient_name: recipientName.trim(),
          subject: subject.trim(),
          body: body.trim(),
          intent,
          drafted_by_ai: draftedByAi,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setComposerOpen(false);
      resetComposer();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  const sentEmails = [...emails].sort((a, b) =>
    b.sent_at.localeCompare(a.sent_at),
  );

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 text-ink-600" />
            Email to artist team
            {sentEmails.length > 0 && (
              <PlainBadge variant="default" className="ml-1">
                {sentEmails.length} sent
              </PlainBadge>
            )}
          </CardTitle>
          <CardDescription>
            Draft and send emails to the agent / tour manager without leaving
            Greenroom. Claude composes from the settlement context; every email
            is captured on the record.
          </CardDescription>
        </div>
        {!composerOpen && (
          <Button
            variant="brand"
            size="sm"
            onClick={() => setComposerOpen(true)}
            className="shrink-0 whitespace-nowrap"
          >
            <Mail className="h-3.5 w-3.5" />
            Compose email
          </Button>
        )}
      </CardHeader>

      <CardContent className="py-4 space-y-4">
        {composerOpen && (
          <div className="rounded-lg ring-1 ring-ink-200/60 bg-canvas-soft/40 p-4 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div className="eyebrow text-[10px] text-ink-500">
                New email
              </div>
              <button
                type="button"
                onClick={() => {
                  setComposerOpen(false);
                  resetComposer();
                }}
                className="text-[11px] text-ink-400 hover:text-ink-700"
              >
                Cancel
              </button>
            </div>

            <div>
              <label className="block text-[11px] eyebrow text-ink-500 mb-1.5">
                What&apos;s this email about?
              </label>
              <select
                value={intent}
                onChange={(e) => setIntent(e.target.value as EmailIntent)}
                className="w-full rounded-md border border-ink-200 bg-white text-[13px] text-ink-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400"
              >
                {INTENT_OPTIONS.map((i) => (
                  <option key={i} value={i}>
                    {EMAIL_INTENT_LABELS[i]}
                  </option>
                ))}
              </select>
            </div>

            {intent === "custom" && (
              <div>
                <label className="block text-[11px] eyebrow text-ink-500 mb-1.5">
                  Describe what you want to say
                </label>
                <textarea
                  value={customContext}
                  onChange={(e) => setCustomContext(e.target.value)}
                  placeholder="e.g., Tell Daniel we noticed the marketing recoup was double-counted in his last spreadsheet — could he take another look at the line items?"
                  className="w-full rounded-md border border-ink-200 bg-white text-[12.5px] text-ink-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400"
                  rows={2}
                />
              </div>
            )}

            {intent === "confirm_deal_terms" && deal && (
              <DealTermsPreview deal={deal} bonuses={bonuses} />
            )}

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={generateDraft}
                disabled={
                  drafting ||
                  (intent === "custom" && !customContext.trim())
                }
                className="shrink-0 whitespace-nowrap"
              >
                {drafting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Drafting...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5 text-brand-700" />
                    {subject || body ? "Re-draft with AI" : "Help me draft"}
                  </>
                )}
              </Button>
              {draftedByAi && (
                <span className="text-[10.5px] text-ink-400 italic">
                  Draft from Claude — edit as needed.
                </span>
              )}
            </div>

            <div>
              <label className="block text-[11px] eyebrow text-ink-500 mb-1.5">
                To
              </label>
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="e.g., Daniel Hwang"
                className="w-full rounded-md border border-ink-200 bg-white text-[13px] text-ink-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400"
              />
            </div>

            <div>
              <label className="block text-[11px] eyebrow text-ink-500 mb-1.5">
                Subject
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g., Coastal Spell settlement — quick recoup question"
                className="w-full rounded-md border border-ink-200 bg-white text-[13px] text-ink-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400"
              />
            </div>

            <div>
              <label className="block text-[11px] eyebrow text-ink-500 mb-1.5">
                Body
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write or click 'Help me draft' to have Claude compose from the settlement context."
                className="w-full rounded-md border border-ink-200 bg-white text-[12.5px] text-ink-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400 font-mono leading-relaxed"
                rows={Math.max(6, body.split("\n").length + 1)}
              />
            </div>

            {error && (
              <div className="rounded-md bg-rose-50/60 ring-1 ring-rose-200/60 p-2.5 text-[12px] text-rose-900">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <Button
                variant="brand"
                size="sm"
                onClick={sendEmail}
                disabled={
                  sending ||
                  !recipientName.trim() ||
                  !subject.trim() ||
                  !body.trim()
                }
                className="shrink-0 whitespace-nowrap"
              >
                {sending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    Send
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {sentEmails.length === 0 && !composerOpen && (
          <div className="text-[12.5px] text-ink-400 italic">
            No emails sent from Greenroom yet for this settlement.
          </div>
        )}

        {sentEmails.length > 0 && (
          <div className="space-y-2">
            <div className="eyebrow text-[10px] text-ink-500">
              Sent from Greenroom
            </div>
            {sentEmails.map((email) => {
              const expanded = expandedId === email.id;
              return (
                <div
                  key={email.id}
                  className="rounded-lg ring-1 ring-ink-200/60 bg-white"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : email.id)}
                    className="w-full text-left p-3 flex items-start justify-between gap-3 hover:bg-ink-50/40 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-medium text-ink-900">
                          {email.subject}
                        </span>
                        {email.drafted_by_ai && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-brand-700">
                            <Sparkles className="h-2.5 w-2.5" />
                            AI-drafted
                          </span>
                        )}
                      </div>
                      <div className="text-[11.5px] text-ink-500 mt-0.5">
                        To {email.recipient_name} ·{" "}
                        {EMAIL_INTENT_LABELS[email.intent]} ·{" "}
                        {new Date(email.sent_at).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </div>
                    </div>
                    <div className="shrink-0 text-ink-400 mt-0.5">
                      {expanded ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </div>
                  </button>
                  {expanded && (
                    <div className="px-3 pb-3 border-t border-ink-100/80 pt-2.5">
                      <pre className="text-[12.5px] text-ink-800 leading-relaxed whitespace-pre-wrap font-sans">
                        {email.body}
                      </pre>
                      <div className="text-[10.5px] text-ink-300 mt-3 pt-2 border-t border-ink-100/60 flex items-center gap-1">
                        <Check className="h-2.5 w-2.5" />
                        Captured on the settlement record · prototype: not
                        actually sent via SMTP
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DealTermsPreview({
  deal,
  bonuses,
}: {
  deal: Deal;
  bonuses: Bonus[];
}) {
  const rows: { label: string; value: string }[] = [];
  if (deal.guaranteeAmount != null) {
    rows.push({ label: "Guarantee", value: formatMoney(deal.guaranteeAmount) });
  }
  if (deal.percentage != null) {
    rows.push({
      label: "Percentage",
      value: `${(deal.percentage * 100).toFixed(0)}%${
        deal.percentageBasis ? ` of ${deal.percentageBasis.replace(/_/g, " ")}` : ""
      }`,
    });
  }
  if (deal.expenseCap != null) {
    rows.push({ label: "Expense cap", value: formatMoney(deal.expenseCap) });
  }
  if (deal.hospitalityCap != null) {
    rows.push({
      label: "Hospitality cap",
      value: formatMoney(deal.hospitalityCap),
    });
  }

  return (
    <div className="rounded-lg ring-1 ring-brand-200/60 bg-brand-50/30 p-3.5">
      <div className="flex items-center gap-1.5 mb-2.5">
        <FileText className="h-3 w-3 text-brand-700" />
        <div className="eyebrow text-[10px] text-brand-800">
          Deal terms being confirmed
        </div>
      </div>
      <div className="text-[11.5px] text-ink-500 mb-3 leading-relaxed">
        Claude will reference these in the email and ask the agent to confirm
        them in writing. Mariana can edit the body before sending.
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        <div className="col-span-2">
          <dt className="inline text-[10px] eyebrow text-ink-500 mr-2">
            Deal type
          </dt>
          <dd className="inline text-[12px] text-ink-800 font-medium capitalize">
            {deal.dealType.replace(/_/g, " ")}
          </dd>
        </div>
        {rows.map((r) => (
          <div key={r.label}>
            <dt className="text-[10px] eyebrow text-ink-500 mb-0.5">
              {r.label}
            </dt>
            <dd className="text-[12px] text-ink-800 font-mono tabular">
              {r.value}
            </dd>
          </div>
        ))}
      </dl>

      {bonuses.length > 0 && (
        <div className="mt-3 pt-3 border-t border-brand-200/40">
          <div className="text-[10px] eyebrow text-ink-500 mb-1.5">
            Bonuses ({bonuses.length})
          </div>
          <ul className="space-y-1">
            {bonuses.map((b, i) => (
              <li
                key={i}
                className="text-[11.5px] text-ink-700 leading-relaxed"
              >
                · {b.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      {deal.dealNotesFreetext && (
        <div className="mt-3 pt-3 border-t border-brand-200/40">
          <div className="text-[10px] eyebrow text-ink-500 mb-1.5">
            Original deal notes (Claude will check for anything ambiguous)
          </div>
          <div
            className="text-[11.5px] text-ink-700 leading-relaxed line-clamp-4"
            style={{ fontStyle: "italic" }}
          >
            {deal.dealNotesFreetext}
          </div>
        </div>
      )}
    </div>
  );
}
