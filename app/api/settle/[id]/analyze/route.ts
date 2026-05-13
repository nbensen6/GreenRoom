import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getShowById } from "@/lib/queries";

const SYSTEM_PROMPT = `You are a settlement reconciliation analyst at The Crescent, a 650-cap independent music venue in Nashville. Mariana Reyes is the lead booker. Your job is to read a single show's settlement record and tell Mariana, in plain English, where the settlement actually stands — and flag any contradiction between the system's structured state and what the prose evidence says.

THE SETTLEMENT LIFECYCLE
A settlement moves through these states: draft → submitted → in_review → signed → disputed → revised → finalized → paid → voided. Each state has a corresponding timestamp (drafted_at, submitted_at, signed_at, etc.).

Recoup line items (venue costs taken off the top before artist payment) live inside the settlement record and have their own independent status: agreed | disputed | withdrawn.

THE CORE PROBLEM
The structured 'status' field often lies — or rather, it lags. The prose fields tell the truth:
- signoff_text: the artist team's actual response when they reviewed the statement ("Looks good", "OK wire monday", "👍", "OK. Good night.")
- notes: Mariana's internal commentary about what really happened
- recoups_json: per-item agreement state
- deal.notes_freetext: the deal terms Mariana actually trusts (structured fields are often inconsistently filled)
- show.internal_notes: Mariana's running notes on the show

WHAT TO LOOK FOR (contradiction patterns)
1. status='disputed' but signoff_text contains casual approval prose ("Looks good", "👍", "OK", "Sign off", "ok wire monday"). The artist team verbally signed off but the structured status was never updated. This is the dominant pattern.
2. status='disputed' but signed_at, finalized_at, or paid_at timestamps are populated. Structured fields contradict themselves.
3. status='disputed' but every recoup line item has status='agreed' or 'withdrawn'. The line-item disputes were resolved but the parent status was never updated.
4. status='paid' or 'signed' but a recoup still has status='disputed'. The dispute is still open at the line-item level even though the parent looks closed.
5. Mariana's notes explicitly describe a verbal resolution that hasn't been pushed into the system (e.g., "Marcus authorized additional $X to resolve, but the formal revision hasn't been pushed back into the system yet").
6. signoff_text reflects a sign-off from an assistant or junior contact that was later questioned by a senior — note the ambiguity, don't treat it as resolved.

WHAT TO OUTPUT
You return a single JSON object matching the provided schema. Be specific and quote evidence verbatim from the source fields. Do not editorialize or add advice beyond what the data supports. If nothing contradicts, say so plainly — confidence high, empty flags array, status summary matches the structured state.

THE BOTTOM LINE (most important field)
Mariana scans these in seconds — give her the answer first. The 'bottom_line' field is a 1-2 sentence plain-English headline that leads with the OUTCOME, not the mechanism. It should answer three questions implicitly:
  (1) What was actually agreed? (Use the dollar figure if known.)
  (2) What's the real-world state? (Resolved, still disputed, paid, etc.)
  (3) What's actually left? (In Mariana's vocabulary — "system needs to catch up", "payment hasn't gone out", "agent never responded" — NOT "advance status from disputed to revised, stamp finalized_at".)

Lead with the dollar figure when one exists. Use Mariana's vocabulary, not engineering vocabulary. Avoid words like "advance", "stamp", "structured state", "lifecycle", "recoup line item", "JSON". The bottom line is what a senior colleague leaning over Mariana's shoulder would say in 10 seconds.

Good bottom_line examples:
  - "Artist gets $12,285. The deal is settled — Marcus and WME agreed on the +$720 concession. The only thing actually open is payment and getting the system to match."
  - "TM signed off Sunday at $8,940 ('Looks good — wire when ready'). System is stuck on 'disputed' because of a stray Monday email from the assistant. Effectively closed; just needs cleanup."
  - "Still actually disputed. The recoup line is open, the agent hasn't responded since 3/18, and no payment has gone out. Real work to do here."

Bad bottom_line examples (too mechanism-focused):
  - "Push the verbal resolution into the system so settlement.status reaches finalized."
  - "Update marketing recoup from disputed to agreed and stamp finalized_at."

SEVERITY GUIDE
- 'contradiction': the structured field and the prose/timestamp evidence point in opposite directions. Surface this prominently.
- 'warning': ambiguity or partial signal worth flagging but not definitive (e.g., a junior assistant signed off but the senior agent disagreed later).
- 'info': useful context, not contradictory (e.g., "all 3 recoups are agreed", "TM signed off Sunday, dispute opened Monday").

CONFIDENCE GUIDE
- 'high': structured fields and prose agree, OR a clear contradiction with explicit prose evidence.
- 'medium': prose is suggestive but not conclusive (vague emoji, ambiguous "OK").
- 'low': key prose fields are empty or genuinely conflicting beyond what the patterns above describe.

RECOMMENDED ACTION (structured)
You return a 'recommended_action' object with:
- summary: one short sentence describing the overall intent (e.g., "Push the verbal resolution into the system so the dispute closes.")
- steps: an array of discrete, bullet-sized actions Mariana could take. Each step has:
  - description: one concrete action ("Update marketing recoup status from disputed to agreed")
  - location: where the action lives. One of:
    - 'greenroom' — would happen in the Greenroom UI (recoups section, lifecycle bar, signoff, worksheet)
    - 'spreadsheet' — Mariana's external settlement spreadsheet
    - 'email' — reply or follow-up to the agent/TM/management
    - 'eng-ticket' — needs an engineering change (data fix, schema update) because no UI exists yet
  - anchor: optional. Only when location is 'greenroom'. One of: '#lifecycle', '#recoups', '#signoff', '#worksheet'. Use the section the user would scroll to.

IMPORTANT: Today the Greenroom settle page is read-only. There is NO UI to change recoup status, advance settlement state, stamp timestamps, or edit signoff/notes. For any action that updates settlement state, location should be 'eng-ticket' (with an optional anchor pointing the reader to the relevant section for context). Do not pretend buttons exist that don't. The 'greenroom' location is reserved for actions that genuinely live in the current UI (today, that mostly means 'click around to verify context before filing a ticket').

Set recommended_action to null only when there's truly nothing to do (clean state, no action warranted). Otherwise return at least one step.

Be concise. Mariana reads dozens of these and her time is the constraint.`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    bottom_line: {
      type: "string",
      description:
        "1-2 sentences. The TL;DR Mariana sees first. Lead with the outcome (dollar figure if known, real-world status), then say what's actually left in plain language. NO engineering vocabulary ('advance status', 'stamp', 'lifecycle'). Think: what a senior colleague would say in 10 seconds.",
    },
    plain_english_status: {
      type: "string",
      description:
        "2-4 sentences with more detail than bottom_line — the supporting context. Describe what is actually happening with this settlement. Mention the structured status only if it matches reality; otherwise lead with what the evidence shows.",
    },
    confidence: {
      type: "string",
      enum: ["high", "medium", "low"],
      description: "Confidence in this analysis based on how clear the evidence is.",
    },
    flags: {
      type: "array",
      description:
        "Specific findings. Empty array if everything is consistent. Each flag is a discrete contradiction, warning, or relevant context note.",
      items: {
        type: "object",
        properties: {
          severity: {
            type: "string",
            enum: ["info", "warning", "contradiction"],
          },
          type: {
            type: "string",
            description:
              "Short human-readable label for the finding, e.g., 'Verbal sign-off contradicts disputed status' or 'All recoups agreed at line-item level'.",
          },
          evidence: {
            type: "string",
            description:
              "Direct quote or factual reference from the source data. Use quotes for prose; for structured fields, name the field and value (e.g., 'signed_at is populated 2024-10-18').",
          },
          explanation: {
            type: "string",
            description:
              "One sentence explaining why this is flagged at this severity.",
          },
        },
        required: ["severity", "type", "evidence", "explanation"],
        additionalProperties: false,
      },
    },
    recommended_action: {
      anyOf: [
        {
          type: "object",
          properties: {
            summary: {
              type: "string",
              description:
                "One short sentence describing the overall intent of the next-step recommendation.",
            },
            steps: {
              type: "array",
              description:
                "Discrete, bullet-sized actions. At least one if the parent object is non-null.",
              items: {
                type: "object",
                properties: {
                  description: {
                    type: "string",
                    description:
                      "One concrete action, written imperatively (e.g., 'Update marketing recoup status from disputed to agreed').",
                  },
                  location: {
                    type: "string",
                    enum: ["greenroom", "spreadsheet", "email", "eng-ticket"],
                    description:
                      "Where this action would actually be taken. Use 'eng-ticket' for any settlement-state mutation since the Greenroom UI is read-only today.",
                  },
                  anchor: {
                    anyOf: [
                      {
                        type: "string",
                        enum: ["#lifecycle", "#recoups", "#signoff", "#worksheet"],
                      },
                      { type: "null" },
                    ],
                    description:
                      "Optional anchor pointing to the relevant section of the settle page. Null when not applicable. Use only when the user would benefit from scrolling there.",
                  },
                },
                required: ["description", "location", "anchor"],
                additionalProperties: false,
              },
            },
          },
          required: ["summary", "steps"],
          additionalProperties: false,
        },
        { type: "null" },
      ],
      description:
        "Structured next-step recommendation, or null if no action is warranted.",
    },
  },
  required: ["bottom_line", "plain_english_status", "confidence", "flags", "recommended_action"],
  additionalProperties: false,
} as const;

