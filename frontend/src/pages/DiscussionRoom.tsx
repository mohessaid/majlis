import { useEffect, useRef, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useAuth } from "@clerk/clerk-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { modelTheme } from "@/lib/models"
import { Spinner, ScoreBar, ModelAvatar, ModelTag } from "@/components/helpers"
import { getRoom, dismissParticipant, endRoom, addParticipant, getAvailableModels, type Room, type ModelInfo } from "@/lib/api"
import { useDiscussion } from "@/hooks/useDiscussion"

const DISMISS_REASONS = ["Too verbose", "Off topic", "Not helpful", "Repetitive"]

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

  const { messages, streaming, send, requestDepth } = useDiscussion(roomId!, token)

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
      setCuratorBanner(`Curator suggests: ${result.curator_suggestion.model_id} — ${result.curator_suggestion.reason}`)
      setTimeout(() => setCuratorBanner(null), 8000)
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

  if (!room) return (
    <div className="flex h-screen items-center justify-center gap-2 text-muted-foreground">
      <Spinner className="h-4 w-4" /><span className="text-sm">Loading…</span>
    </div>
  )

  if (ended) return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Discussion ended</p>
      <p className="text-lg font-semibold">"{room.question}"</p>
      <p className="text-sm text-muted-foreground">
        {room.participants.filter((p) => !p.dismissed).map((p) => modelTheme(p.model_id).label).join(", ") || "No participants remained"}
      </p>
      <Button onClick={() => navigate("/app")}>New Discussion</Button>
    </div>
  )

  const active = room.participants.filter((p) => !p.dismissed)
  const dismissed = room.participants.filter((p) => p.dismissed)

  return (
    <div className="flex h-screen overflow-hidden bg-background">

      {/* Sidebar */}
      <aside className="flex w-52 shrink-0 flex-col border-r bg-muted/30">
        <div className="border-b p-4">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {room.category.replace("_", " ")}
          </p>
          <p className="line-clamp-5 text-xs font-medium leading-relaxed">"{room.question}"</p>
        </div>

        <ScrollArea className="flex-1 px-2 py-3">
          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Models</p>
          {active.map((p) => {
            const t = modelTheme(p.model_id)
            return (
              <div key={p.id} className="group flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-background transition-colors">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
                  <span className="truncate text-xs font-medium" style={{ color: t.color }}>{t.label}</span>
                </div>
                <button
                  className="text-[10px] opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                  onClick={() => setDismissTarget({ id: p.id, name: p.display_name, modelId: p.model_id })}
                >✕</button>
              </div>
            )
          })}

          {dismissed.length > 0 && (
            <>
              <Separator className="my-2" />
              <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Dismissed</p>
              {dismissed.map((p) => (
                <div key={p.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 opacity-40">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
                  <span className="truncate text-xs line-through text-muted-foreground">{modelTheme(p.model_id).label}</span>
                </div>
              ))}
            </>
          )}
        </ScrollArea>

        <div className="space-y-1.5 border-t p-3">
          <Button variant="secondary" size="sm" className="w-full" onClick={openPicker}>+ Add Model</Button>
          <Button variant="outline" size="sm" className="w-full text-destructive hover:bg-destructive hover:text-white" onClick={() => setShowEndModal(true)}>End Discussion</Button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex flex-1 flex-col overflow-hidden">

        {/* Curator banner */}
        {curatorBanner && (
          <div className="flex items-center gap-2.5 border-b bg-muted/30 px-5 py-2.5">
            <ModelAvatar modelId="curator" size="xs" />
            <span className="text-xs text-muted-foreground">{curatorBanner}</span>
          </div>
        )}

        {/* Thread */}
        <div ref={threadRef} className="flex-1 overflow-y-auto px-6 py-6">
          {messages.length === 0 && (
            <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-3 text-center">
              <div className="flex items-center gap-1.5">
                {active.slice(0, 4).map((p) => <ModelAvatar key={p.id} modelId={p.model_id} size="sm" />)}
              </div>
              <div>
                <p className="text-sm font-medium">
                  {active.map((p) => modelTheme(p.model_id).label).join(", ")} ready.
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">Send a message to start the discussion.</p>
              </div>
            </div>
          )}

          <div className="mx-auto max-w-3xl space-y-4">
            {messages.map((msg) => {

              if (msg.layer === "user") return (
                <div key={msg.id} className="flex justify-end">
                  <div className="max-w-lg rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-primary-foreground">{msg.content}</p>
                  </div>
                </div>
              )

              if (msg.layer === "curator") return (
                <div key={msg.id} className="flex gap-3 py-1">
                  <ModelAvatar modelId="curator" size="sm" />
                  <div className="max-w-lg flex-1">
                    <div className="mb-1.5"><ModelTag modelId="curator" /></div>
                    <div className="rounded-xl border bg-muted/30 px-4 py-3">
                      <p className="whitespace-pre-wrap text-sm italic leading-relaxed text-muted-foreground">{msg.content}</p>
                    </div>
                  </div>
                </div>
              )

              const t = modelTheme(msg.model_id)
              return (
                <div key={msg.id} className="group flex gap-3 py-1">
                  <ModelAvatar modelId={msg.model_id} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex items-center gap-2">
                      <ModelTag modelId={msg.model_id} />
                      {msg.layer !== "surface" && (
                        <span className="text-[11px] font-medium text-muted-foreground">
                          {msg.layer === "depth" ? "Deep dive" : msg.layer}
                        </span>
                      )}
                      {msg.searched && <span className="text-[11px] text-muted-foreground">· searched</span>}
                      {msg.streaming && (
                        <span className="flex gap-0.5">
                          {[0, 1, 2].map((i) => (
                            <span key={i} className="h-1 w-1 animate-bounce rounded-full bg-muted-foreground"
                              style={{ animationDelay: `${i * 120}ms` }} />
                          ))}
                        </span>
                      )}
                    </div>
                    <div className="rounded-xl border bg-card px-4 py-3 shadow-xs">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                    </div>
                    {!msg.streaming && msg.layer === "surface" && (
                      <button
                        onClick={() => requestDepth(msg.participant_id, displayNames)}
                        className="mt-1.5 text-[11px] font-medium opacity-0 transition-opacity group-hover:opacity-100"
                        style={{ color: t.color }}
                      >Go deeper →</button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Input bar */}
        <div className="border-t px-6 py-4">
          <div className="mx-auto flex max-w-3xl items-end gap-3">
            <Textarea
              rows={2}
              className="flex-1 resize-none"
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
              {streaming ? <Spinner className="h-4 w-4" /> : "Send"}
            </Button>
          </div>
        </div>
      </main>

      {/* Dismiss modal */}
      {dismissTarget && (
        <Overlay onClose={() => setDismissTarget(null)}>
          <p className="font-semibold">Dismiss {modelTheme(dismissTarget.modelId).label}?</p>
          <p className="mt-0.5 text-xs text-muted-foreground">The Curator will record this feedback.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {DISMISS_REASONS.map((r) => (
              <button key={r} onClick={() => setDismissReason(r)}
                className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  dismissReason === r ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:border-foreground/40"
                )}>{r}</button>
            ))}
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDismissTarget(null)}>Cancel</Button>
            <Button variant="destructive" size="sm" disabled={!dismissReason} onClick={confirmDismiss}>Dismiss</Button>
          </div>
        </Overlay>
      )}

      {/* Add model modal */}
      {showPicker && (
        <Overlay onClose={() => setShowPicker(false)}>
          <p className="font-semibold">Add a Model</p>
          <div className="mt-4 space-y-2">
            {availableModels
              .filter((m) => !room.participants.find((p) => p.model_id === m.model_id && !p.dismissed))
              .map((m: ModelInfo) => (
                <div key={m.model_id}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border p-3 hover:bg-muted/50 transition-colors"
                  onClick={() => addModel(m.model_id)}>
                  <ModelAvatar modelId={m.model_id} size="sm" />
                  <span className="flex-1 text-sm font-medium">{modelTheme(m.model_id).label}</span>
                  <div className="w-20"><ScoreBar score={m.score} /></div>
                </div>
              ))}
          </div>
          <div className="mt-4">
            <Button variant="ghost" size="sm" className="w-full" onClick={() => setShowPicker(false)}>Cancel</Button>
          </div>
        </Overlay>
      )}

      {/* End discussion modal */}
      {showEndModal && (
        <Overlay onClose={() => setShowEndModal(false)}>
          <p className="font-semibold">End Discussion</p>
          <p className="mt-0.5 text-xs text-muted-foreground">How useful was this discussion?</p>
          <div className="mt-4 flex justify-center gap-1.5">
            {[1, 2, 3, 4, 5].map((s) => (
              <button key={s} onClick={() => setRating(s)}
                className={cn("text-2xl transition-colors", rating >= s ? "text-amber-400" : "text-muted-foreground/30 hover:text-muted-foreground/60")}>
                ★
              </button>
            ))}
          </div>
          <div className="mt-5 flex justify-end gap-2">
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
