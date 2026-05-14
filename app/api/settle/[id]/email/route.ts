import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { settlements } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  parseEmails,
  type EmailIntent,
  type EmailRecord,
} from "@/lib/settlement-emails";

const VALID_INTENTS: EmailIntent[] = [
  "confirm_deal_terms",
  "send_for_review",
  "follow_up_payment",
  "confirm_recoup",
  "thank_you",
  "custom",
];

function isValidBody(body: unknown): body is {
  recipient_name: string;
  recipient_email?: string;
  subject: string;
  body: string;
  intent: EmailIntent;
  drafted_by_ai?: boolean;
} {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  if (typeof b.recipient_name !== "string" || !b.recipient_name.trim()) return false;
  if (b.recipient_email != null && typeof b.recipient_email !== "string") return false;
  if (typeof b.subject !== "string" || !b.subject.trim()) return false;
  if (typeof b.body !== "string" || !b.body.trim()) return false;
  if (
    typeof b.intent !== "string" ||
    !VALID_INTENTS.includes(b.intent as EmailIntent)
  ) {
    return false;
  }
  return true;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const body = await request.json().catch(() => null);
  if (!isValidBody(body)) {
    return NextResponse.json(
      { error: "Email payload missing required fields." },
      { status: 400 }
    );
  }

  const current = await db
    .select({ emailsJson: settlements.emailsJson })
    .from(settlements)
    .where(eq(settlements.showId, id));

  if (current.length === 0) {
    return NextResponse.json(
      { error: "No settlement found for that show." },
      { status: 404 }
    );
  }

  const existing = parseEmails(current[0].emailsJson);
  const record: EmailRecord = {
    id: `eml_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    recipient_name: body.recipient_name.trim(),
    recipient_email: body.recipient_email?.trim() || undefined,
    subject: body.subject.trim(),
    body: body.body.trim(),
    intent: body.intent,
    drafted_by_ai: !!body.drafted_by_ai,
    sent_at: new Date().toISOString(),
  };
  const updated = [...existing, record];

  await db
    .update(settlements)
    .set({ emailsJson: JSON.stringify(updated) })
    .where(eq(settlements.showId, id));

  return NextResponse.json({ email: record });
}
