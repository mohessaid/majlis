import { useEffect, useRef, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useAuth } from "@clerk/clerk-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { modelTheme } from "@/lib/models"
import { Spinner, ScoreBar, ModelAvatar, ModelTag } from "@/components/helpers"
import { getRoom, dismissParticipant, endRoom, addParticipant, getAvailableModels, type Room, type ModelInfo } from "@/lib/api"
import { useDiscussion, type MessageBubble } from "@/hooks/useDiscussion"

const DISMISS_REASONS = ["Too verbose", "Off topic", "Not helpful", "Repetitive"]

/* ── Turn grouping ───────────────────────────────────────────────── */
interface Turn {
  id: string
  userMsg: MessageBubble
  curatorMsgs: MessageBubble[]
  modelMsgs: MessageBubble[]
}

function groupTurns(messages: MessageBubble[]): Turn[] {
  const turns: Turn[] = []
  let current: Turn | null = null
  for (const msg of messages) {
    if (msg.layer === "user") {
      if (current) turns.push(current)
      current = { id: msg.id, userMsg: msg, curatorMsgs: [], modelMsgs: [] }
    } else if (current) {
      if (msg.layer === "curator") current.curatorMsgs.push(msg)
      else current.modelMsgs.push(msg)
    }
  }
  if (current) turns.push(current)
  return turns
}

