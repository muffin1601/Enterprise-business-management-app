/**
 * High-entropy, URL-safe bearer token for invitation accept links.
 * 32 random bytes → base64url. Stored server-side and looked up by exact match
 * (UNIQUE on invitations.token); possession of the token is the authorization.
 */
export function generateToken(bytes = 32): string {
  const buf = new Uint8Array(bytes)
  crypto.getRandomValues(buf)
  let bin = ''
  for (const b of buf) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
