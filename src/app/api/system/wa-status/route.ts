import { readWhatsappStatus } from "@/lib/whatsapp-status"

export async function GET() {
  return Response.json(await readWhatsappStatus())
}
