import { cn } from "@/lib/utils"
import { modelTheme } from "@/lib/models"

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("animate-spin", className)} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

export function CapToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
        checked
          ? "border-foreground bg-foreground text-background"
          : "border-border text-muted-foreground hover:border-foreground/40"
      )}
    >
      {label}
    </button>
  )
}

export function ScoreBar({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 flex-1 rounded-full bg-border overflow-hidden">
        <div
          className="h-full rounded-full bg-foreground/60 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground w-6 text-right">{pct}</span>
    </div>
  )
}

export function ModelAvatar({ modelId, size = "md" }: { modelId: string; size?: "xs" | "sm" | "md" | "lg" }) {
  const t = modelTheme(modelId)
  const sizeClass = {
    xs:  "h-4 w-4 text-[8px]",
    sm:  "h-6 w-6 text-[10px]",
    md:  "h-8 w-8 text-xs",
    lg:  "h-10 w-10 text-sm",
  }[size]
  return (
    <div
      className={cn("rounded-lg border font-bold flex items-center justify-center shrink-0", sizeClass)}
      style={{ background: t.bg, color: t.color, borderColor: t.border }}
    >
      {t.initial}
    </div>
  )
}

export function ModelTag({ modelId }: { modelId: string }) {
  const t = modelTheme(modelId)
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium"
      style={{ background: t.bg, color: t.color, borderColor: t.border }}
    >
      {t.initial} {t.label}
    </span>
  )
}
