const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

function headers(token?: string | null): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

export interface Participant {
  id: string;
  model_id: string;
  display_name: string;
  capabilities: { web_search: boolean; thinking: boolean; fast_mode: boolean };
  dismissed: boolean;
  dismissal_reason?: string;
}

export interface Room {
  room_id: string;
  question: string;
  category: string;
  status: string;
  participants: Participant[];
}

export interface ModelInfo {
  model_id: string;
  display_name: string;
  score: number;
  total_sessions: number;
  supports_thinking: boolean;
}

export interface Recommendation {
  model_id: string;
  display_name: string;
  reputation_score: number;
  reason: string;
  suggested_capabilities: { web_search: boolean; thinking: boolean; fast_mode: boolean };
}

export interface CreateRoomResponse {
  room_id: string;
  question: string;
  detected_category: string;
  curator_recommendations: Recommendation[];
  curator_notes?: string;
  all_models: ModelInfo[];
}

export async function createRoom(question: string, token?: string): Promise<CreateRoomResponse> {
  const res = await fetch(`${BASE}/room/create`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ question }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getRoom(roomId: string, token?: string): Promise<Room> {
  const res = await fetch(`${BASE}/room/${roomId}`, { headers: headers(token) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function addParticipant(
  roomId: string,
  modelId: string,
  capabilities: { web_search: boolean; thinking: boolean; fast_mode: boolean },
  token?: string
): Promise<{ participant_id: string; curator_warning?: string; reputation_score: number }> {
  const res = await fetch(`${BASE}/room/${roomId}/participant/add`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ model_id: modelId, capabilities }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function dismissParticipant(
  roomId: string,
  participantId: string,
  reason: string,
  token?: string
): Promise<{ score_delta: number; new_score: number; curator_suggestion?: { model_id: string; reason: string } }> {
  const res = await fetch(`${BASE}/room/${roomId}/participant/${participantId}/dismiss`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function endRoom(
  roomId: string,
  rating: number,
  token?: string
): Promise<object> {
  const res = await fetch(`${BASE}/room/${roomId}/end`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ overall_rating: rating }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getAvailableModels(roomId: string, token?: string): Promise<{ models: ModelInfo[]; category: string }> {
  const res = await fetch(`${BASE}/curator/models?room_id=${roomId}`, { headers: headers(token) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export interface RoomSummary {
  room_id: string;
  question: string;
  category: string;
  status: string;
  created_at: string;
  overall_rating: number | null;
  models: string[];
  participant_count: number;
}

export async function getDiscussPrompts(token?: string): Promise<DiscussPrompt[]> {
  const res = await fetch(`${BASE}/curator/discuss-prompts`, { headers: headers(token) });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.prompts as DiscussPrompt[];
}

export interface DiscussPrompt {
  id: string;
  label: string;
  instruction: string;
}

export async function listRooms(token?: string): Promise<RoomSummary[]> {
  const res = await fetch(`${BASE}/rooms`, { headers: headers(token) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export interface HistoryMessage {
  id: string;
  participant_id: string;
  model_id: string | null;
  display_name: string;
  layer: "user" | "surface" | "depth" | "thinking" | "curator" | "discuss";
  content: string;
  searched: boolean;
  created_at: string;
}

export async function getMessages(roomId: string, token?: string): Promise<HistoryMessage[]> {
  const res = await fetch(`${BASE}/room/${roomId}/messages`, { headers: headers(token) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function streamDiscussion(
  params: {
    room_id: string;
    message: string;
    target_participant_id?: string;
    mode?: string;
    force_web_search?: boolean;
  },
  token: string | null | undefined,
  onChunk: (event: DiscussionChunk) => void,
  onDone: () => void,
  onError: (e: Error) => void
): () => void {
  let cancelled = false;

  (async () => {
    try {
      const res = await fetch(`${BASE}/discuss`, {
        method: "POST",
        headers: headers(token),
        body: JSON.stringify(params),
      });

      if (!res.ok) throw new Error(await res.text());
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (!cancelled) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (!data) continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === "stream_end") continue;
              onChunk(parsed);
            } catch {
              // skip malformed
            }
          }
        }
      }

      if (!cancelled) onDone();
    } catch (e) {
      if (!cancelled) onError(e as Error);
    }
  })();

  return () => { cancelled = true; };
}

export interface DiscussionChunk {
  participant_id: string;
  model_id: string;
  layer: "surface" | "depth" | "thinking" | "curator" | "discuss";
  chunk?: string;
  done?: boolean;
  searched?: boolean;
  thinking_available?: boolean;
  message_id?: string;
  is_curator?: boolean;
}
