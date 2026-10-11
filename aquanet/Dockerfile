# ---- Bước 1: build giao diện React ----
FROM node:20-alpine AS web
WORKDIR /web
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# ---- Bước 2: API FastAPI + phục vụ giao diện ----
FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./
COPY --from=web /web/dist ./static
EXPOSE 8000
CMD ["sh", "-c", "if [ \"$SEED_DEMO\" = \"1\" ]; then python -m app.seed; fi; uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers ${WORKERS:-2}"]
