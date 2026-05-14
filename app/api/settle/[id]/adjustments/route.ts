import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { settlements } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { WorksheetAdjustment } from "@/lib/settlement-adjustments";

function isValidAdjustmentInput(body: unknown): body is {
  adjustments: { label: string; amount: number; note?: string }[];
} {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.adjustments)) return false;
  for (const a of b.adjustments) {
    if (!a || typeof a !== "object") return false;
    const adj = a as Record<string, unknown>;
    if (typeof adj.label !== "string" || !adj.label.trim()) return false;
    if (typeof adj.amount !== "number" || !Number.isFinite(adj.amount)) {
      return false;
    }
    if (adj.note != null && typeof adj.note !== "string") return false;
  }
  return true;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);

  if (!isValidAdjustmentInput(body)) {
    return NextResponse.json(
      { error: "Each adjustment needs a non-empty label and a numeric amount." },
      { status: 400 },
    );
  }

  const current = await db
    .select({ id: settlements.id })
    .from(settlements)
    .where(eq(settlements.showId, id));

  if (current.length === 0) {
    return NextResponse.json(
      { error: "No settlement found for that show." },
      { status: 404 },
    );
  }

  const now = new Date().toISOString();
  const adjustments: WorksheetAdjustment[] = body.adjustments.map((a) => ({
    id: `adj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    label: a.label.trim(),
    amount: a.amount,
    note: a.note?.trim() || undefined,
    added_at: now,
  }));

  await db
    .update(settlements)
    .set({ worksheetAdjustmentsJson: JSON.stringify(adjustments) })
    .where(eq(settlements.showId, id));

  return NextResponse.json({ adjustments });
}
