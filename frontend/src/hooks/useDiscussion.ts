import { useState, useRef, useCallback, useEffect } from "react";
import { streamDiscussion, getMessages, type DiscussionChunk, type HistoryMessage } from "../lib/api";

export interface MessageBubble {
  id: string;
  participant_id: string;
  model_id: string;
  display_name: string;
  layer: "user" | "surface" | "depth" | "thinking" | "curator" | "discuss";
  content: string;
  streaming: boolean;
  searched: boolean;
  isCurator: boolean;
}

function historyToMessage(h: HistoryMessage): MessageBubble {
  return {
    id: h.id,
    participant_id: h.participant_id,
    model_id: h.model_id ?? (h.layer === "user" ? "user" : "unknown"),
    display_name: h.display_name,
    layer: h.layer as MessageBubble["layer"],
    content: h.content,
    streaming: false,
    searched: h.searched,
    isCurator: h.layer === "curator",
  };
}

export function useDiscussion(
  roomId: string,
  getToken: () => Promise<string | null>
) {
  const [messages, setMessages] = useState<MessageBubble[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const cancelRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!roomId || historyLoaded) return;
    getToken().then((token) =>
      getMessages(roomId, token ?? undefined)
        .then((hist) => {
          setMessages(hist.map(historyToMessage));
          setHistoryLoaded(true);
        })
        .catch(() => setHistoryLoaded(true))
    );
  }, [roomId]);

  const appendChunk = useCallback((
    participantId: string,
    modelId: string,
    layer: string,
    chunk: string,
    displayNames: Record<string, string>
  ) => {
    setMessages((prev) => {
      const existing = [...prev];
      const lastIdx = existing.findLastIndex(
        (m) => m.participant_id === participantId && m.layer === layer && m.streaming
      );
      if (lastIdx >= 0) {
        existing[lastIdx] = { ...existing[lastIdx], content: existing[lastIdx].content + chunk };
        return existing;
      }
      return [
        ...existing,
        {
          id: `${participantId}-${layer}-${Date.now()}`,
          participant_id: participantId,
          model_id: modelId,
          display_name: displayNames[participantId] || modelId,
          layer: layer as MessageBubble["layer"],
          content: chunk,
          streaming: true,
          searched: false,
          isCurator: layer === "curator",
        },
      ];
    });
  }, []);

  const finalizeMessage = useCallback((participantId: string, layer: string, searched: boolean) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.participant_id === participantId && m.layer === layer && m.streaming
          ? { ...m, streaming: false, searched }
          : m
      )
    );
  }, []);

  const send = useCallback(
    async (
      message: string,
      displayNames: Record<string, string>,
      targetParticipantId?: string,
      mode?: string,
      forceWebSearch?: boolean
    ) => {
      if (streaming) return;

      const token = await getToken();

      setMessages((prev) => [
        ...prev,
        {
          id: `user-${Date.now()}`,
          participant_id: "user",
          model_id: "user",
          display_name: "You",
          layer: "user",
          content: message,
          streaming: false,
          searched: false,
          isCurator: false,
        },
      ]);

      setStreaming(true);

      const cancel = streamDiscussion(
        {
          room_id: roomId,
          message,
          target_participant_id: targetParticipantId,
          mode,
          force_web_search: !!forceWebSearch,
        },
        token,
        (chunk: DiscussionChunk) => {
          if (chunk.done) {
            finalizeMessage(chunk.participant_id, chunk.layer, chunk.searched ?? false);
          } else if (chunk.chunk) {
            appendChunk(chunk.participant_id, chunk.model_id, chunk.layer, chunk.chunk, displayNames);
          }
        },
        () => setStreaming(false),
        () => setStreaming(false)
      );

      cancelRef.current = cancel;
    },
    [roomId, streaming, getToken, appendChunk, finalizeMessage]
  );

  const requestDepth = useCallback(
    (participantId: string, displayNames: Record<string, string>) => {
      send("Please elaborate and go deeper on your previous response.", displayNames, participantId);
    },
    [send]
  );

  const requestDiscussion = useCallback(
    (
      lastResponses: MessageBubble[],
      displayNames: Record<string, string>,
      prompt: { label: string; instruction: string },
      activeParticipantIds: Set<string>,
      forceWebSearch: boolean
    ) => {
      if (streaming) return;
      const modelMsgs = lastResponses.filter(
        (m) =>
          m.layer !== "user" &&
          m.layer !== "curator" &&
          activeParticipantIds.has(m.participant_id)
      );
      if (modelMsgs.length === 0) return;
      const context = modelMsgs
        .map((m) => `${m.display_name}: "${m.content.slice(0, 250)}${m.content.length > 250 ? "…" : ""}"`)
        .join("\n\n");
      const message = [
        `Curator move: ${prompt.label}`,
        "",
        prompt.instruction,
        "",
        "Active panel only — do not reference anyone removed from the room.",
        "",
        "---",
        context,
      ].join("\n");
      send(message, displayNames, undefined, "discuss", forceWebSearch);
    },
    [send, streaming]
  );

  return { messages, streaming, historyLoaded, send, requestDepth, requestDiscussion };
}
