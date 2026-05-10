import { useNavigate } from "react-router-dom";
import { useAuth, SignInButton } from "@clerk/clerk-react";

const MODELS = [
  { id: "llama",    label: "Llama 3.1",  initial: "L", text: "#047857", bg: "#ecfdf5", border: "#a7f3d0", desc: "Meta's open-source flagship" },
  { id: "qwen",     label: "Qwen 2.5",   initial: "Q", text: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe", desc: "Alibaba's reasoning model" },
  { id: "mistral",  label: "Mistral",    initial: "M", text: "#be185d", bg: "#fdf2f8", border: "#fbcfe8", desc: "European powerhouse" },
  { id: "deepseek", label: "DeepSeek R1",initial: "D", text: "#b45309", bg: "#fffbeb", border: "#fde68a", desc: "Chinese reasoning specialist" },
];

const HOW = [
  { n: "1", title: "Ask anything", body: "Write your question — technical, philosophical, or factual. Anything works." },
  { n: "2", title: "Curator picks models", body: "Our Curator AI analyzes your question and selects the right models based on topic and past performance." },
  { n: "3", title: "They discuss, you judge", body: "Models respond in parallel. Go deeper with the best. Dismiss weak answers. The room improves over time." },
];

const DEMO_MESSAGES = [
  { role: "user", text: "What's the best database for a real-time chat app?" },
  { model: MODELS[0], text: "Redis with pub/sub is the go-to — sub-millisecond latency and built-in message queues. Pair it with a persistent store like Postgres for message history." },
  { model: MODELS[1], text: "I'd consider Firestore for real-time listeners and horizontal scaling, though Redis wins on raw latency for high-throughput scenarios." },
];

export function Home() {
  const { isSignedIn } = useAuth();
  const navigate = useNavigate();

  const StartBtn = ({ label, large }: { label: string; large?: boolean }) => {
    const cls = large
      ? "rounded-xl bg-gray-900 px-7 py-3.5 text-sm font-semibold text-white hover:bg-gray-700 transition-colors shadow-sm"
      : "rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors";
    if (isSignedIn) return <button onClick={() => navigate("/app")} className={cls}>{label}</button>;
    return <SignInButton mode="modal"><button className={cls}>{label}</button></SignInButton>;
  };

  return (
    <div className="min-h-screen bg-white text-gray-900">

      {/* ── Nav ── */}
      <header className="sticky top-0 z-10 border-b border-gray-100 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-base font-bold tracking-tight">Majlis</span>
          <div className="flex items-center gap-3">
            <span className="hidden sm:flex items-center gap-1.5 text-xs text-gray-400 mr-2">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> 4 models live
            </span>
            <StartBtn label={isSignedIn ? "Open App →" : "Sign in"} />
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="mx-auto max-w-4xl px-6 pt-20 pb-12 text-center">
        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
          Multiple AI minds.<br />One answer you can trust.
        </h1>
        <p className="text-lg text-gray-500 max-w-lg mx-auto mb-8 leading-relaxed">
          Majlis puts four top AI models in the same room. Ask once, they each respond in parallel — you go deeper with the best and dismiss the rest.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <StartBtn label="Start for Free →" large />
          <a href="#how" className="rounded-xl border border-gray-200 px-7 py-3.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
            How it works
          </a>
        </div>
      </section>

      {/* ── Product screenshot ── */}
      <section className="mx-auto max-w-4xl px-6 pb-20">
        <div className="overflow-hidden rounded-2xl border border-gray-200 shadow-lg">
          {/* Browser chrome */}
          <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
            <div className="mx-auto flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-1 text-xs text-gray-400">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></svg>
              majlis.mohessaid.com/room/…
            </div>
          </div>

          {/* App shell */}
          <div className="flex bg-white" style={{ minHeight: 300 }}>
            {/* Sidebar */}
            <div className="w-44 flex-shrink-0 border-r border-gray-100 bg-gray-50 p-4">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Models</p>
              <div className="space-y-2">
                {MODELS.map((m) => (
                  <div key={m.id} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-green-500" />
                    <span className="text-xs font-medium" style={{ color: m.text }}>{m.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Thread */}
            <div className="flex-1 overflow-hidden p-5 space-y-4">
              {DEMO_MESSAGES.map((msg, i) => {
                if ("role" in msg) return (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-xs rounded-2xl rounded-tr-sm bg-gray-900 px-4 py-2.5">
                      <p className="text-sm text-white">{msg.text}</p>
                    </div>
                  </div>
                );
                const m = msg.model!;
                return (
                  <div key={i} className="flex gap-3">
                    <div className="h-7 w-7 flex-shrink-0 rounded-lg border text-xs font-bold flex items-center justify-center"
                      style={{ background: m.bg, color: m.text, borderColor: m.border }}>
                      {m.initial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="mb-1.5 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                        style={{ background: m.bg, color: m.text, borderColor: m.border }}>
                        {m.label}
                      </span>
                      <div className="rounded-xl border border-gray-100 bg-white px-4 py-2.5 text-sm text-gray-700 shadow-xs">
                        {msg.text}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="border-t border-gray-100 bg-gray-50 py-20 px-6">
        <div className="mx-auto max-w-3xl">
          <p className="mb-2 text-center text-xs font-semibold uppercase tracking-widest text-gray-400">How it works</p>
          <h2 className="mb-12 text-center text-3xl font-bold">Three steps to a better answer</h2>
          <div className="grid gap-5 sm:grid-cols-3">
            {HOW.map((s) => (
              <div key={s.n} className="rounded-2xl border border-gray-200 bg-white p-6">
                <div className="mb-4 inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white">
                  {s.n}
                </div>
                <h3 className="mb-2 text-sm font-semibold">{s.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Models ── */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-3xl">
          <p className="mb-2 text-center text-xs font-semibold uppercase tracking-widest text-gray-400">The lineup</p>
          <h2 className="mb-12 text-center text-3xl font-bold">Four models, one room</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {MODELS.map((m) => (
              <div key={m.id} className="flex items-center gap-4 rounded-2xl border border-gray-100 p-5 hover:border-gray-200 transition-colors">
                <div className="h-11 w-11 flex-shrink-0 rounded-xl border text-base font-bold flex items-center justify-center"
                  style={{ background: m.bg, color: m.text, borderColor: m.border }}>
                  {m.initial}
                </div>
                <div>
                  <p className="text-sm font-semibold">{m.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{m.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="border-t border-gray-100 bg-gray-900 py-20 px-6 text-center">
        <h2 className="mb-3 text-3xl font-bold text-white">Ready to ask better questions?</h2>
        <p className="mb-8 text-sm text-gray-400">Free · No credit card · Four models waiting</p>
        <StartBtn label="Get Started for Free →" large />
      </section>

      <footer className="border-t border-gray-800 bg-gray-900 py-6 text-center">
        <p className="text-xs text-gray-600">Majlis · AMD Developer Cloud Hackathon 2026</p>
      </footer>
    </div>
  );
}
