"use client";

import * as React from "react";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type AccentColor = "brand" | "amber" | "rose" | "sky";

const ACCENT_CLASSES: Record<AccentColor, string> = {
  brand: "before:bg-gradient-to-r before:from-brand-500 before:to-brand-700",
  amber: "before:bg-gradient-to-r before:from-amber-200 before:to-amber-700",
  rose: "before:bg-gradient-to-r before:from-rose-300 before:to-rose-700",
  sky: "before:bg-gradient-to-r before:from-sky-300 before:to-sky-700",
};

export function CollapsibleCard({
  id,
  title,
  description,
  badge,
  headerAction,
  accent,
  defaultOpen = true,
  className,
  bodyClassName,
  children,
}: {
  id?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  badge?: React.ReactNode;
  /** Action element rendered to the right of the chevron (e.g. an inline link). */
  headerAction?: React.ReactNode;
  accent?: AccentColor;
  defaultOpen?: boolean;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      id={id}
      className={cn(
        "relative rounded-lg border border-ink-200/80 bg-white",
        "shadow-[0_1px_2px_rgba(26,24,20,0.03)]",
        "overflow-hidden scroll-mt-12",
        accent && [
          "before:absolute before:top-0 before:inset-x-0 before:h-[2px]",
          ACCENT_CLASSES[accent],
        ],
        className,
      )}
    >
      <div
        className={cn(
          "px-5 py-4 flex items-start justify-between gap-3",
          open && "border-b border-ink-100/80",
        )}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex-1 min-w-0 text-left flex items-start gap-3 group"
        >
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 mt-1 text-ink-400 shrink-0 transition-transform",
              "group-hover:text-ink-700",
              !open && "-rotate-90",
            )}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-[13px] font-semibold text-ink-900 tracking-tight">
                {title}
              </h3>
              {badge}
            </div>
            {description && open && (
              <p className="text-[12px] text-ink-500 mt-0.5 leading-relaxed">
                {description}
              </p>
            )}
          </div>
        </button>
        {headerAction && (
          <div className="shrink-0 flex items-center gap-2">{headerAction}</div>
        )}
      </div>
      {open && (
        <div className={cn("px-5 py-4", bodyClassName)}>{children}</div>
      )}
    </div>
  );
}
