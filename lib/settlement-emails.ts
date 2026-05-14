export type EmailIntent =
  | "send_for_review"
  | "follow_up_payment"
  | "confirm_recoup"
  | "thank_you"
  | "custom";

export const EMAIL_INTENT_LABELS: Record<EmailIntent, string> = {
  send_for_review: "Send settlement for review",
  follow_up_payment: "Follow up on payment",
  confirm_recoup: "Confirm a recoup interpretation",
  thank_you: "Thank-you / close-out",
  custom: "Custom (you describe it)",
};

export const EMAIL_INTENT_HINT: Record<EmailIntent, string> = {
  send_for_review:
    "Mariana wants the artist team to review the settlement line items.",
  follow_up_payment:
    "Settlement is signed but payment hasn't moved. Polite chase.",
  confirm_recoup:
    "There's a recoup line that needs clarification before signing.",
  thank_you:
    "Settlement is paid and done. Quick thank-you that keeps the relationship warm.",
  custom: "Mariana describes her own intent.",
};

export type EmailRecord = {
  id: string;
  recipient_name: string;
  recipient_email?: string;
  subject: string;
  body: string;
  intent: EmailIntent;
  drafted_by_ai: boolean;
  sent_at: string;
};

export function parseEmails(json: string | null): EmailRecord[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (e): e is EmailRecord =>
          e &&
          typeof e === "object" &&
          typeof e.id === "string" &&
          typeof e.subject === "string" &&
          typeof e.body === "string" &&
          typeof e.sent_at === "string"
      );
    }
  } catch {
    // ignore
  }
  return [];
}
