import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `You are a deal-parsing assistant for The Crescent, an independent music venue in Nashville. Mariana Reyes (the lead booker) negotiates deals with agents over email and types the deal terms into Greenroom as free-text prose. Your job is to extract structured fields from that prose AND identify any place where the language is genuinely ambiguous — so the ambiguity gets resolved BEFORE the show, not litigated AFTER it.

THE DEAL VOCABULARY
- deal_type: 'flat' (just a guarantee), 'percentage_of_gross' (X% of gross, no expenses), 'percentage_of_net' (X% of gross minus expenses), 'vs' (guarantee VS percentage, whichever greater), 'door' (door split). Use the value that matches the prose, even if the structured field today says otherwise.
- guarantee_amount: the dollar amount the artist gets at minimum.
- percentage: as a decimal (80% → 0.80). May or may not be present.
- percentage_basis: 'gross' or 'net'. Critical to capture explicitly.
- expense_cap: dollar ceiling on expenses passed through to the artist (i.e., that come out of the artist's percentage calculation).
- hospitality_cap: dollar ceiling specifically on hospitality (food/drink/dressing room).
- bonuses: structured rewards beyond the base deal. Each bonus has a type ('gross_threshold', 'sellout', 'attendance_threshold', 'tier_ratchet'), label, amount, and threshold/condition.
- recoups: venue costs taken off the top before splits. Each has a category ('marketing', 'hospitality_overage', 'production_overage', 'prior_advance', 'damages', 'other'), label, and amount.

WHAT 'AMBIGUOUS' MEANS
A field or interaction is ambiguous when two competent people reading the same prose could land on different dollar outcomes. Examples:
- 'Expenses capped at $2,500, marketing recoup of $900 against gross' — is the $900 INSIDE the $2,500 cap or SEPARATE from it? Different reads → different artist payouts.
- '80% of net' without saying what 'net' means (gross minus fees? minus expenses? minus both?).
- 'Bonus over $25k gross' without saying whether the bonus is paid at exactly $25k or only above it.
- Conflicting numbers (e.g., 'cap $2,500' in one sentence, 'expenses up to $3,000' in another).
- Missing information that's required to settle (e.g., 'vs' deal stated without a percentage basis).

Do NOT flag as ambiguous:
- Standard industry terms that have one obvious read (e.g., 'plus rider hospitality' implies the venue covers reasonable rider expenses).
- Cosmetic phrasing differences.
- Fields that are simply absent (just leave them null).
- Retrospective annotations from Mariana ('Note added 3/19/25: ...'). Treat those as context, not part of the deal.

WHAT TO EXTRACT
- Be conservative. Extract only what the prose actually says. If the deal type or basis isn't stated, leave it null and consider flagging.
- For each ambiguity: the specific question, a verbatim quote of the relevant passage from the prose, 2-4 interpretation options (each with a short label, a one-sentence explanation, and the dollar impact direction when relevant), and (when industry convention strongly favors one read) a default_recommendation key.
- Keep the summary to 1-2 sentences. Lead with the OUTCOME shape: 'This is a $X guarantee vs Y% of net deal with one ambiguity to resolve' — not 'I have parsed your input.'

OUTPUT
You return one JSON object matching the schema. No prose preamble. No editorializing.`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description:
        "1-2 sentences. Lead with the shape of the deal and any ambiguities to resolve, in plain English.",
    },
    extracted: {
      type: "object",
      properties: {
        deal_type: {
          anyOf: [
            {
              type: "string",
              enum: ["flat", "percentage_of_gross", "percentage_of_net", "vs", "door"],
            },
            { type: "null" },
          ],
        },
        guarantee_amount: { type: ["number", "null"] },
        percentage: {
          anyOf: [{ type: "number" }, { type: "null" }],
          description: "As a decimal: 80% → 0.80.",
        },
        percentage_basis: {
          anyOf: [{ type: "string", enum: ["gross", "net"] }, { type: "null" }],
        },
        expense_cap: { type: ["number", "null"] },
        hospitality_cap: { type: ["number", "null"] },
        bonuses: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: [
                  "gross_threshold",
                  "sellout",
                  "attendance_threshold",
                  "tier_ratchet",
                ],
              },
              label: { type: "string" },
              amount: { type: ["number", "null"] },
              threshold: { type: ["number", "null"] },
            },
            required: ["type", "label", "amount", "threshold"],
            additionalProperties: false,
          },
        },
        recoups: {
          type: "array",
          items: {
            type: "object",
            properties: {
              category: {
                type: "string",
                enum: [
                  "marketing",
                  "hospitality_overage",
                  "production_overage",
                  "prior_advance",
                  "damages",
                  "other",
                ],
              },
              label: { type: "string" },
              amount: { type: "number" },
            },
            required: ["category", "label", "amount"],
            additionalProperties: false,
          },
        },
      },
      required: [
        "deal_type",
        "guarantee_amount",
        "percentage",
        "percentage_basis",
        "expense_cap",
        "hospitality_cap",
        "bonuses",
        "recoups",
      ],
      additionalProperties: false,
    },
    ambiguities: {
      type: "array",
      description: "Empty array if the deal is fully unambiguous.",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "Slug identifier, e.g., 'marketing_recoup_position'." },
          question: {
            type: "string",
            description: "The ambiguous question, written as Mariana would ask it.",
          },
          evidence_quote: {
            type: "string",
            description: "Verbatim quote from the prose that contains the ambiguity.",
          },
          why_it_matters: {
            type: "string",
            description: "One sentence on the dollar/settlement consequence.",
          },
          interpretations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                key: { type: "string", description: "Slug, e.g., 'inside_cap'." },
                label: { type: "string", description: "Short human-readable label." },
                explanation: {
                  type: "string",
                  description: "One sentence on what this read means in plain English.",
                },
                artist_impact: {
                  type: "string",
                  enum: ["more_to_artist", "less_to_artist", "neutral"],
                },
              },
              required: ["key", "label", "explanation", "artist_impact"],
              additionalProperties: false,
            },
          },
          default_recommendation: {
            anyOf: [{ type: "string" }, { type: "null" }],
            description:
              "The interpretation key that industry convention favors, if any. Null when there is no defensible default.",
          },
        },
        required: [
          "id",
          "question",
          "evidence_quote",
          "why_it_matters",
          "interpretations",
          "default_recommendation",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["summary", "extracted", "ambiguities"],
  additionalProperties: false,
} as const;

export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not set in .env.local" },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => null);
  const dealText = body?.deal_text;
  if (typeof dealText !== "string" || !dealText.trim()) {
    return NextResponse.json(
      { error: "Missing or empty deal_text in request body." },
      { status: 400 }
    );
  }

  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "high",
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
          content: `Parse the following deal email / deal notes. Return only the JSON object specified by the schema.\n\n---DEAL TEXT---\n${dealText.trim()}\n---END---`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json(
        { error: "No analysis returned from model" },
        { status: 502 }
      );
    }

    const analysis = JSON.parse(textBlock.text);

    return NextResponse.json({
      analysis,
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
