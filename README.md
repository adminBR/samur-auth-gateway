# ServicesQuickAuth API Gateway

Centralized authentication and routing solution for a microservices environment. NGINX acts as the gateway, the Django backend validates access, and the React frontend provides login plus admin management for services, access analytics, users, and generated NGINX config.

## Architecture

- `frontend/`
  React + Vite portal for login, indicator access, admin user management, service management, access analytics, and NGINX publishing
- `backend/`
  Django REST backend for auth, service CRUD, access analytics queries, NGINX config generation/deploy, and work-order endpoints
- `backend/nginx/header.local.conf`
  machine-local NGINX header template used as the base for generated gateway config

## Requirements

- Node.js 18+
- npm
- Python 3.11+ recommended
- PostgreSQL reachable by the backend
- optional: Docker + Docker Compose

## Installation

### 1. Clone the project

```powershell
git clone <your-repo-url>
cd authetication-page
```

### 2. Create the backend env file

The backend loads environment variables from [backend/.env](./backend/.env). Docker also expects this same file through [`docker-compose.yaml`](./docker-compose.yaml).

Create `backend/.env` with at least:

```env
DJANGO_SECRET_KEY=change-me
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=127.0.0.1,localhost,0.0.0.0
DJANGO_TIME_ZONE=UTC

DJANGO_DB_HOST=127.0.0.1
DJANGO_DB_PORT=5432
DJANGO_DB_NAME=auth_service
DJANGO_DB_USER=postgres
DJANGO_DB_PASSWORD=postgres
DJANGO_DB_CONNECT_TIMEOUT=5

AUTH_ANALYTICS_DATABASE_URL=postgresql://postgres:postgres@192.168.1.16:5432/auth_gateway
AUTH_ANALYTICS_DB_CONNECT_TIMEOUT=5

AUTH_TOKEN_ALGORITHM=HS256
AUTH_ACCESS_TOKEN_DEFAULT_DAYS=1
AUTH_REFRESH_TOKEN_DAYS=90
AUTH_ACCESS_TOKEN_COOKIE_NAME=token
AUTH_REFRESH_TOKEN_COOKIE_NAME=refresh_token
AUTH_COOKIE_DOMAIN=
AUTH_COOKIE_PATH=/
AUTH_COOKIE_SAMESITE=Lax
AUTH_COOKIE_SECURE=False
AUTH_COOKIE_HTTPONLY=True
AUTH_INFINITE_TOKEN_COOKIE_MAX_AGE_SECONDS=630720000

DJANGO_CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:1111
DJANGO_CORS_ALLOW_ALL_ORIGINS=False
DJANGO_CORS_ALLOW_CREDENTIALS=True
DJANGO_CSRF_TRUSTED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:1111

DJANGO_LOG_LEVEL=INFO
```

Notes:

- database connection values are read by [`backend/utils/database.py`](./backend/utils/database.py)
- analytics log database values are read by [`backend/utils/analytics_database.py`](./backend/utils/analytics_database.py)
- auth, cookie, CORS, logging, and host settings are read by [`backend/serviceauth/settings.py`](./backend/serviceauth/settings.py)
- the env loader is implemented in [`backend/utils/env.py`](./backend/utils/env.py)

### 3. Create the NGINX reference/header file

The backend NGINX generator looks for:

1. [`backend/nginx/header.local.conf`](./backend/nginx/header.local.conf)
2. fallback: [`backend/nginx/header.example.conf`](./backend/nginx/header.example.conf)

Recommended setup:

```powershell
Copy-Item backend\nginx\header.example.conf backend\nginx\header.local.conf
```

Then edit `backend/nginx/header.local.conf` for your real environment:

- `server_name`
- TLS certificate paths
- upstream addresses
- any static gateway rules you want before the generated service blocks

Important:

- keep `{{SYSTEM_GENERATED_PATHS}}` in the file
- this placeholder is replaced by the per-service frontend/backend blocks stored in the database
- the loader for this behavior is in [`backend/nginx/reference.py`](./backend/nginx/reference.py)

### 4. Install backend dependencies

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
cd ..
```

### 5. Install frontend dependencies

```powershell
cd frontend
npm install
cd ..
```

### 6. Prepare the database

This project uses direct PostgreSQL access for most business data, not Django ORM models for the main flows.

At minimum, create the required schema before running the app:

- `usr_info`
- `services_info`
- `services_category`
- `usr_favorite_services`
- `services_conf_log`

Reference files:

- [`backend/ddl.sql`](./backend/ddl.sql)
- [`backend/sql/`](./backend/sql/)
- [`backend/BACKEND_REFERENCE.md`](./backend/BACKEND_REFERENCE.md)

## Running Locally

### Backend

```powershell
cd backend
.venv\Scripts\Activate.ps1
python manage.py runserver 0.0.0.0:8000
```

### Frontend

```powershell
cd frontend
npm run dev
```

Default local ports in this repo:

- frontend dev/build container: `1111`
- backend container: `1112`
- Vite dev server: usually `5173`

## Running With Docker

Run both services:

```powershell
docker compose up --build
```

Or run one side only:

```powershell
docker compose -f docker-compose.backend.yaml up --build
docker compose -f docker-compose.frontend.yaml up --build
```

Current compose files:

- [`docker-compose.yaml`](./docker-compose.yaml)
- [`docker-compose.backend.yaml`](./docker-compose.backend.yaml)
- [`docker-compose.frontend.yaml`](./docker-compose.frontend.yaml)

## Env Files In This Repo

- required: [`backend/.env`](./backend/.env)
- current frontend setup: no dedicated `frontend/.env` file is required by the checked-in code

If you later introduce frontend env vars, document them in this README and the frontend reference file.

## NGINX Reference Files

- machine-local template used by the backend generator:
  [`backend/nginx/header.local.conf`](./backend/nginx/header.local.conf)
- tracked example template:
  [`backend/nginx/header.example.conf`](./backend/nginx/header.example.conf)
- loader:
  [`backend/nginx/reference.py`](./backend/nginx/reference.py)
- example generated gateway configs:
  [`extra/example.conf`](./extra/example.conf)
  [`extra/api-gateway.conf`](./extra/api-gateway.conf)

## Useful Docs

- backend reference:
  [`backend/BACKEND_REFERENCE.md`](./backend/BACKEND_REFERENCE.md)
- frontend reference:
  [`frontend/FRONTEND_DESIGN_STRUCTURE.md`](./frontend/FRONTEND_DESIGN_STRUCTURE.md)

## Summary

This project provides a centralized auth-gateway pattern where NGINX enforces access, Django validates identity and permissions, and the frontend manages the operational UI. The minimum setup is: create `backend/.env`, create `backend/nginx/header.local.conf` from the example template, install backend/frontend dependencies, and point the backend to a ready PostgreSQL schema.
