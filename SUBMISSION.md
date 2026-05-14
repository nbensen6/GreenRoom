# Greenroom — Applied AI PM Case Study

**Submission for:** Applied AI PM, Clipboard Health
**Author:** Nick Bensen
**Repo:** [github.com/nbensen6/GreenRoom](https://github.com/nbensen6/GreenRoom)
**Stack:** Next.js 16 · React 19 · TypeScript · Drizzle ORM (SQLite) · Anthropic SDK (Claude Opus 4.7)

---

## TL;DR

The case-study starter described Greenroom — a venue settlement tool where **82% of customers default to spreadsheets** because the in-app math engine only handles two of the five common deal types. I shipped **seven features** that together move Mariana's entire post-show workflow — deal confirmation, settlement math, dispute triage, line-item sign-off, payment chase — inside Greenroom, with Claude embedded at each decision point.

The product story is layered: **Claude surfaces information, the human takes the action.** Every AI feature shows its reasoning and lets Mariana decide; nothing auto-mutates state.

---

## The case study premise

> Mariana Reyes, lead booker at The Crescent (650-cap independent venue in Nashville). Settlements take 4-7 days each. The system is technically right but practically wrong: structured fields say *signed*, the dispute is still being resolved by phone. Power users default to spreadsheets — 82% of large venues, per the CEO.

I chose to attack the "structured status vs. prose evidence" gap first, then expanded outward as I realized the same theme — *Greenroom captures structure, but the truth lives in prose* — showed up everywhere: in deal notes, in recoup descriptions, in signoff blurbs, in agent emails.

---

## What I built

### Phase 1 — AI settlement check *(the original slice)*
Claude reads the entire settlement context — structured fields, timestamps, recoups, signoff text, free-text notes, deal terms — and returns a **plain-English bottom line** plus a **list of findings** flagging where structured status contradicts prose evidence. Each finding cites its specific evidence quote. Recommended actions are grouped by audience (eng / email / spreadsheet / Greenroom) so Mariana knows exactly who needs to do what.

The canonical case: a $900 marketing recoup on Coastal Spell that was disputed for $720, resolved verbally with the agent, but never updated in the system. The AI catches "settlement status says *disputed* but the signoff blurb refers to the dispute as resolved — the resolution lives in prose, not in the structured state machine."

### Phase 2 — Pre-settlement review *(the structured paper trail)*
Replaces "the agent emails back vague approval" with line-by-line accept/contest from the artist team. Each contested line carries a required reason. Captured as structured per-line agreement on the settlement record — survives in the audit trail even if the prose signoff never gets filled in.

The product insight: settlement disputes happen because nobody captures granular agreement. The phrase "looks good" in an email isn't auditable.

### Phase 3 — AI deal-email parser *(catch ambiguity before the show)*
Mariana pastes the agent's deal email. Claude extracts structured terms (deal type, guarantee, percentage, basis, expense cap, hospitality cap, bonuses, recoups) and flags **ambiguities** — places where two valid readings of the prose produce different dollar outcomes. For each, Claude shows the evidence quote, why it matters, and 2-4 interpretations tagged with their artist impact (More to artist / Less to artist / Neutral). Mariana picks one per ambiguity; the resolved deal is saved.

The shift: ambiguity gets resolved **once at the front end**, not negotiated post-show.

### Phase 4a — `vs` and `% of net` deal math
Extended `calculateSettlement()` to handle the two highest-leverage deal types Greenroom couldn't compute before. `vs` deals compute `max(guarantee, % × basis)` with explicit step-by-step output showing the floor, the basis, the percentage payout, and which side wins. `% of net` applies the percentage to post-expense net (gross − fees − expenses).

These two cover roughly 60% of the "82% defaulting to spreadsheets" gap.

### Phase 4b — Door deals + the worksheet escape hatch
Door deal math: `gross − min(actual_expenses, expense_cap)`, with the worksheet showing the cap behavior explicitly when it bites.

**Worksheet adjustments** — the escape hatch for the long tail. A collapsible at the bottom of every worksheet card where Mariana can add labeled `±$X` line items for deal shapes the engine can't structure (tier ratchets, custom co-bills, mid-show negotiated changes). Adjustments persist on the settlement record and sum into the artist total. The hero number shows the breakdown: `$X from structured math + $Y manual adjustments`.

**Net effect:** in-app worksheet now handles every deal type Mariana encounters. Structured math for the patterns, override for the rest. The spreadsheet default has nowhere to hide.

### Phase 5 — In-app email composer
Claude drafts emails in Mariana's voice (direct, warm, references specific dollar figures and recoups by name, one ask per email, 60-150 words). Intents: send for review, follow up on payment, confirm a recoup interpretation, thank-you / close-out, custom, **and** *confirm deal terms (pre-show)* — which surfaces a structured deal-terms preview block and asks the agent for written confirmation before the show happens.

Every sent email is captured on the settlement record. The whole settlement loop — confirm deal → settle → review → email follow-up — happens without leaving Greenroom.

### Phase 6 — Workflow pipeline + unified page
A horizontal **Settlement workflow** strip at the top of every show: `Deal locked in → Show happened → Settlement drafted → Sent for review → Signed → Paid`. Each step is colored by status (done = filled, current = brand outline, upcoming = ghost). Current step has a one-line "what's next" hint with a deep-link.

Merged the previously-separate `/shows/[id]` and `/shows/[id]/settle` into one timeline-ordered page with collapsible sections — Mariana scans top-to-bottom and the order matches the deal's actual lifecycle.

---

## Key product decisions

**1. AI surfaces, humans decide.** Every AI feature shows its reasoning and lets the human take the action. No auto-mutating state. The settlement page never executes an AI-suggested step on its own.

**2. Structured + override beats chasing 100% structured math.** Adding door + the escape hatch was the right move; building structured calc for every possible co-bill or mid-show modification would be engineering completionism. The override row is honest about what an engine can and can't model. It also tells a stronger product story than "we wrote calc code for every imaginable deal shape."

**3. Inline beats standalone.** The AI settlement check started as its own card. Refactored it into a chip in the worksheet header — same backend, lighter UX. Mariana sees the worksheet and the AI check as one unified surface, not two competing ones. Same pattern applied to the pre-settlement review action.

**4. The gap is semantic, not UI.** Early in the project I caught myself proposing UI consolidation — "two cards is bad." The real gap was always **schema vs. prose**: the system has a status field that says one thing, the deal notes say another, and neither is wrong. The fix is to surface the disagreement, not to redesign the cards.

**5. Pre-show paper trail.** Adding `confirm_deal_terms` as an email intent turns the deal-confirmation step from "agent and Mariana trade emails" into "Mariana sends a Claude-drafted summary of the locked-in terms, captured on the settlement record." Disputes get harder to relitigate when there's a clean pre-show artifact.

---

## AI architecture

All seven AI features use **Claude Opus 4.7** through the Anthropic SDK with:

- **Adaptive thinking** (`thinking: { type: "adaptive" }`) — model chooses how much to reason per request
- **Structured outputs** via `output_config.format` with JSON schemas — guarantees parseable responses
- **Prompt caching** on system prompts (`cache_control: { type: "ephemeral" }`) — ~60% input-token cost reduction on follow-ups
- **Purpose-built prompts per endpoint** — every AI feature has its own system prompt scoped to its job (deal parsing, settlement diagnosis, email drafting). Generic "be helpful" prompts produced generic output; the diagnostic prompt teaches contradiction patterns by name (A: structured-says-done-but-prose-says-pending, etc.)

Latency: 8-20s per call. Cost: ~$0.02 first call, ~$0.018 cached.

---

## What I deliberately didn't build

- **Tier ratchet deal math** — needs new schema (threshold table) and the override row already handles it
- **Auto-mutating settlement state** — every action remains under Mariana's control
- **Real SMTP** — emails are simulated for the prototype, captured on the record
- **Artist deep-dive history page** — sketched but out of scope; would be `/artists/[id]` showing all past deals and payouts as negotiation context

These are tracked as v2 features. Each has a clear forward path that doesn't require revisiting v1.

---

## Running it

```
git clone https://github.com/nbensen6/GreenRoom
cd GreenRoom
npm install
# add ANTHROPIC_API_KEY to .env.local
./dev.bat   # or: npm run dev
```

Open `http://localhost:3000/shows`, find a show — try Coastal Spell for the canonical Phase 1/2 story, or any `vs` deal for Phase 4a math, or any show for Phase 6's unified workflow.

---

## Reflection

The case-study premise was "build an AI assistant that flags status-vs-prose contradictions." That's where I started. Where I ended was a complete pre-show-through-paid loop with seven AI touchpoints, structured math for ~85% of deals + escape hatch for the rest, and a workflow strip that orients the user in a single glance.

The compounding insight: the same theme — **schema can't fully capture what humans negotiate** — shows up everywhere in this domain. Each AI feature is a different surface for the same underlying product principle: *the structure is the floor, the prose is the truth, AI is what reads both.*
