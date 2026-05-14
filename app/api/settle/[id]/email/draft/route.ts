import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getShowById } from "@/lib/queries";
import {
  EMAIL_INTENT_HINT,
  EMAIL_INTENT_LABELS,
  type EmailIntent,
} from "@/lib/settlement-emails";

const SYSTEM_PROMPT = `You are drafting an email on behalf of Mariana Reyes, lead booker at The Crescent (an independent 650-cap music venue in Nashville). Mariana writes warmly but directly — no corporate filler, no fake enthusiasm, no over-apologizing. She references specific numbers and specific recoups by name. She makes one clear ask per email.

Write a single email matching the requested intent. The audience is the artist's agent or tour manager — assume they know what a settlement is and don't need basics explained. Keep it short: 60-150 words is the sweet spot for these. Skip the preamble. Skip "I hope this finds you well." Get to the point.

Use the structured context you're given: the artist name, show date, settlement status, dollar totals, recoups, signoff_text and notes, and any custom_context Mariana provides. Reference specific dollar figures and recoup line items by name when they matter to the ask. If the intent is to confirm a recoup interpretation, name the recoup and the two readings; don't be vague.

Sign off as "Mariana" — no "Best regards" preamble unless it fits the warmth of the rest. End with the venue line ("Mariana Reyes\\nThe Crescent · Nashville") when the email is formal (review request, payment follow-up). Omit it on quick replies.

OUTPUT
Return one JSON object matching the schema. No prose preamble. Subject should be short and specific — name the artist + the topic ("Coastal Spell settlement — quick recoup question"). Body in plain text with \\n for line breaks; no markdown.`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    subject: {
      type: "string",
      description:
        "Short, specific email subject. Reference the artist and the topic.",
    },
    body: {
      type: "string",
      description:
        "Plain-text email body, no markdown. Use \\n for line breaks.",
    },
    recipient_suggestion: {
      anyOf: [
        {
          type: "object",
          properties: {
            name: { type: "string" },
            reason: { type: "string" },
          },
          required: ["name", "reason"],
          additionalProperties: false,
        },
        { type: "null" },
      ],
      description:
        "If the email obviously goes to a specific person named in the context (e.g., the agent on file), suggest them. Otherwise null.",
    },
  },
  required: ["subject", "body", "recipient_suggestion"],
  additionalProperties: false,
} as const;

function formatTimestamp(ts: Date | null | undefined): string | null {
  if (!ts) return null;
  return new Date(ts).toISOString();
}

function buildContext(
  data: NonNullable<Awaited<ReturnType<typeof getShowById>>>,
  intent: EmailIntent,
  customContext: string | undefined,
) {
  const { show, artist, agent, agency, deal, settlement, recoups } = data;
  return {
    intent_key: intent,
    intent_label: EMAIL_INTENT_LABELS[intent],
    intent_hint:
      intent === "custom" && customContext
        ? `Mariana's own framing: "${customContext}"`
        : EMAIL_INTENT_HINT[intent],
    custom_context: customContext || null,
    show: {
      date: show.date,
      status: show.status,
    },
    artist: artist?.name ?? null,
    agent: agent
      ? {
          name: agent.name,
          agency: agency?.name ?? null,
          email: agent.email ?? null,
        }
      : null,
    deal: deal
      ? {
          type: deal.dealType,
          guarantee_amount: deal.guaranteeAmount,
          percentage: deal.percentage,
          percentage_basis: deal.percentageBasis,
          expense_cap: deal.expenseCap,
          notes_freetext: deal.dealNotesFreetext ?? null,
        }
      : null,
    settlement: settlement
      ? {
          status: settlement.status,
          total_to_artist: settlement.totalToArtist,
          gross_box_office: settlement.grossBoxOffice,
          signoff_text: settlement.signoffText ?? null,
          notes: settlement.notes ?? null,
          signed_at: formatTimestamp(settlement.signedAt),
          paid_at: formatTimestamp(settlement.paidAt),
        }
      : null,
    recoups: recoups.map((r) => ({
      category: r.category,
      label: r.label,
      amount: r.amount,
      status: r.status,
    })),
  };
}

const VALID_INTENTS: EmailIntent[] = [
  "send_for_review",
  "follow_up_payment",
  "confirm_recoup",
  "thank_you",
  "custom",
];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not set in .env.local" },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => null);
  const intent = body?.intent as EmailIntent | undefined;
  const customContext: string | undefined =
    typeof body?.custom_context === "string"
      ? body.custom_context.trim() || undefined
      : undefined;

  if (!intent || !VALID_INTENTS.includes(intent)) {
    return NextResponse.json(
      { error: "Missing or invalid intent." },
      { status: 400 }
    );
  }
  if (intent === "custom" && !customContext) {
    return NextResponse.json(
      { error: "Custom intent requires a custom_context describing what to say." },
      { status: 400 }
    );
  }

  const data = await getShowById(id);
  if (!data) {
    return NextResponse.json({ error: "Show not found" }, { status: 404 });
  }

  const context = buildContext(data, intent, customContext);
  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 1500,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: RESPONSE_SCHEMA },
      },
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: `Draft an email matching the following context. Return only the JSON object specified by the schema.\n\n${JSON.stringify(
            context,
            null,
            2
          )}`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json(
        { error: "No draft returned from model" },
        { status: 502 }
      );
    }
    const draft = JSON.parse(textBlock.text);

    return NextResponse.json({
      draft,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
        cache_creation_input_tokens: response.usage.cache_creation_input_tokens ?? 0,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Anthropic API error: ${message}` },
      { status: 502 }
    );
  }
}
