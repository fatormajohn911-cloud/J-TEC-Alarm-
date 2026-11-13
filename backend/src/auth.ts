import { SignJWT, jwtVerify } from 'jose';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value.trim());
}

function getSigningKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signInstallToken(
  installId: string,
  secret: string
): Promise<string> {
  return await new SignJWT({ installId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(installId)
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getSigningKey(secret));
}

export async function verifyBearerToken(
  authHeader: string | undefined,
  secret: string
): Promise<{ installId: string } | null> {
  if (!authHeader || typeof authHeader !== 'string') return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSigningKey(secret), {
      algorithms: ['HS256'],
    });
    const installId =
      typeof payload.installId === 'string'
        ? payload.installId
        : typeof payload.sub === 'string'
        ? payload.sub
        : '';
    if (!isValidUuid(installId)) return null;
    return { installId };
  } catch {
    return null;
  }
}
