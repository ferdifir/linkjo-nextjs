"use client"

import type { ReactNode } from "react"
import { MessageSquareText } from "lucide-react"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  missingTemplateVariables,
  requiredTemplateVariables,
  TEMPLATE_LABELS,
  type MessageTemplate,
} from "@/lib/message-templates"

export function MessageTemplatesEditor({
  value,
  onChange,
  renderActions,
  className,
}: {
  value: MessageTemplate[]
  onChange: (value: MessageTemplate[]) => void
  renderActions?: (template: MessageTemplate) => ReactNode
  className?: string
}) {
  function setTemplate(key: string, nextValue: string) {
    onChange(value.map((template) => (
      template.key === key ? { ...template, value: nextValue } : template
    )))
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-start gap-2">
        <MessageSquareText className="mt-0.5 size-4 text-emerald-400" />
        <div className="space-y-1">
          <Label className="text-xs font-medium text-zinc-400">Template Pesan</Label>
          <p className="max-w-2xl text-[10px] leading-relaxed text-zinc-600">
            Teks dalam kurung kurawal adalah data dinamis dari sistem. Jangan ubah atau hapus bagian seperti {"{no}"}, {"{service}"}, {"{scheduled_at}"}, dan {"{public_token}"}; silakan ubah kalimat lain di sekitarnya.
          </p>
        </div>
      </div>

      <div className="grid gap-3">
        {value.map((template) => {
          const variables = requiredTemplateVariables(template.key)
          const missing = missingTemplateVariables(template.key, template.value)

          return (
            <div key={template.key} className="space-y-2 rounded-lg border border-white/5 bg-zinc-950/40 px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="text-xs font-medium text-zinc-300">
                  {TEMPLATE_LABELS[template.key] || template.key}
                </Label>
                <div className="flex flex-wrap items-center gap-1.5">
                  {variables.map((variable) => (
                    <span
                      key={variable}
                      className={cn(
                        "rounded border px-1.5 py-0.5 font-mono text-[10px]",
                        missing.includes(variable)
                          ? "border-red-400/30 bg-red-500/10 text-red-300"
                          : "border-emerald-400/20 bg-emerald-500/10 text-emerald-300",
                      )}
                    >
                      {variable}
                    </span>
                  ))}
                  {renderActions?.(template)}
                </div>
              </div>
              <textarea
                value={template.value}
                onChange={(event) => setTemplate(template.key, event.target.value)}
                rows={3}
                className="min-h-20 w-full resize-y rounded-lg border border-white/10 bg-zinc-950/60 px-3 py-2 text-sm leading-relaxed text-white outline-none placeholder:text-zinc-600 focus-visible:border-emerald-400/30 focus-visible:ring-3 focus-visible:ring-emerald-400/20"
              />
              {missing.length > 0 && (
                <p className="text-[10px] text-red-300">
                  Token dinamis wajib dipertahankan: {missing.join(", ")}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
