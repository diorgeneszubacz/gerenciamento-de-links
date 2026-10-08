# Single container: builds the React frontend, then serves it (StaticFiles/SPA
# fallback in backend/server.py) together with the FastAPI API, both on :8001.
# Coolify (Docker Compose build pack) builds this from the repo root.

# ---- stage 1: compile the frontend to static files ----
FROM node:20-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/ ./
RUN yarn install && yarn build

# ---- stage 2: python runtime that serves API + the compiled frontend ----
FROM python:3.11-slim AS runtime
WORKDIR /app

COPY backend/requirements-docker.txt backend/requirements-docker.txt
RUN apt-get update \
    && apt-get install -y --no-install-recommends iputils-ping \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir -r backend/requirements-docker.txt

COPY backend/ backend/
COPY --from=frontend-build /app/frontend/dist frontend/dist

EXPOSE 8001
WORKDIR /app/backend
CMD ["python", "-m", "uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]
