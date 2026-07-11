import { isFonnteReady } from '@/lib/fonnte'

export async function GET() {
  return Response.json({ connected: isFonnteReady(), provider: 'fonnte' })
}
