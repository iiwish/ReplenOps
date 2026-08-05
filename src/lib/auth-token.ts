import { randomUUID } from 'node:crypto'
import { SignJWT, jwtVerify } from 'jose'
import { z } from 'zod'
import { getJwtSecret } from './jwt-secret'

const JWT_ALGORITHM = 'HS256'
const JWT_ISSUER = 'replenops'
const JWT_AUDIENCE = 'replenops-app'

export type TokenUse = 'access' | 'refresh'

const authTokenClaimsSchema = z.object({
  userId: z.string().min(1),
  username: z.string().min(1),
  sessionVersion: z.number().int().nonnegative(),
  sessionId: z.string().min(1),
  tokenUse: z.enum(['access', 'refresh']),
  sub: z.string().min(1),
  jti: z.string().min(1),
})

export interface AuthTokenSubject {
  userId: string
  username: string
  sessionVersion: number
  sessionId: string
}

export type AuthTokenClaims = z.infer<typeof authTokenClaimsSchema>

export async function signAuthToken(
  subject: AuthTokenSubject,
  tokenUse: TokenUse,
  expiresInSeconds: number,
  tokenId: string = randomUUID()
): Promise<string> {
  return new SignJWT({
    userId: subject.userId,
    username: subject.username,
    sessionVersion: subject.sessionVersion,
    sessionId: subject.sessionId,
    tokenUse,
  })
    .setProtectedHeader({ alg: JWT_ALGORITHM, typ: 'JWT' })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setSubject(subject.userId)
    .setJti(tokenId)
    .setIssuedAt()
    .setExpirationTime(`${expiresInSeconds}s`)
    .sign(getJwtSecret())
}

export async function verifyAuthTokenClaims(
  token: string,
  expectedUse: TokenUse
): Promise<AuthTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      algorithms: [JWT_ALGORITHM],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    })
    const parsed = authTokenClaimsSchema.safeParse(payload)

    if (!parsed.success || parsed.data.tokenUse !== expectedUse) {
      return null
    }

    if (parsed.data.sub !== parsed.data.userId) {
      return null
    }

    return parsed.data
  } catch {
    return null
  }
}
