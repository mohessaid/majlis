import * as React from "react";
import { twMerge } from "tailwind-merge";
import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Button ──────────────────────────────────────────────────────────────────
type BtnVariant = "primary" | "secondary" | "ghost" | "danger";
type BtnSize = "sm" | "md" | "lg";

const btnBase = "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-40 cursor-pointer select-none";
const btnVariants: Record<BtnVariant, string> = {
  primary:   "bg-gray-900 text-white hover:bg-gray-700",
  secondary: "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300",
  ghost:     "text-gray-500 hover:text-gray-900 hover:bg-gray-100",
  danger:    "text-red-600 hover:text-white hover:bg-red-600 border border-red-200 hover:border-red-600",
};
const btnSizes: Record<BtnSize, string> = {
  sm:  "h-7 px-3 text-xs",
  md:  "h-8 px-3.5 text-sm",
  lg:  "h-10 px-5 text-sm",
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: BtnSize;
}
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button ref={ref} className={cn(btnBase, btnVariants[variant], btnSizes[size], className)} {...props} />
  )
);
Button.displayName = "Button";

// ── Card ────────────────────────────────────────────────────────────────────
export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border border-gray-100 bg-white", className)} {...props}>{children}</div>;
}

// ── Textarea ────────────────────────────────────────────────────────────────
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(
      "w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none transition-colors",
      className
    )} {...props} />
  )
);
Textarea.displayName = "Textarea";

// ── Spinner ──────────────────────────────────────────────────────────────────
export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("animate-spin", className)} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ── Cap toggle ───────────────────────────────────────────────────────────────
export function CapToggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
        checked ? "border-blue-200 bg-blue-50 text-blue-700" : "border-gray-200 bg-white text-gray-400 hover:text-gray-600"
      )}
    >{label}</button>
  );
}

// ── Score bar ─────────────────────────────────────────────────────────────────
export function ScoreBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const [trackColor, barColor] = score >= 0.7 ? ["#dcfce7", "#16a34a"] : score >= 0.5 ? ["#fef9c3", "#ca8a04"] : ["#fee2e2", "#dc2626"];
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1 flex-1 rounded-full overflow-hidden" style={{ background: trackColor }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: barColor }} />
      </div>
      <span className="w-7 text-right text-[11px] font-medium tabular-nums" style={{ color: barColor }}>{pct}%</span>
    </div>
  );
}

// ── Model config ─────────────────────────────────────────────────────────────
interface ModelTheme { label: string; initial: string; text: string; bg: string; border: string; }

const MODEL_THEME: Record<string, ModelTheme> = {
  "llama-3.1-8b":    { label: "Llama 3.1",  initial: "L", text: "#047857", bg: "#ecfdf5", border: "#a7f3d0" },
  "qwen2.5-7b":      { label: "Qwen 2.5",   initial: "Q", text: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" },
  "mistral-7b":      { label: "Mistral",    initial: "M", text: "#be185d", bg: "#fdf2f8", border: "#fbcfe8" },
  "deepseek-r1-8b":  { label: "DeepSeek",   initial: "D", text: "#b45309", bg: "#fffbeb", border: "#fde68a" },
  curator:           { label: "Curator",    initial: "C", text: "#374151", bg: "#f9fafb", border: "#e5e7eb" },
};
const FALLBACK: ModelTheme = { label: "Model", initial: "?", text: "#6b7280", bg: "#f9fafb", border: "#e5e7eb" };

export function modelTheme(id: string): ModelTheme { return MODEL_THEME[id] ?? FALLBACK; }

export function ModelAvatar({ modelId, size = "sm" }: { modelId: string; size?: "xs" | "sm" | "md" }) {
  const t = modelTheme(modelId);
  const dim = { xs: "h-5 w-5 text-[10px]", sm: "h-7 w-7 text-xs", md: "h-9 w-9 text-sm" }[size];
  return (
    <div className={cn("rounded-lg flex-shrink-0 flex items-center justify-center font-bold border", dim)}
      style={{ background: t.bg, color: t.text, borderColor: t.border }}>
      {t.initial}
    </div>
  );
}

export function ModelTag({ modelId }: { modelId: string }) {
  const t = modelTheme(modelId);
  return (
    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold"
      style={{ background: t.bg, color: t.text, borderColor: t.border }}>
      {t.label}
    </span>
  );
}