/* ── Card stack for one turn's model responses ───────────────────── */
function ResponseStack({
  msgs,
  streaming,
  onDepth,
  onKick,
}: {
  msgs: MessageBubble[]
  streaming: boolean
  onDepth: (participantId: string) => void
  onKick: (participantId: string) => void
}) {
  const [idx, setIdx] = useState(0)
  const active = msgs[Math.min(idx, msgs.length - 1)]
  if (!active) return null
  const t = modelTheme(active.model_id)
  const stackCount = Math.min(msgs.length - idx - 1, 2)

  return (
    <div className="space-y-3">
      {/* Stack visual */}
      <div className="relative" style={{ paddingBottom: stackCount * 5 }}>
        {/* Shadow cards behind */}
        {Array.from({ length: stackCount }).map((_, i) => (
          <div
            key={i}
            className="absolute inset-0 rounded-xl border bg-card"
            style={{
              transform: `translateY(${(i + 1) * 5}px) translateX(${(i + 1) * 3}px) scale(${1 - (i + 1) * 0.015})`,
              zIndex: -(i + 1),
              opacity: 1 - (i + 1) * 0.25,
            }}
          />
        ))}

        {/* Active card */}
        <div className="relative z-10 rounded-xl border bg-card shadow-sm transition-all">
          <div className="flex items-start gap-3 p-4">
            <ModelAvatar modelId={active.model_id} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex items-center gap-2 flex-wrap">
                <ModelTag modelId={active.model_id} />
                {active.layer === "depth" && <Badge variant="secondary" className="text-[10px]">Deep dive</Badge>}
                {active.layer === "discuss" && <Badge variant="outline" className="text-[10px] border-blue-200 text-blue-700 bg-blue-50">Discussion</Badge>}
                {active.searched && <Badge variant="outline" className="text-[10px] gap-1">🌐 Web</Badge>}
                {active.streaming && (
                  <span className="flex gap-0.5">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground"
                        style={{ animationDelay: `${i * 120}ms` }} />
                    ))}
                  </span>
                )}
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{active.content}</p>
            </div>
          </div>

          {/* Card footer: actions + navigation */}
          <div className="flex items-center justify-between border-t px-4 py-2">
            <div className="flex items-center gap-3">
              {!active.streaming && active.layer === "surface" && (
                <button
                  onClick={() => onDepth(active.participant_id)}
                  className="text-[11px] font-medium hover:underline transition-colors"
                  style={{ color: t.color }}
                  disabled={streaming}
                >Go deeper →</button>
              )}
              <button
                onClick={() => onKick(active.participant_id)}
                className="text-[11px] text-muted-foreground hover:text-destructive transition-colors"
              >Kick</button>
            </div>

            {msgs.length > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIdx((i) => Math.max(0, i - 1))}
                  disabled={idx === 0}
                  className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                {/* Dot indicators */}
                <div className="flex gap-1">
                  {msgs.map((m, i) => (
                    <button key={m.id} onClick={() => setIdx(i)}
                      className={cn(
                        "h-1.5 rounded-full transition-all",
                        i === idx ? "w-4 bg-foreground" : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60"
                      )} />
                  ))}
                </div>
                <button
                  onClick={() => setIdx((i) => Math.min(msgs.length - 1, i + 1))}
                  disabled={idx === msgs.length - 1}
                  className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* All models tab bar when > 1 response */}
      {msgs.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {msgs.map((m, i) => {
            const mt = modelTheme(m.model_id)
            return (
              <button
                key={m.id}
                onClick={() => setIdx(i)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                  i === idx
                    ? "border-transparent text-white"
                    : "border-border text-muted-foreground hover:border-foreground/30"
                )}
                style={i === idx ? { background: mt.color, borderColor: mt.color } : {}}
              >
                <span>{mt.initial}</span>
                <span>{mt.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── Main component ───────────────────────────────────────────────── */
export function DiscussionRoom() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const { getToken } = useAuth()

  const [token, setToken] = useState<string | null>(null)
  const [room, setRoom] = useState<Room | null>(null)
  const [input, setInput] = useState("")
  const [dismissTarget, setDismissTarget] = useState<{ id: string; name: string; modelId: string } | null>(null)
  const [dismissReason, setDismissReason] = useState("")
  const [showPicker, setShowPicker] = useState(false)
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([])
  const [curatorBanner, setCuratorBanner] = useState<string | null>(null)
  const [showEndModal, setShowEndModal] = useState(false)
  const [rating, setRating] = useState(0)
  const [ended, setEnded] = useState(false)
  const threadRef = useRef<HTMLDivElement>(null)

  useEffect(() => { getToken().then(setToken) }, [])

  const { messages, streaming, historyLoaded, send, requestDepth, requestDiscussion } = useDiscussion(roomId!, token)

  useEffect(() => {
    if (!roomId) return
    ;(async () => {
      const t = await getToken()
      setToken(t)
      const data = await getRoom(roomId, t ?? undefined)
      setRoom(data)
    })()
  }, [roomId])

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight
  }, [messages])

  const displayNames = Object.fromEntries((room?.participants ?? []).map((p) => [p.id, p.display_name]))

  function handleSend() {
    if (!input.trim() || streaming) return
    send(input.trim(), displayNames)
    setInput("")
  }

  async function handleDismiss(participantId: string) {
    const p = room?.participants.find((x) => x.id === participantId)
    if (p) setDismissTarget({ id: p.id, name: p.display_name, modelId: p.model_id })
  }

  async function confirmDismiss() {
    if (!dismissTarget || !roomId || !dismissReason) return
    const t = await getToken()
    const result = await dismissParticipant(roomId, dismissTarget.id, dismissReason, t ?? undefined)
    setRoom((prev) => prev ? {
      ...prev,
      participants: prev.participants.map((p) =>
        p.id === dismissTarget.id ? { ...p, dismissed: true, dismissal_reason: dismissReason } : p),
    } : prev)
    if (result.curator_suggestion) {
      setCuratorBanner(`${result.curator_suggestion.model_id} — ${result.curator_suggestion.reason}`)
      setTimeout(() => setCuratorBanner(null), 10000)
    }
    setDismissTarget(null)
    setDismissReason("")
  }

  async function openPicker() {
    if (!roomId) return
    const t = await getToken()
    const data = await getAvailableModels(roomId, t ?? undefined)
    setAvailableModels(data.models)
    setShowPicker(true)
  }

  async function addModel(modelId: string) {
    if (!roomId) return
    setShowPicker(false)
    const t = await getToken()
    const result = await addParticipant(roomId, modelId, { web_search: false, thinking: false, fast_mode: false }, t ?? undefined)
    const m = availableModels.find((x) => x.model_id === modelId)
    setRoom((prev) => prev ? {
      ...prev,
      participants: [...prev.participants, {
        id: result.participant_id,
        model_id: modelId,
        display_name: m?.display_name ?? modelId,
        capabilities: { web_search: false, thinking: false, fast_mode: false },
        dismissed: false,
      }],
    } : prev)
  }

  async function finishRoom() {
    if (!roomId || rating === 0) return
    const t = await getToken()
    await endRoom(roomId, rating, t ?? undefined)
    setEnded(true)
    setShowEndModal(false)
  }

  if (!room || !historyLoaded) return (
    <div className="flex h-screen items-center justify-center gap-2 text-muted-foreground">
      <Spinner className="h-5 w-5" />
      <span className="text-sm">{!room ? "Loading room…" : "Loading history…"}</span>
    </div>
  )

  if (ended) return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center text-2xl">✓</div>
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Discussion ended</p>
      <p className="text-base font-semibold max-w-sm">"{room.question}"</p>
      <Button onClick={() => navigate("/app")}>← New Discussion</Button>
    </div>
  )

  const active = room.participants.filter((p) => !p.dismissed)
  const dismissed = room.participants.filter((p) => p.dismissed)
  const turns = groupTurns(messages)
  const lastTurn = turns[turns.length - 1]
  void lastTurn

  return (
    <div className="flex h-screen overflow-hidden bg-background">

      {/* ── Sidebar ── */}
      <aside className="flex w-52 shrink-0 flex-col border-r bg-muted/20">

        <div className="flex items-center gap-2 border-b px-4 h-14">
          <button onClick={() => navigate("/app")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            All Rooms
          </button>
        </div>

        <div className="border-b px-4 py-3">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {room.category?.replace("_", " ") ?? "Discussion"}
          </p>
          <p className="line-clamp-4 text-xs font-medium leading-relaxed">"{room.question}"</p>
        </div>

        {/* Curator */}
        <div className="border-b px-4 py-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Curator</p>
          <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
            <ModelAvatar modelId="curator" size="sm" />
            <div className="min-w-0">
              <p className="text-xs font-medium">Curator</p>
              <p className="text-[10px] text-muted-foreground leading-tight">Moderates · Rates</p>
            </div>
            <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
          </div>
        </div>

        {/* Panelists */}
        <ScrollArea className="flex-1 px-4 py-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Panelists ({active.length})
          </p>
          <div className="space-y-1.5">
            {active.map((p) => {
              const t = modelTheme(p.model_id)
              return (
                <div key={p.id} className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
                  <span className="min-w-0 flex-1 truncate text-xs font-medium" style={{ color: t.color }}>{t.label}</span>
                  <button
                    title="Kick from room"
                    onClick={() => setDismissTarget({ id: p.id, name: p.display_name, modelId: p.model_id })}
                    className="shrink-0 rounded p-0.5 text-muted-foreground/40 hover:bg-destructive/10 hover:text-destructive transition-colors"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )
            })}
          </div>

          {dismissed.length > 0 && (
            <>
              <Separator className="my-3" />
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                Kicked ({dismissed.length})
              </p>
              {dismissed.map((p) => (
                <div key={p.id} className="flex items-center gap-2 px-1 py-1 opacity-40">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
                  <span className="truncate text-xs line-through text-muted-foreground">{modelTheme(p.model_id).label}</span>
                </div>
              ))}
            </>
          )}
        </ScrollArea>

        <div className="space-y-1.5 border-t p-3">
          <Button variant="secondary" size="sm" className="w-full" onClick={openPicker}>+ Add Model</Button>
          <Button variant="outline" size="sm"
            className="w-full border-destructive/30 text-destructive hover:bg-destructive hover:text-white hover:border-destructive"
            onClick={() => setShowEndModal(true)}>
            End Discussion
          </Button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex flex-1 flex-col overflow-hidden">

        {/* Curator banner */}
        {curatorBanner && (
          <div className="flex items-center gap-3 border-b bg-amber-50 px-5 py-3">
            <ModelAvatar modelId="curator" size="sm" />
            <div>
              <p className="text-xs font-semibold text-amber-800">Curator Suggestion</p>
              <p className="text-xs text-amber-700">{curatorBanner}</p>
            </div>
            <button onClick={() => setCuratorBanner(null)} className="ml-auto text-amber-500 hover:text-amber-700">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Thread */}
        <div ref={threadRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl px-6 py-6 space-y-8">

            {!historyLoaded || (historyLoaded && messages.length === 0 && !streaming) ? (
              historyLoaded ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
                  <div className="flex items-center gap-2">
                    <ModelAvatar modelId="curator" size="md" />
                    {active.slice(0, 3).map((p) => <ModelAvatar key={p.id} modelId={p.model_id} size="md" />)}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">
                      Curator + {active.map((p) => modelTheme(p.model_id).label).join(", ")} are ready.
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Send a message to start the discussion.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
                </div>
              )
            ) : (
              turns.map((turn, ti) => {
                const isLastTurn = ti === turns.length - 1
                const turnStreaming = isLastTurn && streaming
                const turnComplete = !turnStreaming && turn.modelMsgs.length > 0

                return (
                  <div key={turn.id} className="space-y-3">
                    {/* Round badge */}
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                        Round {ti + 1}
                      </span>
                      <div className="flex-1 h-px bg-border/50" />
                    </div>

                    {/* User message */}
                    <div className="flex justify-end">
                      <div className={cn(
                        "max-w-lg rounded-2xl rounded-tr-sm px-4 py-3",
                        turn.userMsg.content.startsWith("[Discussion Round]")
                          ? "bg-blue-600"
                          : "bg-primary"
                      )}>
                        {turn.userMsg.content.startsWith("[Discussion Round]") ? (
                          <p className="text-xs text-blue-100 font-medium">🔄 Let them discuss</p>
                        ) : (
                          <p className="text-sm text-primary-foreground whitespace-pre-wrap leading-relaxed">
                            {turn.userMsg.content}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Curator intro messages */}
                    {turn.curatorMsgs.map((msg) => (
                      <div key={msg.id} className="flex gap-3">
                        <ModelAvatar modelId="curator" size="sm" />
                        <div className="max-w-lg flex-1">
                          <div className="mb-1.5 flex items-center gap-2">
                            <ModelTag modelId="curator" />
                            <span className="text-[11px] text-muted-foreground">Moderator</span>
                          </div>
                          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                            <p className="text-sm italic leading-relaxed text-amber-900 whitespace-pre-wrap">{msg.content}</p>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Model responses — stacked cards */}
                    {(turn.modelMsgs.length > 0 || turnStreaming) && (
                      <ResponseStack
                        msgs={turn.modelMsgs}
                        streaming={turnStreaming}
                        onDepth={(pid) => requestDepth(pid, displayNames)}
                                        onKick={handleDismiss}
                      />
                    )}

                    {/* Streaming placeholder */}
                    {turnStreaming && turn.modelMsgs.length === 0 && (
                      <div className="rounded-xl border bg-card p-5">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Spinner className="h-4 w-4" />
                          <span>Models are responding…</span>
                        </div>
                      </div>
                    )}

                    {/* Post-turn actions (only on completed turns) */}
                    {turnComplete && isLastTurn && (
                      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed bg-muted/20 px-4 py-3">
                        <p className="text-xs text-muted-foreground mr-1">What next?</p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs gap-1.5"
                          disabled={streaming}
                          onClick={() => requestDiscussion(turn.modelMsgs, displayNames)}
                        >
                          🔄 Let them discuss
                        </Button>
                        <span className="text-muted-foreground/40 text-xs">or type a follow-up below</span>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Input bar */}
        <div className="border-t bg-background px-6 py-4">
          <div className="mx-auto flex max-w-2xl items-end gap-3">
            <Textarea
              rows={2}
              className="flex-1 resize-none text-sm"
              placeholder="Ask the room… (Enter to send, Shift+Enter for new line)"
              value={input}
              disabled={streaming}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            />
            <Button
              onClick={handleSend}
              disabled={streaming || !input.trim()}
              className="h-[72px] w-16 shrink-0"
            >
              {streaming ? <Spinner className="h-4 w-4" /> : (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </Button>
          </div>
        </div>
      </main>

      {/* ── Dismiss modal ── */}
      {dismissTarget && (
        <Overlay onClose={() => { setDismissTarget(null); setDismissReason("") }}>
          <div className="flex items-center gap-3 mb-4">
            <ModelAvatar modelId={dismissTarget.modelId} size="md" />
            <div>
              <p className="font-semibold">Kick {modelTheme(dismissTarget.modelId).label}?</p>
              <p className="text-xs text-muted-foreground">The Curator will record your feedback and adapt.</p>
            </div>
          </div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Reason</p>
          <div className="flex flex-wrap gap-2 mb-5">
            {DISMISS_REASONS.map((r) => (
              <button key={r} onClick={() => setDismissReason(r)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  dismissReason === r
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:border-foreground/40"
                )}>{r}</button>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setDismissTarget(null); setDismissReason("") }}>Cancel</Button>
            <Button variant="destructive" size="sm" disabled={!dismissReason} onClick={confirmDismiss}>Kick from Room</Button>
          </div>
        </Overlay>
      )}

      {/* ── Add model modal ── */}
      {showPicker && (
        <Overlay onClose={() => setShowPicker(false)}>
          <p className="font-semibold mb-4">Add a Model</p>
          <div className="space-y-2">
            {availableModels
              .filter((m) => !room.participants.find((p) => p.model_id === m.model_id && !p.dismissed))
              .map((m: ModelInfo) => {
                const t = modelTheme(m.model_id)
                return (
                  <div key={m.model_id}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border p-3 hover:bg-muted/50 transition-colors"
                    onClick={() => addModel(m.model_id)}>
                    <ModelAvatar modelId={m.model_id} size="sm" />
                    <span className="flex-1 text-sm font-medium" style={{ color: t.color }}>{t.label}</span>
                    <div className="w-20"><ScoreBar score={m.score} /></div>
                  </div>
                )
              })}
          </div>
          <Button variant="ghost" size="sm" className="w-full mt-4" onClick={() => setShowPicker(false)}>Cancel</Button>
        </Overlay>
      )}

      {/* ── End modal ── */}
      {showEndModal && (
        <Overlay onClose={() => setShowEndModal(false)}>
          <p className="font-semibold mb-1">End Discussion</p>
          <p className="text-xs text-muted-foreground mb-4">Rate how useful this discussion was.</p>
          <div className="flex justify-center gap-2 mb-5">
            {[1, 2, 3, 4, 5].map((s) => (
              <button key={s} onClick={() => setRating(s)}
                className={cn("text-3xl leading-none transition-all hover:scale-110",
                  rating >= s ? "text-amber-400" : "text-muted-foreground/25 hover:text-muted-foreground/50")}>★</button>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowEndModal(false)}>Cancel</Button>
            <Button size="sm" disabled={rating === 0} onClick={finishRoom}>Save & End</Button>
          </div>
        </Overlay>
      )}
    </div>
  )
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}
