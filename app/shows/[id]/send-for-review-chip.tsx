"use client";

import { Send } from "lucide-react";

/**
 * Chip on the Worksheet card that opens the Email composer with the
 * send_for_review intent. Mariana drafts an email to the agent containing
 * a link to the review form; the agent fills out the form on her behalf.
 *
 * Previously this linked directly to the review form, which put Mariana
 * in front of a form *she* would have had to submit — wrong audience.
 */
export function SendForReviewChip() {
  return (
    <button
      type="button"
      onClick={() => {
        window.dispatchEvent(
          new CustomEvent("greenroom:open-email-composer", {
            detail: { intent: "send_for_review" },
          }),
        );
      }}
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11.5px] font-medium ring-1 ring-inset bg-white text-ink-700 ring-ink-200/80 hover:bg-ink-50 transition-colors whitespace-nowrap"
    >
      <Send className="h-3 w-3 text-brand-700" />
      Send for review
    </button>
  );
}
