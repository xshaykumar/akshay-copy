export function createSecretKeyFetch(secretKey: string): typeof fetch {
  return async (input, init) => {
    const headers = new Headers(init?.headers);
    if (
      secretKey.startsWith("sb_secret_") &&
      headers.get("Authorization") === `Bearer ${secretKey}`
    ) {
      headers.delete("Authorization");
    }
    return fetch(input, { ...init, headers });
  };
}
