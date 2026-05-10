import { useState, useEffect, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@clerk/clerk-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { modelTheme } from "@/lib/models"
import { Spinner, CapToggle, ScoreBar, ModelAvatar, ModelTag } from "@/components/helpers"
import { createRoom, addParticipant, listRooms, type CreateRoomResponse, type Recommendation, type RoomSummary } from "@/lib/api"

interface SelectedCaps { web_search: boolean; thinking: boolean; fast_mode: boolean }
interface Selection { model_id: string; display_name: string; caps: SelectedCaps; score: number; reason: string }

function fromRec(r: Recommendation): Selection {
  return { model_id: r.model_id, display_name: r.display_name, caps: r.suggested_capabilities, score: r.reputation_score, reason: r.reason }
}

const CAT_LABEL: Record<string, string> = {
  technology: "Tech", science: "Science", philosophy: "Philosophy",
  politics: "Politics", economics: "Economics", general: "General",
}

export function Landing() {
  const [q, setQ] = useState("")
  const [step, setStep] = useState<"idle" | "loading" | "selecting" | "starting">("idle")
  const [room, setRoom] = useState<CreateRoomResponse | null>(null)
  const [selections, setSelections] = useState<Selection[]>([])
  const [error, setError] = useState("")
  const [prevRooms, setPrevRooms] = useState<RoomSummary[]>([])
  const [roomsLoading, setRoomsLoading] = useState(true)
  const navigate = useNavigate()
  const { getToken } = useAuth()

  useEffect(() => {
    ;(async () => {
      try {
        const token = await getToken()
        const rooms = await listRooms(token ?? undefined)
        setPrevRooms(rooms)
      } catch { /* ignore */ }
      finally { setRoomsLoading(false) }
    })()
  }, [])

  async function analyze(e: FormEvent) {
    e.preventDefault()
    if (!q.trim()) return
    setStep("loading")
    setError("")
    try {
      const token = await getToken()
      const data = await createRoom(q.trim(), token ?? undefined)
      setRoom(data)
      setSelections(data.curator_recommendations.map(fromRec))
      setStep("selecting")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed — please try again")
      setStep("idle")
    }
  }

  async function start() {
    if (!room || selections.length === 0) return
    setStep("starting")
    try {
      const token = await getToken()
      await Promise.all(selections.map((s) => addParticipant(room.room_id, s.model_id, s.caps, token ?? undefined)))
      navigate(`/room/${room.room_id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start")
      setStep("selecting")
    }
  }

  function toggle(r: Recommendation) {
    setSelections((prev) => {
      const has = prev.find((s) => s.model_id === r.model_id)
      return has ? prev.filter((s) => s.model_id !== r.model_id) : [...prev, fromRec(r)]
    })
  }

  function setCap(id: string, cap: keyof SelectedCaps, val: boolean) {
    setSelections((prev) => prev.map((s) => s.model_id === id ? { ...s, caps: { ...s.caps, [cap]: val } } : s))
  }

  /* ─────────────────────────────────────── STEP 1: Question ── */
  if (step === "idle" || step === "loading") {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        {/* Nav */}
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-background/95 backdrop-blur px-6">
          <button onClick={() => navigate("/")} className="font-semibold hover:opacity-60 transition-opacity text-sm">
            Majlis
          </button>
          <Badge variant="outline" className="gap-1.5 text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />4 models online
          </Badge>
        </header>

        <div className="flex flex-1 flex-col">
          {/* Ask form */}
          <div className="flex flex-col items-center justify-center px-4 py-16">
            <div className="w-full max-w-xl">
              <h1 className="mb-1.5 text-2xl font-bold tracking-tight">What do you want to discuss?</h1>
              <p className="mb-8 text-sm text-muted-foreground">
                The Curator analyzes your question and recommends the best models.
              </p>
              <form onSubmit={analyze} className="space-y-3">
                <Textarea
                  rows={4}
                  placeholder="e.g. What's the best architecture for a multi-tenant SaaS app?"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  disabled={step === "loading"}
                  className="resize-none text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); analyze(e as unknown as FormEvent) }
                  }}
                />
                <Button type="submit" size="lg" className="w-full" disabled={!q.trim() || step === "loading"}>
                  {step === "loading"
                    ? <><Spinner className="mr-2 h-4 w-4" />Curator is analyzing…</>
                    : "Analyze & Select Models →"}
                </Button>
                {error && <p className="text-sm text-destructive">{error}</p>}
              </form>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Models:</span>
                {["llama-3.1-8b", "qwen2.5-7b", "mistral-7b", "deepseek-r1-8b"].map((id) => (
                  <ModelTag key={id} modelId={id} />
                ))}
              </div>
            </div>
          </div>

          {/* Previous rooms */}
          <Separator />
          <div className="bg-muted/20 px-4 py-8 sm:px-8">
            <div className="mx-auto max-w-xl">
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Your Discussions
              </p>
              {roomsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
                </div>
              ) : prevRooms.length === 0 ? (
                <p className="text-sm text-muted-foreground">No previous discussions yet.</p>
              ) : (
                <div className="space-y-2">
                  {prevRooms.slice(0, 8).map((r) => (
                    <button
                      key={r.room_id}
                      onClick={() => navigate(`/room/${r.room_id}`)}
                      className="group w-full flex items-center gap-4 rounded-xl border bg-card px-4 py-3.5 text-left hover:shadow-sm transition-all"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium group-hover:text-foreground">{r.question}</p>
                        <div className="mt-1 flex items-center gap-2.5">
                          {r.category && (
                            <span className="text-[11px] text-muted-foreground">{CAT_LABEL[r.category] ?? r.category}</span>
                          )}
                          <div className="flex items-center gap-1">
                            {r.models.slice(0, 4).map((id) => <ModelAvatar key={id} modelId={id} size="xs" />)}
                            {r.models.length > 4 && <span className="text-[11px] text-muted-foreground">+{r.models.length - 4}</span>}
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            {new Date(r.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant={r.status === "ended" ? "secondary" : "outline"}
                          className={cn("text-[10px]", r.status !== "ended" && "border-green-300 text-green-700 bg-green-50")}>
                          {r.status === "ended" ? "Ended" : "Active"}
                        </Badge>
                        <svg className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* ─────────────────────────────────────── STEP 2: Model pick ── */
  const allRecs = room?.curator_recommendations ?? []
  const extras = (room?.all_models ?? []).filter((m) => !allRecs.find((r) => r.model_id === m.model_id))
  const selectedIds = new Set(selections.map((s) => s.model_id))

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-background/95 backdrop-blur px-6">
        <button
          onClick={() => { setStep("idle"); setRoom(null); setSelections([]) }}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <Badge variant="outline" className="gap-1.5 text-xs">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />4 models online
        </Badge>
      </header>

      <div className="mx-auto w-full max-w-2xl px-4 py-8 space-y-5">

        {/* Question recap */}
        <div className="rounded-xl border bg-muted/30 px-5 py-4">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Your Question</p>
          <p className="text-sm font-medium leading-relaxed">"{q}"</p>
        </div>

        {/* Curator analysis */}
        {room?.curator_notes && (
          <div className="flex gap-4 rounded-xl border bg-card p-5">
            <ModelAvatar modelId="curator" size="lg" />
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-sm font-semibold">Curator</span>
                <Badge variant="secondary" className="text-[10px]">AI Analyst</Badge>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">{room.curator_notes}</p>
            </div>
          </div>
        )}

        {/* Model selection */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="font-semibold">Choose your panelists</p>
              <p className="text-xs text-muted-foreground mt-0.5">Select the models you want in the room. Toggle capabilities per model.</p>
            </div>
            <span className="text-sm font-semibold tabular-nums text-muted-foreground">
              {selections.length} / {allRecs.length + extras.length}
            </span>
          </div>

          {/* Recommended by curator */}
          {allRecs.length > 0 && (
            <div className="space-y-2 mb-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground px-1">
                Curator Picks
              </p>
              {allRecs.map((rec) => {
                const active = selectedIds.has(rec.model_id)
                const sel = selections.find((s) => s.model_id === rec.model_id)
                const t = modelTheme(rec.model_id)
                return (
                  <div
                    key={rec.model_id}
                    onClick={() => toggle(rec)}
                    className={cn(
                      "cursor-pointer rounded-xl border bg-card p-4 transition-all select-none",
                      active ? "ring-2 ring-foreground/15 shadow-sm" : "hover:shadow-xs hover:border-border/80"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      <div className={cn(
                        "mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors",
                        active ? "border-foreground bg-foreground" : "border-border"
                      )}>
                        {active && (
                          <svg className="h-3 w-3 text-background" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="2,6 5,9 10,3" />
                          </svg>
                        )}
                      </div>

                      <ModelAvatar modelId={rec.model_id} size="md" />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm" style={{ color: t.color }}>{t.label}</span>
                          <div className="w-20 shrink-0"><ScoreBar score={rec.reputation_score} /></div>
                          <span className="text-[11px] text-muted-foreground ml-auto">rep {Math.round(rec.reputation_score * 100)}</span>
                        </div>
                        <p className="text-xs leading-relaxed text-muted-foreground mb-2">{rec.reason}</p>

                        {/* Capabilities — always visible when selected */}
                        {active && sel && (
                          <div className="flex flex-wrap gap-1.5 pt-1 border-t" onClick={(e) => e.stopPropagation()}>
                            <span className="text-[11px] text-muted-foreground self-center mr-1">Capabilities:</span>
                            <CapToggle checked={sel.caps.web_search} onChange={(v) => setCap(rec.model_id, "web_search", v)} label="🌐 Web search" />
                            <CapToggle checked={sel.caps.thinking} onChange={(v) => setCap(rec.model_id, "thinking", v)} label="🧠 Thinking" />
                            <CapToggle checked={sel.caps.fast_mode} onChange={(v) => setCap(rec.model_id, "fast_mode", v)} label="⚡ Fast" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Other available models */}
          {extras.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground px-1">
                Other Models
              </p>
              {extras.map((m) => {
                const active = selectedIds.has(m.model_id)
                const t = modelTheme(m.model_id)
                return (
                  <div
                    key={m.model_id}
                    onClick={() => toggle({ model_id: m.model_id, display_name: m.display_name, reputation_score: m.score, reason: "Added manually", suggested_capabilities: { web_search: false, thinking: false, fast_mode: false } })}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-xl border bg-card p-3.5 transition-all select-none",
                      active ? "ring-2 ring-foreground/15" : "hover:shadow-xs border-dashed"
                    )}
                  >
                    <div className={cn(
                      "h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors",
                      active ? "border-foreground bg-foreground" : "border-border"
                    )}>
                      {active && (
                        <svg className="h-3 w-3 text-background" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="2,6 5,9 10,3" />
                        </svg>
                      )}
                    </div>
                    <ModelAvatar modelId={m.model_id} size="sm" />
                    <span className="text-sm font-medium" style={{ color: t.color }}>{t.label}</span>
                    <span className="ml-auto text-xs text-muted-foreground">Score: {Math.round(m.score * 100)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button
          size="lg"
          className="w-full"
          disabled={selections.length === 0 || step === "starting"}
          onClick={start}
        >
          {step === "starting"
            ? <><Spinner className="mr-2 h-4 w-4" />Starting…</>
            : selections.length === 0
              ? "Select at least one model"
              : `Start Room with ${selections.length} model${selections.length !== 1 ? "s" : ""} →`}
        </Button>
      </div>
    </div>
  )
}