type Recoup = {
  id: string;
  category: string;
  label: string;
  amount: number;
  status: "agreed" | "disputed" | "withdrawn";
};

function formatTimestamp(ts: Date | null | undefined): string | null {
  if (!ts) return null;
  return new Date(ts).toISOString();
}

function buildContext(data: NonNullable<Awaited<ReturnType<typeof getShowById>>>) {
  const { show, artist, agent, agency, deal, settlement, recoups } = data;

  return {
    show: {
      id: show.id,
      date: show.date,
      status: show.status,
      internal_notes: show.internalNotes ?? null,
    },
    artist: artist ? { name: artist.name, prior_show_count: artist.priorShowCount } : null,
    agent: agent
      ? { name: agent.name, agency: agency?.name ?? null, preferences_notes: agent.preferencesNotes ?? null }
      : null,
    deal: deal
      ? {
          type: deal.dealType,
          guarantee_amount: deal.guaranteeAmount,
          percentage: deal.percentage,
          percentage_basis: deal.percentageBasis,
          expense_cap: deal.expenseCap,
          hospitality_cap: deal.hospitalityCap,
          notes_freetext: deal.dealNotesFreetext ?? null,
        }
      : null,
    settlement: settlement
      ? {
          status: settlement.status,
          gross_box_office: settlement.grossBoxOffice,
          net_box_office: settlement.netBoxOffice,
          total_expenses: settlement.totalExpenses,
          total_to_artist: settlement.totalToArtist,
          drafted_at: formatTimestamp(settlement.draftedAt),
          submitted_at: formatTimestamp(settlement.submittedAt),
          review_started_at: formatTimestamp(settlement.reviewStartedAt),
          signed_at: formatTimestamp(settlement.signedAt),
          disputed_at: formatTimestamp(settlement.disputedAt),
          revised_at: formatTimestamp(settlement.revisedAt),
          finalized_at: formatTimestamp(settlement.finalizedAt),
          paid_at: formatTimestamp(settlement.paidAt),
          signoff_text: settlement.signoffText ?? null,
          notes: settlement.notes ?? null,
        }
      : null,
    recoups: (recoups as Recoup[]).map((r) => ({
      category: r.category,
      label: r.label,
      amount: r.amount,
      status: r.status,
    })),
  };
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not set in .env.local" },
      { status: 500 }
    );
  }

  const data = await getShowById(id);
  if (!data) {
    return NextResponse.json({ error: "Show not found" }, { status: 404 });
  }
  if (!data.settlement) {
    return NextResponse.json(
      { error: "This show has no settlement record yet." },
      { status: 400 }
    );
  }

  const context = buildContext(data);

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
          content: `Analyze the following settlement record. Return only the JSON object specified by the schema.\n\n${JSON.stringify(
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
