FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Seed the database on first run via entrypoint
ENTRYPOINT ["sh", "-c", "python seed_db.py && uvicorn main:app --host 0.0.0.0 --port 8000 --workers 2"]
