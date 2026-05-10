import { useNavigate } from "react-router-dom";
import { useAuth, SignInButton } from "@clerk/clerk-react";

const MODELS = [
  { id: "llama",    label: "Llama 3.1",  text: "#047857", bg: "#ecfdf5", border: "#a7f3d0", desc: "Meta's open-source flagship" },
  { id: "qwen",     label: "Qwen 2.5",   text: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe", desc: "Alibaba's reasoning model" },
  { id: "mistral",  label: "Mistral",    text: "#be185d", bg: "#fdf2f8", border: "#fbcfe8", desc: "European powerhouse" },
  { id: "deepseek", label: "DeepSeek R1",text: "#b45309", bg: "#fffbeb", border: "#fde68a", desc: "Chinese reasoning specialist" },
];

const HOW = [
  { n: "1", title: "Ask anything", body: "Write your question — technical, philosophical, or factual. Anything goes." },
  { n: "2", title: "Curator picks models", body: "Our Curator AI analyzes your question and selects the right models based on topic and past performance." },
  { n: "3", title: "They discuss, you judge", body: "Models respond in parallel. Ask them to go deeper. Dismiss weak answers. The best models earn their seat." },
];

export function Home() {
  const { isSignedIn } = useAuth();
  const navigate = useNavigate();

  function handleStart() {
    if (isSignedIn) navigate("/app");
  }

  return (
    <div className="min-h-screen bg-white">

      {/* ── Nav ── */}
      <nav className="flex items-center justify-between border-b border-gray-100 px-6 py-4 max-w-5xl mx-auto">
        <span className="text-base font-semibold text-gray-900">Majlis</span>
        <div className="flex items-center gap-3">
          {isSignedIn ? (
            <button
              onClick={() => navigate("/app")}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
            >
              Open App →
            </button>
          ) : (
            <SignInButton mode="modal">
              <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors">
                Sign in
              </button>
            </SignInButton>
          )}
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="max-w-3xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-500">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
          4 models running live
        </div>
        <h1 className="text-5xl font-bold tracking-tight text-gray-900 leading-tight mb-5">
          Multiple AI minds.<br />One answer you can trust.
        </h1>
        <p className="text-lg text-gray-500 max-w-xl mx-auto mb-8 leading-relaxed">
          Majlis puts four top AI models in the same room. Ask your question once — they each respond, you go deeper with the best ones, and dismiss the rest.
        </p>
        <div className="flex items-center justify-center gap-3">
          {isSignedIn ? (
            <button
              onClick={handleStart}
              className="rounded-xl bg-gray-900 px-6 py-3 text-sm font-semibold text-white hover:bg-gray-700 transition-colors shadow-sm"
            >
              Start a Discussion →
            </button>
          ) : (
            <SignInButton mode="modal">
              <button className="rounded-xl bg-gray-900 px-6 py-3 text-sm font-semibold text-white hover:bg-gray-700 transition-colors shadow-sm">
                Start for Free →
              </button>
            </SignInButton>
          )}
          <a href="#how" className="rounded-xl border border-gray-200 px-6 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
            How it works
          </a>
        </div>
      </section>

      {/* ── Preview mockup ── */}
      <section className="max-w-4xl mx-auto px-6 pb-20">
        <div className="rounded-2xl border border-gray-200 bg-gray-50 overflow-hidden shadow-sm">
          {/* Fake window bar */}
          <div className="flex items-center gap-1.5 border-b border-gray-200 bg-white px-4 py-3">
            <span className="h-3 w-3 rounded-full bg-red-300" />
            <span className="h-3 w-3 rounded-full bg-yellow-300" />
            <span className="h-3 w-3 rounded-full bg-green-300" />
            <span className="ml-4 text-xs text-gray-400">majlis.mohessaid.com/room/…</span>
          </div>
          {/* Fake sidebar + messages */}
          <div className="flex" style={{ minHeight: 260 }}>
            {/* Sidebar */}
            <div className="w-40 border-r border-gray-200 bg-white p-3 flex-shrink-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Models</p>
              {MODELS.map((m) => (
                <div key={m.id} className="flex items-center gap-2 py-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  <span className="text-xs font-medium" style={{ color: m.text }}>{m.label}</span>
                </div>
              ))}
            </div>
            {/* Messages */}
            <div className="flex-1 p-5 space-y-4">
              {/* User message */}
              <div className="flex justify-end">
                <div className="max-w-xs rounded-2xl rounded-tr-sm bg-gray-900 px-4 py-2.5">
                  <p className="text-sm text-white">What's the best database for a real-time chat app?</p>
                </div>
              </div>
              {/* AI responses */}
              {MODELS.slice(0, 2).map((m) => (
                <div key={m.id} className="flex gap-3">
                  <div className="h-7 w-7 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold border"
                    style={{ background: m.bg, color: m.text, borderColor: m.border }}>
                    {m.label[0]}
                  </div>
                  <div className="flex-1">
                    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold mb-1.5"
                      style={{ background: m.bg, color: m.text, borderColor: m.border }}>
                      {m.label}
                    </span>
                    <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 text-sm text-gray-700 shadow-xs">
                      {m.id === "llama"
                        ? "Redis with pub/sub is the go-to for real-time chat — sub-millisecond latency and built-in support for message queues."
                        : "I'd consider Firestore for its real-time listeners and horizontal scaling, though Redis wins on raw latency."}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="border-t border-gray-100 bg-gray-50 py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">How it works</p>
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Three steps to a better answer</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {HOW.map((step) => (
              <div key={step.n} className="rounded-2xl border border-gray-200 bg-white p-6">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white mb-4">
                  {step.n}
                </span>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Models ── */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">The lineup</p>
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Four models, one room</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {MODELS.map((m) => (
              <div key={m.id} className="flex items-center gap-4 rounded-2xl border border-gray-100 p-5">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center text-base font-bold border flex-shrink-0"
                  style={{ background: m.bg, color: m.text, borderColor: m.border }}>
                  {m.label[0]}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{m.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{m.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="border-t border-gray-100 bg-gray-900 py-20 px-6 text-center">
        <h2 className="text-3xl font-bold text-white mb-3">Ready to ask better questions?</h2>
        <p className="text-gray-400 mb-8 text-sm">Free. No credit card. Four models waiting.</p>
        {isSignedIn ? (
          <button
            onClick={handleStart}
            className="rounded-xl bg-white px-8 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-100 transition-colors"
          >
            Open the Room →
          </button>
        ) : (
          <SignInButton mode="modal">
            <button className="rounded-xl bg-white px-8 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-100 transition-colors">
              Get Started for Free →
            </button>
          </SignInButton>
        )}
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-100 py-6 text-center">
        <p className="text-xs text-gray-400">Majlis · Built at the hackathon · {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}
