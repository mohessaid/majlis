import { useState, useEffect, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@clerk/clerk-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
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
  technology: "Technology", science: "Science", philosophy: "Philosophy",
  politics: "Politics", economics: "Economics", general: "General",
}

export function Landing() {
  const [q, setQ] = useState("")
  const [step, setStep] = useState<"idle" | "loading" | "selecting" | "starting">("idle")
  const [room, setRoom] = useState<CreateRoomResponse | null>(null)
  const [selections, setSelections] = useState<Selection[]>([])
  const [error, setError] = useState("")
  const [prevRooms, setPrevRooms] = useState<RoomSummary[]>([])
  const navigate = useNavigate()
  const { getToken } = useAuth()

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken()
        const rooms = await listRooms(token ?? undefined)
        setPrevRooms(rooms)
      } catch { /* silently ignore — user just won't see history */ }
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

  /* ── Shared nav bar ── */
  function NavBar({ onBack }: { onBack?: () => void }) {
    return (
      <header className="sticky top-0 z-50 flex items-center justify-between border-b bg-background/95 backdrop-blur px-6 h-14">
        <button
          onClick={onBack ?? (() => navigate("/"))}
          className="text-sm font-semibold hover:opacity-60 transition-opacity"
        >
          {onBack ? "← Back" : "← Majlis"}
        </button>
        <Badge variant="outline" className="gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
          4 models online
        </Badge>
      </header>
    )
  }

  /* ── STEP 1: Question form ── */
  if (step === "idle" || step === "loading") {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <NavBar />
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-16">
          <div className="w-full max-w-xl">
            <div className="mb-8">
              <h1 className="text-2xl font-bold tracking-tight">What do you want to discuss?</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                The Curator will analyze your question and pick the right models.
              </p>
            </div>

            <form onSubmit={analyze} className="space-y-3">
              <Textarea
                rows={4}
                placeholder="e.g. What's the best architecture for a multi-tenant SaaS app?"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                disabled={step === "loading"}
                className="text-sm resize-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    analyze(e as unknown as FormEvent)
                  }
                }}
              />
              <Button type="submit" size="lg" className="w-full" disabled={!q.trim() || step === "loading"}>
                {step === "loading"
                  ? <><Spinner className="mr-2 h-4 w-4" />Curator is analyzing…</>
                  : "Analyze & Select Models →"}
              </Button>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </form>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Available:</span>
              {["llama-3.1-8b", "qwen2.5-7b", "mistral-7b", "deepseek-r1-8b"].map((id) => (
                <ModelTag key={id} modelId={id} />
              ))}
            </div>
          </div>
        </div>

        {/* Previous rooms */}
        {prevRooms.length > 0 && (
          <>
            <Separator />
            <div className="bg-muted/30 px-4 py-8 sm:px-8">
              <div className="mx-auto max-w-xl">
                <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Recent Discussions
                </p>
                <div className="space-y-2">
                  {prevRooms.slice(0, 6).map((r) => (
                    <button
                      key={r.room_id}
                      onClick={() => navigate(`/room/${r.room_id}`)}
                      className="w-full flex items-start justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-left hover:shadow-xs transition-shadow"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">"{r.question}"</p>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-[11px] text-muted-foreground">{CAT_LABEL[r.category] ?? r.category}</span>
                          <span className="text-muted-foreground/40">·</span>
                          <div className="flex items-center gap-1">
                            {r.models.slice(0, 3).map((id) => (
                              <ModelAvatar key={id} modelId={id} size="xs" />
                            ))}
                            {r.models.length > 3 && (
                              <span className="text-[11px] text-muted-foreground">+{r.models.length - 3}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <Badge variant={r.status === "ended" ? "secondary" : "outline"} className="text-[10px]">
                          {r.status === "ended" ? "Ended" : "Active"}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  /* ── STEP 2: Model selection ── */
  const allRecs = room?.curator_recommendations ?? []
  const extras = (room?.all_models ?? []).filter((m) => !allRecs.find((r) => r.model_id === m.model_id))

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <NavBar onBack={() => { setStep("idle"); setRoom(null); setSelections([]) }} />

      <div className="flex flex-1 justify-center px-4 py-10">
        <div className="w-full max-w-xl space-y-4">

          {/* Question recap */}
          <div className="rounded-xl border bg-card p-4">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Your Question</p>
            <p className="text-sm font-medium leading-relaxed">"{q}"</p>
          </div>

          {/* Curator note */}
          {room?.curator_notes && (
            <div className="flex gap-3 rounded-xl border bg-card p-4">
              <ModelAvatar modelId="curator" size="md" />
              <div className="min-w-0">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Curator Analysis</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{room.curator_notes}</p>
              </div>
            </div>
          )}

          {/* Model cards */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold">Select your models</p>
              <span className="text-xs text-muted-foreground">{selections.length} selected</span>
            </div>

            <div className="space-y-2">
              {allRecs.map((rec) => {
                const active = !!selections.find((s) => s.model_id === rec.model_id)
                const sel = selections.find((s) => s.model_id === rec.model_id)
                const t = modelTheme(rec.model_id)
                return (
                  <div
                    key={rec.model_id}
                    onClick={() => toggle(rec)}
                    className={cn(
                      "cursor-pointer select-none rounded-xl border bg-card p-4 transition-shadow",
                      active ? "shadow-sm ring-1 ring-foreground/10" : "hover:shadow-xs"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <ModelAvatar modelId={rec.model_id} size="md" />
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <span className="text-sm font-semibold" style={{ color: t.color }}>{t.label}</span>
                          <div className="w-24"><ScoreBar score={rec.reputation_score} /></div>
                        </div>
                        <p className="mb-2 text-xs leading-relaxed text-muted-foreground">{rec.reason}</p>
                        {active && sel && (
                          <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                            <CapToggle checked={sel.caps.web_search} onChange={(v) => setCap(rec.model_id, "web_search", v)} label="Web search" />
                            <CapToggle checked={sel.caps.thinking} onChange={(v) => setCap(rec.model_id, "thinking", v)} label="Thinking" />
                            <CapToggle checked={sel.caps.fast_mode} onChange={(v) => setCap(rec.model_id, "fast_mode", v)} label="Fast" />
                          </div>
                        )}
                      </div>
                      <div className={cn(
                        "mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors",
                        active ? "border-foreground bg-foreground" : "border-border"
                      )}>
                        {active && (
                          <svg className="h-3 w-3 text-background" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="2,6 5,9 10,3" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}

              {extras.map((m) => (
                <div
                  key={m.model_id}
                  onClick={() => toggle({ model_id: m.model_id, display_name: m.display_name, reputation_score: m.score, reason: "Added manually", suggested_capabilities: { web_search: false, thinking: false, fast_mode: false } })}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed bg-card p-3 hover:border-border transition-colors"
                >
                  <ModelAvatar modelId={m.model_id} size="sm" />
                  <span className="text-sm text-muted-foreground">{modelTheme(m.model_id).label}</span>
                  <span className="ml-auto text-xs font-medium text-muted-foreground">+ Add</span>
                </div>
              ))}
            </div>
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
              : `Open Room with ${selections.length} model${selections.length !== 1 ? "s" : ""} →`}
          </Button>
        </div>
      </div>
    </div>
  )
}
