import { clearTokenCookie } from '@/lib/auth'

export async function POST() {
  const res = Response.json({ success: true })
  clearTokenCookie(res)
  return res
}
