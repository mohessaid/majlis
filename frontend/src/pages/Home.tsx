import { useNavigate } from "react-router-dom"
import { useAuth, SignInButton } from "@clerk/clerk-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { modelTheme } from "@/lib/models"

const MODEL_IDS = ["llama-3.1-8b", "qwen2.5-7b", "mistral-7b", "deepseek-r1-8b"]

const HOW = [
  { n: "01", title: "Ask anything", body: "Write your question. Technical, philosophical, factual — anything." },
  { n: "02", title: "Curator picks models", body: "A dedicated AI analyzes your question and selects the best models based on topic and reputation." },
  { n: "03", title: "You're the moderator", body: "Models respond in parallel. Go deeper with the best, dismiss the rest. Their reputation adapts." },
]

const DEMO_QUESTION = "What's the best database for a real-time chat app at scale?"
const DEMO_REPLIES = [
  { id: "llama-3.1-8b",   text: "Redis with pub/sub — sub-millisecond latency, built-in message queues, and native support for fan-out patterns. Pair with Postgres for durability." },
  { id: "qwen2.5-7b",     text: "Firestore shines for real-time listeners across devices, but Redis wins on raw throughput. Architecture choice depends on expected concurrent connections." },
]

export function Home() {
  const { isSignedIn } = useAuth()
  const navigate = useNavigate()

  function CTA({ label, large }: { label: string; large?: boolean }) {
    const size = large ? "lg" as const : "default" as const
    if (isSignedIn) {
      return <Button size={size} onClick={() => navigate("/app")}>{label}</Button>
    }
    return (
      <SignInButton mode="modal">
        <Button size={size}>{label}</Button>
      </SignInButton>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* Nav */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 h-14">
          <span className="font-semibold tracking-tight">Majlis</span>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="gap-1.5 hidden sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              4 models live
            </Badge>
            <CTA label={isSignedIn ? "Open App →" : "Sign in"} />
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 pt-24 pb-16 text-center">
        <Badge variant="secondary" className="mb-6">Multi-AI Discussion Arena</Badge>
        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
          Multiple AI minds.<br />One answer you can trust.
        </h1>
        <p className="text-lg text-muted-foreground max-w-lg mx-auto mb-10 leading-relaxed">
          Ask once — four models respond in parallel. Go deeper with the best, dismiss the rest. Their reputation adapts.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <CTA label="Start for Free →" large />
          <Button variant="outline" size="lg" asChild>
            <a href="#how">How it works</a>
          </Button>
        </div>
      </section>

      {/* Product preview */}
      <section className="mx-auto max-w-4xl px-6 pb-24">
        <div className="overflow-hidden rounded-xl border shadow-md">
          {/* Chrome bar */}
          <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-3">
            <div className="flex gap-1.5">
              <span className="h-3 w-3 rounded-full bg-red-400" />
              <span className="h-3 w-3 rounded-full bg-yellow-400" />
              <span className="h-3 w-3 rounded-full bg-green-400" />
            </div>
            <div className="mx-auto flex items-center gap-1.5 rounded-md border bg-background px-3 py-1 text-xs text-muted-foreground">
              majlis.mohessaid.com
            </div>
          </div>

          {/* App layout */}
          <div className="flex min-h-[280px] divide-x">
            {/* Sidebar */}
            <div className="w-40 shrink-0 bg-muted/30 p-4">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Models</p>
              <div className="space-y-2">
                {MODEL_IDS.map((id) => {
                  const t = modelTheme(id)
                  return (
                    <div key={id} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                      <span className="text-xs font-medium" style={{ color: t.color }}>{t.label}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Thread */}
            <div className="flex-1 space-y-4 p-5">
              {/* User message */}
              <div className="flex justify-end">
                <div className="max-w-sm rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5">
                  <p className="text-sm text-primary-foreground">{DEMO_QUESTION}</p>
                </div>
              </div>

              {/* AI replies */}
              {DEMO_REPLIES.map((reply) => {
                const t = modelTheme(reply.id)
                return (
                  <div key={reply.id} className="flex gap-3">
                    <div className="h-7 w-7 shrink-0 rounded-lg border text-xs font-bold flex items-center justify-center"
                      style={{ background: t.bg, color: t.color, borderColor: t.border }}>
                      {t.initial}
                    </div>
                    <div className="flex-1">
                      <Badge variant="outline" className="mb-1.5 text-[11px]"
                        style={{ background: t.bg, color: t.color, borderColor: t.border }}>
                        {t.label}
                      </Badge>
                      <div className="rounded-xl border bg-card px-4 py-2.5 text-sm text-card-foreground shadow-xs">
                        {reply.text}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      <Separator />

      {/* How it works */}
      <section id="how" className="bg-muted/30 py-24 px-6">
        <div className="mx-auto max-w-3xl">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">How it works</p>
            <h2 className="text-3xl font-bold">Three steps to a better answer</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            {HOW.map((s) => (
              <div key={s.n} className="rounded-xl border bg-card p-6">
                <span className="text-3xl font-bold text-muted-foreground/30 block mb-3">{s.n}</span>
                <h3 className="font-semibold mb-2 text-sm">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Separator />

      {/* Models */}
      <section className="py-24 px-6">
        <div className="mx-auto max-w-3xl">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">The lineup</p>
            <h2 className="text-3xl font-bold">Four models, one room</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { id: "llama-3.1-8b",   desc: "Meta's open-source flagship" },
              { id: "qwen2.5-7b",     desc: "Alibaba's reasoning model" },
              { id: "mistral-7b",     desc: "European powerhouse" },
              { id: "deepseek-r1-8b", desc: "Chinese reasoning specialist" },
            ].map((m) => {
              const t = modelTheme(m.id)
              return (
                <div key={m.id} className="flex items-center gap-4 rounded-xl border bg-card p-5">
                  <div className="h-11 w-11 shrink-0 rounded-xl border font-bold text-base flex items-center justify-center"
                    style={{ background: t.bg, color: t.color, borderColor: t.border }}>
                    {t.initial}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{t.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{m.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* CTA section */}
      <section className="bg-primary py-24 px-6 text-center">
        <h2 className="text-3xl font-bold text-primary-foreground mb-3">Ready to ask better questions?</h2>
        <p className="text-primary-foreground/70 mb-8 text-sm">Free · No credit card · Four models waiting</p>
        <CTA label="Get Started for Free →" large />
      </section>

      <footer className="border-t py-6 text-center">
        <p className="text-xs text-muted-foreground">Majlis · AMD Developer Cloud Hackathon 2026</p>
      </footer>
    </div>
  )
}
