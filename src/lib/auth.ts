import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { randomInt } from 'crypto'

function getJwtSecret() {
  const value = process.env.JWT_SECRET
  if (!value && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be configured in production')
  }
  return new TextEncoder().encode(value || 'test-secret-change-in-production')
}

const secret = getJwtSecret()
const COOKIE_NAME = 'linkjo_token'

export interface JwtClaims {
  user_id: string
  tenant_id: string
  phone: string
}

export async function signToken(claims: JwtClaims): Promise<string> {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .setIssuedAt()
    .sign(secret)
}

export async function verifyToken(token: string): Promise<JwtClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret)
    return {
      user_id: payload.user_id as string,
      tenant_id: payload.tenant_id as string,
      phone: payload.phone as string,
    }
  } catch {
    return null
  }
}

export async function getClaims(): Promise<JwtClaims | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifyToken(token)
}

export async function getRequiredClaims(): Promise<JwtClaims> {
  const claims = await getClaims()
  if (!claims) throw new Error('Unauthorized')
  return claims
}

export async function withRequiredClaims(
  handler: (claims: JwtClaims) => Promise<Response> | Response,
): Promise<Response> {
  const claims = await getClaims()
  if (!claims) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return handler(claims)
}

export function setTokenCookie(res: Response, token: string) {
  res.headers.set(
    'Set-Cookie',
    `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`,
  )
}

export function clearTokenCookie(res: Response) {
  res.headers.set(
    'Set-Cookie',
    `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
  )
}

export function generateOTP(): string {
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += randomInt(0, 10).toString()
  }
  return code
}
