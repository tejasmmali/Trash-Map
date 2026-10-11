import "server-only";

export type AiProviderErrorReason =
  | "unsupported_model"
  | "model_not_found"
  | "auth"
  | "rate_limited"
  | "timeout"
  | "unavailable";

/** The provider call failed. `cause` holds the raw error for server logs only. */
export class AiProviderError extends Error {
  constructor(
    public readonly reason: AiProviderErrorReason,
    options?: { cause?: unknown },
  ) {
    super(`AI provider error: ${reason}`, options);
    this.name = "AiProviderError";
  }
}

/** The model answered, but not with output matching the expected schema. */
export class AiInvalidResponseError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AiInvalidResponseError";
  }
}
