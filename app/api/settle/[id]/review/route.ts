import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { settlements } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { ReviewState } from "@/lib/settlement-review";

function isValidReview(body: unknown): body is ReviewState {
  if (!body || typeof body !== "object") return false;
  const r = body as Record<string, unknown>;
  if (typeof r.submitted_by !== "string" || !r.submitted_by.trim()) return false;
  if (!Array.isArray(r.line_items) || r.line_items.length === 0) return false;
  for (const li of r.line_items) {
    if (!li || typeof li !== "object") return false;
    const item = li as Record<string, unknown>;
    if (typeof item.key !== "string") return false;
    if (typeof item.label !== "string") return false;
    if (typeof item.amount !== "number") return false;
    if (item.status !== "accepted" && item.status !== "contested") return false;
    if (item.status === "contested") {
      if (typeof item.contest_reason !== "string" || !item.contest_reason.trim()) {
        return false;
      }
    }
  }
  return true;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const body = await request.json().catch(() => null);
  if (!isValidReview(body)) {
    return NextResponse.json(
      { error: "Review payload missing required fields or has invalid line items." },
      { status: 400 }
    );
  }

  const review: ReviewState = {
    submitted_at: new Date().toISOString(),
    submitted_by: body.submitted_by,
    reviewer_role: body.reviewer_role,
    line_items: body.line_items,
    notes: body.notes,
  };

  const updated = await db
    .update(settlements)
    .set({ reviewJson: JSON.stringify(review) })
    .where(eq(settlements.showId, id))
    .returning();

  if (updated.length === 0) {
    return NextResponse.json(
      { error: "No settlement found for that show." },
      { status: 404 }
    );
  }

  return NextResponse.json({ review });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const updated = await db
    .update(settlements)
    .set({ reviewJson: null })
    .where(eq(settlements.showId, id))
    .returning();

  if (updated.length === 0) {
    return NextResponse.json({ error: "No settlement found." }, { status: 404 });
  }

  return NextResponse.json({ cleared: true });
}
