import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { twMerge } from "tailwind-merge";
import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Button ──────────────────────────────────────────────────────────────────
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40 cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-indigo-500 text-white hover:bg-indigo-400",
        secondary: "bg-[#1a1a1a] text-[#fafafa] border border-[#262626] hover:bg-[#222]",
        ghost: "text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#1a1a1a]",
        danger: "text-[#ef4444] hover:text-[#fafafa] hover:bg-[#ef444420]",
        outline: "border border-[#262626] text-[#fafafa] hover:bg-[#1a1a1a]",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-7 px-3 text-xs",
        lg: "h-11 px-6 text-base",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

// ── Badge ───────────────────────────────────────────────────────────────────
export function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", className)}>
      {children}
    </span>
  );
}

// ── Card ────────────────────────────────────────────────────────────────────
export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-xl border border-[#262626] bg-[#111111]", className)} {...props}>
      {children}
    </div>
  );
}

// ── Textarea ────────────────────────────────────────────────────────────────
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "w-full resize-none rounded-xl border border-[#262626] bg-[#111] px-4 py-3 text-sm text-[#fafafa] placeholder:text-[#52525b] focus:border-[#6366f1] focus:outline-none transition-colors",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

// ── Spinner ──────────────────────────────────────────────────────────────────
export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("animate-spin", className)} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ── Toggle ───────────────────────────────────────────────────────────────────
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors border",
        checked
          ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-400"
          : "border-[#262626] bg-transparent text-[#52525b] hover:text-[#a1a1aa]"
      )}
      type="button"
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", checked ? "bg-indigo-400" : "bg-[#52525b]")} />
      {label}
    </button>
  );
}

// ── ScoreBar ─────────────────────────────────────────────────────────────────
export function ScoreBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = score >= 0.7 ? "#22c55e" : score >= 0.5 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 flex-1 rounded-full bg-[#262626] overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs tabular-nums" style={{ color }}>{pct}%</span>
    </div>
  );
}

// ── ModelDot ──────────────────────────────────────────────────────────────────
const MODEL_COLORS: Record<string, string> = {
  "llama-3.1-8b": "#4ade80",
  "qwen2.5-7b": "#60a5fa",
  "mistral-7b": "#f472b6",
  "deepseek-r1-8b": "#fb923c",
  curator: "#a78bfa",
};
export function modelColor(modelId: string) {
  return MODEL_COLORS[modelId] ?? "#a1a1aa";
}
export function ModelDot({ modelId, size = 8 }: { modelId: string; size?: number }) {
  return <span className="rounded-full inline-block flex-shrink-0" style={{ width: size, height: size, background: modelColor(modelId) }} />;
}
