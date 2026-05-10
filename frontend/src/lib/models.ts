export interface ModelTheme {
  label: string
  initial: string
  color: string
  bg: string
  border: string
}

const THEMES: Record<string, ModelTheme> = {
  "llama-3.1-8b":   { label: "Llama 3.1",   initial: "L", color: "#047857", bg: "#ecfdf5", border: "#a7f3d0" },
  "qwen2.5-7b":     { label: "Qwen 2.5",    initial: "Q", color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" },
  "mistral-7b":     { label: "Mistral",     initial: "M", color: "#be185d", bg: "#fdf2f8", border: "#fbcfe8" },
  "deepseek-r1-8b": { label: "DeepSeek R1", initial: "D", color: "#b45309", bg: "#fffbeb", border: "#fde68a" },
  curator:          { label: "Curator",     initial: "C", color: "#374151", bg: "#f9fafb", border: "#e5e7eb" },
}
const FALLBACK: ModelTheme = { label: "Model", initial: "?", color: "#6b7280", bg: "#f9fafb", border: "#e5e7eb" }

export function modelTheme(id: string): ModelTheme {
  return THEMES[id] ?? FALLBACK
}
