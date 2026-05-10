"""
Seed the reputation database with realistic starting data.
Run: python seed_db.py
"""
from datetime import datetime
from database import create_db_and_tables, engine
from models import ReputationScore
from sqlmodel import Session, select


SEED_DATA = [
    # recent_events — search-capable models score high
    ("llama-3.1-8b", "recent_events", 0.45, 10, 5),
    ("qwen2.5-7b", "recent_events", 0.55, 8, 3),
    ("mistral-7b", "recent_events", 0.40, 9, 5),
    ("deepseek-r1-8b", "recent_events", 0.48, 6, 3),
    # coding — reasoning models shine
    ("llama-3.1-8b", "coding", 0.70, 14, 2),
    ("qwen2.5-7b", "coding", 0.75, 12, 1),
    ("mistral-7b", "coding", 0.65, 10, 2),
    ("deepseek-r1-8b", "coding", 0.82, 11, 1),
    # philosophy — depth models win
    ("llama-3.1-8b", "philosophy", 0.60, 8, 2),
    ("qwen2.5-7b", "philosophy", 0.68, 7, 1),
    ("mistral-7b", "philosophy", 0.55, 6, 2),
    ("deepseek-r1-8b", "philosophy", 0.72, 9, 1),
    # science
    ("llama-3.1-8b", "science", 0.65, 10, 2),
    ("qwen2.5-7b", "science", 0.70, 9, 1),
    ("mistral-7b", "science", 0.60, 8, 2),
    ("deepseek-r1-8b", "science", 0.78, 11, 1),
    # mathematics
    ("llama-3.1-8b", "mathematics", 0.62, 7, 2),
    ("qwen2.5-7b", "mathematics", 0.68, 8, 1),
    ("mistral-7b", "mathematics", 0.58, 6, 2),
    ("deepseek-r1-8b", "mathematics", 0.80, 9, 0),
    # politics
    ("llama-3.1-8b", "politics", 0.55, 6, 2),
    ("qwen2.5-7b", "politics", 0.58, 5, 2),
    ("mistral-7b", "politics", 0.50, 7, 3),
    ("deepseek-r1-8b", "politics", 0.60, 6, 2),
    # general
    ("llama-3.1-8b", "general", 0.65, 20, 5),
    ("qwen2.5-7b", "general", 0.68, 18, 4),
    ("mistral-7b", "general", 0.62, 16, 5),
    ("deepseek-r1-8b", "general", 0.70, 15, 3),
]


def seed():
    create_db_and_tables()
    with Session(engine) as session:
        for model_id, category, score, total_sessions, total_dismissals in SEED_DATA:
            existing = session.exec(
                select(ReputationScore).where(
                    ReputationScore.model_id == model_id,
                    ReputationScore.category == category,
                )
            ).first()
            if not existing:
                session.add(ReputationScore(
                    model_id=model_id,
                    category=category,
                    score=score,
                    total_sessions=total_sessions,
                    total_dismissals=total_dismissals,
                    last_updated=datetime.utcnow(),
                ))
        session.commit()
        print(f"Seeded {len(SEED_DATA)} reputation score entries.")


if __name__ == "__main__":
    seed()
