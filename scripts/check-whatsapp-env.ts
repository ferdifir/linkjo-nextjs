import { existsSync } from "fs"
import { dirname } from "path"
import { maskPhone } from "@/lib/logger"
import { whatsappProvider } from "@/lib/whatsapp-provider"
import { whatsappStatusPath } from "@/lib/whatsapp-status"

const provider = whatsappProvider()
const sharedDir = process.env.WHATSAPP_SHARED_DIR || "(not set)"
const authDir = process.env.WHATSAPP_BAILEYS_AUTH_DIR ||
  (process.env.WHATSAPP_SHARED_DIR ? `${process.env.WHATSAPP_SHARED_DIR}/baileys-auth` : ".baileys-auth")
const statusPath = whatsappStatusPath()

console.log(JSON.stringify({
  provider,
  whatsapp_number: maskPhone(process.env.WHATSAPP_NUMBER),
  next_public_whatsapp_number: maskPhone(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER),
  fonnte_number: maskPhone(process.env.FONNTE_WHATSAPP_NUMBER),
  baileys: {
    shared_dir: sharedDir,
    auth_dir: authDir,
    status_path: statusPath,
    auth_dir_exists: existsSync(authDir),
    status_dir_exists: existsSync(dirname(statusPath)),
  },
}, null, 2))
