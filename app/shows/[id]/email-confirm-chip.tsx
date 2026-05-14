"use client";

import { Mail } from "lucide-react";

/**
 * Chip that lives on the Deal terms card and opens the Email composer
 * (rendered above) with the confirm_deal_terms intent pre-selected.
 *
 * Uses a custom event because the chip is in a Server Component but the
 * composer is a Client Component already mounted on the page — URL-param
 * deep-links don't fire useEffect on the mounted component.
 */
export function EmailToConfirmChip() {
  return (
    <button
      type="button"
      onClick={() => {
        window.dispatchEvent(
          new CustomEvent("greenroom:open-email-composer", {
            detail: { intent: "confirm_deal_terms" },
          }),
        );
      }}
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11.5px] font-medium ring-1 ring-inset bg-white text-ink-700 ring-ink-200/80 hover:bg-ink-50 transition-colors whitespace-nowrap"
    >
      <Mail className="h-3 w-3 text-brand-700" />
      Email to confirm
    </button>
  );
}
