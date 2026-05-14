"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Plus,
  X,
  Loader2,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import {
  type WorksheetAdjustment,
  sumAdjustments,
} from "@/lib/settlement-adjustments";
import { cn } from "@/lib/utils";

export function WorksheetAdjustments({
  showId,
  baseTotal,
  initialAdjustments,
}: {
  showId: string;
  baseTotal: number;
  initialAdjustments: WorksheetAdjustment[];
}) {
  const router = useRouter();
  const [adjustments, setAdjustments] = useState<WorksheetAdjustment[]>(
    initialAdjustments,
  );
  const [open, setOpen] = useState(initialAdjustments.length > 0);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New-adjustment form state
  const [label, setLabel] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [note, setNote] = useState("");

  const total = sumAdjustments(adjustments);
  const adjustedTotal = baseTotal + total;

  function resetForm() {
    setLabel("");
    setAmountStr("");
    setNote("");
    setAdding(false);
    setError(null);
  }

  async function saveAll(next: WorksheetAdjustment[]) {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        adjustments: next.map((a) => ({
          label: a.label,
          amount: a.amount,
          note: a.note,
        })),
      };
      const res = await fetch(`/api/settle/${showId}/adjustments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setAdjustments(data.adjustments);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleAdd() {
    const trimmedLabel = label.trim();
    const amount = parseFloat(amountStr);
    if (!trimmedLabel) {
      setError("Label is required.");
      return;
    }
    if (!Number.isFinite(amount)) {
      setError("Amount must be a number (positive or negative).");
      return;
    }
    const next: WorksheetAdjustment[] = [
      ...adjustments,
      {
        id: `tmp_${Date.now()}`,
        label: trimmedLabel,
        amount,
        note: note.trim() || undefined,
        added_at: new Date().toISOString(),
      },
    ];
    await saveAll(next);
    resetForm();
  }

  async function handleRemove(id: string) {
    const next = adjustments.filter((a) => a.id !== id);
    await saveAll(next);
  }

  return (
    <div className="mt-6 pt-5 border-t border-ink-200/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 text-left group"
      >
        <div className="flex items-center gap-2">
          <ChevronDown
            className={cn(
              "h-3 w-3 text-ink-400 transition-transform group-hover:text-ink-700",
              !open && "-rotate-90",
            )}
          />
          <Pencil className="h-3 w-3 text-ink-500" />
          <div className="text-[11.5px] eyebrow text-ink-600">
            Manual adjustments
          </div>
          {adjustments.length > 0 && (
            <span className="text-[10.5px] text-ink-400 font-mono">
              {adjustments.length}{" "}
              {adjustments.length === 1 ? "item" : "items"} ·{" "}
              <span className={total >= 0 ? "text-brand-700" : "text-rose-700"}>
                {total >= 0 ? "+" : ""}
                {formatMoney(total)}
              </span>
            </span>
          )}
        </div>
        {!open && (
          <span className="text-[10.5px] text-ink-400 italic">
            For deal shapes the engine can&apos;t structure yet
          </span>
        )}
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          {adjustments.length === 0 && !adding && (
            <div className="text-[12px] text-ink-500 leading-relaxed">
              Add a row to override the worksheet — useful for tier ratchets,
              custom co-bill splits, or anything the math engine can&apos;t
              compute yet. Negative amounts work too (e.g., a $500 recoup
              adjustment).
            </div>
          )}

          {adjustments.map((a) => (
            <div
              key={a.id}
              className="flex items-start justify-between gap-3 py-2 px-3 rounded-md bg-canvas-soft/60 ring-1 ring-ink-200/50"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] text-ink-900 leading-tight">
                  {a.label}
                </div>
                {a.note && (
                  <div className="text-[11px] text-ink-500 mt-0.5 leading-relaxed">
                    {a.note}
                  </div>
                )}
              </div>
              <div
                className={cn(
                  "text-[13px] font-mono tabular shrink-0 whitespace-nowrap",
                  a.amount >= 0 ? "text-brand-800" : "text-rose-800",
                )}
              >
                {a.amount >= 0 ? "+" : ""}
                {formatMoney(a.amount)}
              </div>
              <button
                type="button"
                onClick={() => handleRemove(a.id)}
                disabled={saving}
                className="shrink-0 text-ink-300 hover:text-rose-700 transition-colors p-0.5 disabled:opacity-40"
                title="Remove adjustment"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}

          {adding && (
            <div className="rounded-md ring-1 ring-brand-200/60 bg-brand-50/30 p-3 space-y-2.5">
              <div className="grid grid-cols-[1fr_120px] gap-2.5">
                <div>
                  <label className="block text-[10px] eyebrow text-ink-500 mb-1">
                    Label
                  </label>
                  <input
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g., Co-bill split adjustment"
                    className="w-full rounded-md border border-ink-200 bg-white text-[12.5px] text-ink-900 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400"
                  />
                </div>
                <div>
                  <label className="block text-[10px] eyebrow text-ink-500 mb-1">
                    Amount ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value)}
                    placeholder="±1234.56"
                    className="w-full rounded-md border border-ink-200 bg-white text-[12.5px] text-ink-900 font-mono px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] eyebrow text-ink-500 mb-1">
                  Note (optional)
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Why this adjustment — visible to anyone reviewing the settlement"
                  className="w-full rounded-md border border-ink-200 bg-white text-[12px] text-ink-900 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={saving}
                  className="text-[11.5px] text-ink-500 hover:text-ink-900 px-2 py-1"
                >
                  Cancel
                </button>
                <Button
                  variant="brand"
                  size="sm"
                  onClick={handleAdd}
                  disabled={saving || !label.trim() || !amountStr}
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Add adjustment"
                  )}
                </Button>
              </div>
            </div>
          )}

          {error && (
            <div className="text-[11.5px] text-rose-800 bg-rose-50/50 ring-1 ring-rose-200/50 rounded px-2.5 py-1.5">
              {error}
            </div>
          )}

          {!adding && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1 text-[11.5px] text-brand-700 hover:text-brand-900 font-medium"
            >
              <Plus className="h-3 w-3" />
              Add adjustment
            </button>
          )}

          {adjustments.length > 0 && (
            <div className="pt-3 mt-2 border-t border-ink-200/60 flex items-baseline justify-between">
              <span className="text-[12px] text-ink-600">
                Adjusted total to artist
              </span>
              <span className="text-[15px] font-mono tabular font-semibold text-ink-900">
                {formatMoney(adjustedTotal)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
