from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field


class Room(SQLModel, table=True):
    id: str = Field(primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    question: str
    category: str
    status: str = "active"  # active | ended
    overall_rating: Optional[int] = None
    user_id: Optional[str] = None  # Clerk user ID


class Participant(SQLModel, table=True):
    id: str = Field(primary_key=True)
    room_id: str = Field(foreign_key="room.id")
    model_id: str
    display_name: str
    joined_at: datetime = Field(default_factory=datetime.utcnow)
    dismissed_at: Optional[datetime] = None
    dismissal_reason: Optional[str] = None
    capabilities: str = "{}"  # JSON: {web_search, thinking, fast_mode}


class Message(SQLModel, table=True):
    id: str = Field(primary_key=True)
    room_id: str = Field(foreign_key="room.id")
    participant_id: Optional[str] = None  # null = user message
    layer: str  # user | surface | depth | thinking | curator
    content: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    searched: bool = False


class ReputationScore(SQLModel, table=True):
    model_id: str = Field(primary_key=True)
    category: str = Field(primary_key=True)
    score: float = 0.5
    total_sessions: int = 0
    total_dismissals: int = 0
    last_updated: datetime = Field(default_factory=datetime.utcnow)
