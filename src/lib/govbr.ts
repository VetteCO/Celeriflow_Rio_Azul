// Provider activation belongs to the identity integration release.
export const govbrConfigured = false;

export function govbrLoginUrl(_state: string): string {
  return "/login-govbr";
}
