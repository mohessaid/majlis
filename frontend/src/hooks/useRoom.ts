import { useState, useCallback } from "react";
import type { Room, Participant } from "../lib/api";

export function useRoom() {
  const [room, setRoom] = useState<Room | null>(null);

  const updateParticipant = useCallback((id: string, patch: Partial<Participant>) => {
    setRoom((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        participants: prev.participants.map((p) =>
          p.id === id ? { ...p, ...patch } : p
        ),
      };
    });
  }, []);

  const addParticipantLocal = useCallback((participant: Participant) => {
    setRoom((prev) => {
      if (!prev) return prev;
      return { ...prev, participants: [...prev.participants, participant] };
    });
  }, []);

  return { room, setRoom, updateParticipant, addParticipantLocal };
}
