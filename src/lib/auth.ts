export const COOKIE = 'abod_session';

// The session cookie holds a hash of DASH_PASSWORD, so it cannot be forged without the password and
// changing the password signs everyone out. Web Crypto, so it runs in the proxy and in route handlers.
export async function sessionToken(password: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`abod-session:${password}`));
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
}
