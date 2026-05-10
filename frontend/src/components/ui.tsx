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
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4c6ef5] focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-40 cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-[#4c6ef5] text-white hover:bg-[#4263eb]",
        secondary: "bg-white text-[#343a40] border border-[#dee2e6] hover:bg-[#f8f9fa] hover:border-[#ced4da]",
        ghost: "text-[#868e96] hover:text-[#495057] hover:bg-[#f1f3f5]",
        danger: "text-[#e03131] hover:text-white hover:bg-[#e03131]",
        outline: "border border-[#dee2e6] text-[#343a40] hover:bg-[#f8f9fa]",
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

// ── Card ────────────────────────────────────────────────────────────────────
export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-xl border border-[#e9ecef] bg-white", className)} {...props}>
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
        "w-full resize-none rounded-xl border border-[#dee2e6] bg-white px-4 py-3 text-sm text-[#212529] placeholder:text-[#ced4da] focus:border-[#4c6ef5] focus:outline-none focus:ring-2 focus:ring-[#4c6ef5]/20 transition-all",
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
          ? "border-[#bac8ff] bg-[#edf2ff] text-[#4263eb]"
          : "border-[#dee2e6] bg-white text-[#adb5bd] hover:text-[#868e96] hover:border-[#ced4da]"
      )}
      type="button"
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", checked ? "bg-[#4263eb]" : "bg-[#ced4da]")} />
      {label}
    </button>
  );
}

// ── ScoreBar ─────────────────────────────────────────────────────────────────
export function ScoreBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = score >= 0.7 ? "#2f9e44" : score >= 0.5 ? "#e67700" : "#e03131";
  const trackColor = score >= 0.7 ? "#d3f9d8" : score >= 0.5 ? "#fff3bf" : "#ffe3e3";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full overflow-hidden" style={{ background: trackColor }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-medium tabular-nums" style={{ color }}>{pct}%</span>
    </div>
  );
}

// ── ModelDot + colors ─────────────────────────────────────────────────────────
const MODEL_COLORS: Record<string, string> = {
  "llama-3.1-8b": "#0ca678",
  "qwen2.5-7b": "#228be6",
  "mistral-7b": "#e64980",
  "deepseek-r1-8b": "#fd7e14",
  curator: "#7950f2",
};
export function modelColor(modelId: string) {
  return MODEL_COLORS[modelId] ?? "#adb5bd";
}
export function modelBg(modelId: string) {
  const bgMap: Record<string, string> = {
    "llama-3.1-8b": "#e6fcf5",
    "qwen2.5-7b": "#e7f5ff",
    "mistral-7b": "#fff0f6",
    "deepseek-r1-8b": "#fff4e6",
    curator: "#f3f0ff",
  };
  return bgMap[modelId] ?? "#f8f9fa";
}
export function ModelDot({ modelId, size = 8 }: { modelId: string; size?: number }) {
  return <span className="rounded-full inline-block flex-shrink-0" style={{ width: size, height: size, background: modelColor(modelId) }} />;
}
