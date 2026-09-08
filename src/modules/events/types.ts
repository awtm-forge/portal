/** The moments anything might want to react to. ADR 0006. */
export type EventType =
  | "project.created"
  | "project.link_emailed"
  | "project.cancelled"
  | "intake.submitted"
  | "intake.overridden"
  | "agreement.sent"
  | "agreement.note"
  | "agreement.agreed"
  | "update.sent"
  | "project.kickoff"
  | "invoice.issued"
  | "invoice.paid"
  | "review.opened"
  | "review.changes_requested"
  | "delivery.signed_off"
  | "thanks.sent"
  | "referral.forgotten"
  | "day30.approved"
  | "enquiry.received";

/**
 * Payloads carry only what a subscriber needs to write a message. They are
 * built from serialized views, so an internal amount has no way in: see
 * modules/serializers and ADR 0009.
 */
export type ActivityPayload = Record<string, string | number | boolean | null>;

export type Activity = {
  type: EventType;
  projectId: string | null;
  actor: string;
  payload: ActivityPayload;
};
