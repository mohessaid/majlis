import { useState, useRef, useCallback } from "react";
import { streamDiscussion, type DiscussionChunk } from "../lib/api";

export interface MessageBubble {
  id: string;
  participant_id: string;
  model_id: string;
  display_name: string;
  layer: "user" | "surface" | "depth" | "thinking" | "curator";
  content: string;
  streaming: boolean;
  searched: boolean;
  isCurator: boolean;
}

export function useDiscussion(roomId: string, token: string | null | undefined) {
  const [messages, setMessages] = useState<MessageBubble[]>([]);
  const [streaming, setStreaming] = useState(false);
  const cancelRef = useRef<(() => void) | null>(null);

  const appendChunk = useCallback((participantId: string, modelId: string, layer: string, chunk: string, displayNames: Record<string, string>) => {
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
    setMessages((prev) => {
      return prev.map((m) =>
        m.participant_id === participantId && m.layer === layer && m.streaming
          ? { ...m, streaming: false, searched }
          : m
      );
    });
  }, []);

  const send = useCallback(
    (message: string, displayNames: Record<string, string>, targetParticipantId?: string) => {
      if (streaming) return;

      // Add user message locally
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
        { room_id: roomId, message, target_participant_id: targetParticipantId },
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
    [roomId, token, streaming, appendChunk, finalizeMessage]
  );

  const requestDepth = useCallback(
    (participantId: string, displayNames: Record<string, string>) => {
      send("Please elaborate and go deeper on your previous response.", displayNames, participantId);
    },
    [send]
  );

  return { messages, streaming, send, requestDepth };
}
