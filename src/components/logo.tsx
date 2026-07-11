type LogoProps = {
  className?: string
}

export function LogoMark({ className }: LogoProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="48" height="48" rx="14" fill="url(#logo-mark-bg)" />
      <g transform="rotate(-35 24 24)">
        <rect
          x="12"
          y="16"
          width="24"
          height="16"
          rx="8"
          stroke="#052018"
          strokeWidth="6"
        />
        <path d="M18 24h12" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.9" />
      </g>
      <defs>
        <linearGradient id="logo-mark-bg" x1="8" y1="5" x2="40" y2="43" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6EE7B7" />
          <stop offset="0.55" stopColor="#10B981" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export function LogoLockup({ className }: LogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <LogoMark className="size-9 shrink-0 drop-shadow-[0_10px_20px_rgba(16,185,129,0.2)]" />
      <div className="flex flex-col">
        <span className="text-lg font-bold leading-none tracking-tight text-white">linkjo</span>
        <span className="mt-0.5 font-mono text-[10px] font-medium uppercase tracking-widest text-emerald-400">
          queue.ai
        </span>
      </div>
    </div>
  )
}
