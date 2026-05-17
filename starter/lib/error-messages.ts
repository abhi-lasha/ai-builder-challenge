/**
 * Translates raw API error codes into human-readable messages.
 * Branch on `code`, never on the message string — codes are stable, messages aren't.
 *
 * Single responsibility: this module owns all user-facing error copy for API errors.
 */

export type ErrorContext = {
  existingSerial?: string;
  providedSerial?: string;
  currentState?: string;
  currentCustodian?: string;
};

export function getApiErrorMessage(
  code: string,
  context?: ErrorContext,
): { title: string; detail: string; action: string } {
  switch (code) {
    case "and_match_failed":
      return {
        title: "Serial number mismatch",
        detail: context?.existingSerial && context?.providedSerial
          ? `This tag is registered to serial ${context.existingSerial}, but you entered serial ${context.providedSerial}.`
          : "The serial number doesn't match what's registered under this tag.",
        action: "Check the physical label. If the asset is genuinely different, contact your manager.",
      };

    case "invalid_transition":
      return {
        title: "Action not allowed",
        detail: context?.currentState
          ? `This asset is currently ${formatState(context.currentState)} — you can't perform this action from that state.`
          : "This asset's current state doesn't allow this action.",
        action: "Check the asset's current state and choose the correct workflow.",
      };

    case "incomplete_deploy_location":
      return {
        title: "Incomplete location",
        detail: "Deploy requires a full location: site, room, rack, and rack unit (RU).",
        action: "Re-scan the location barcode or fill in the missing fields manually.",
      };

    case "unknown_asset":
      return {
        title: "Asset not found",
        detail: "No asset is registered with this tag.",
        action: "Check the barcode, or use Receive if this is a new asset.",
      };

    case "invalid_tag_format":
      return {
        title: "Invalid tag format",
        detail: "Asset tags must start with C followed by exactly 7 digits (e.g. C0001234).",
        action: "Re-scan or type the tag carefully.",
      };

    case "same_custodian":
      return {
        title: "Already your asset",
        detail: context?.currentCustodian
          ? `${context.currentCustodian} is already the custodian of this asset.`
          : "This person is already the custodian of this asset.",
        action: "Scan a different badge.",
      };

    case "invalid_location":
      return {
        title: "Invalid location",
        detail: "The location barcode couldn't be parsed correctly.",
        action: "Re-scan the location barcode or enter the fields manually.",
      };

    case "invalid_payload":
      return {
        title: "Invalid data",
        detail: "The request body didn't pass validation.",
        action: "Check all fields are filled in correctly and try again.",
      };

    case "missing_token":
      return {
        title: "System configuration error",
        detail: "The server is not configured correctly and cannot process requests.",
        action: "Please contact your IT administrator.",
      };

    case "not_implemented":
      return {
        title: "Feature unavailable",
        detail: "This action is not currently supported.",
        action: "Contact your manager if you need this capability.",
      };

    case "rate_limit_exceeded":
    case "too_many_requests":
      return {
        title: "Too many requests",
        detail: "You've made too many requests in a short period. Please wait a moment.",
        action: "Wait 30–60 seconds and try again.",
      };

    case "internal_error":
      return {
        title: "Server error",
        detail: "Something unexpected happened on the server.",
        action: "Try again. If it keeps happening, flag it to your manager.",
      };

    default:
      return {
        title: "Something went wrong",
        detail: "An unexpected error occurred. Your last action may not have been saved.",
        action: "Try again. If it keeps happening, contact your manager.",
      };
  }
}

/** Maps state machine values to human-readable labels. */
export function formatState(state: string): string {
  const map: Record<string, string> = {
    unreceived: "not yet received",
    received: "received — awaiting storage or deployment",
    stored: "in storage",
    in_service: "deployed and in service",
    rma_pending: "pending return to manufacturer (RMA)",
    disposed: "disposed",
  };
  return map[state] ?? state;
}

/** Maps event types to human-readable past-tense labels. */
export function formatEventType(eventType: string): string {
  const map: Record<string, string> = {
    receive: "Checked in",
    store: "Moved to storage",
    deploy: "Deployed to rack",
    rma_open: "Sent for repair (RMA)",
    rma_receive_back: "Returned from repair",
    dispose: "Disposed",
    duplicate_receive: "Check-in (duplicate — no change)",
    transfer_custody: "Custody transferred",
  };
  return map[eventType] ?? eventType;
}
