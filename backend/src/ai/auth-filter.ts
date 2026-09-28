export type AiMetadataFilter = {
  authorizedUsers: Record<string, true>;
  authorizedUserVersions: Record<string, number>;
};

/**
 * Builds the authorization predicate used by vector retrieval.
 * Admins intentionally have no metadata restriction because their canonical
 * application role already grants access to all tenant data in this app.
 */
export function buildAuthorizedMetadataFilter(
  userId: number,
  role: 'ADMIN' | 'INTERVIEWER',
  aiAccessVersion: number,
): AiMetadataFilter | undefined {
  if (role === 'ADMIN') return undefined;
  return {
    authorizedUsers: { [String(userId)]: true },
    authorizedUserVersions: { [String(userId)]: aiAccessVersion },
  };
}
