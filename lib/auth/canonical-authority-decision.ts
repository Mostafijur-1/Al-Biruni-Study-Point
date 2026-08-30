export function selectTeacherAuthorityDecision(input: {
  legacyAllowed: boolean;
  canonicalAllowed: boolean;
  canonicalAuthorityEnabled: boolean;
}) {
  return {
    allowed: input.canonicalAuthorityEnabled ? input.canonicalAllowed : input.legacyAllowed,
    authority: input.canonicalAuthorityEnabled ? "canonical" : "legacy",
    shadowMismatch: input.legacyAllowed !== input.canonicalAllowed,
  } as const;
}
