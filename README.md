# SynthoSite

SynthoSite is a full-stack student web application that lets registered users describe the website they want, generate a complete HTML/CSS page with an OpenAI-compatible AI provider, store the generated code in MySQL, preview it safely, and share it through a public URL.

The project follows the client-server assignment option with a React/Vite frontend, a Node.js/Express backend, and a MySQL database.

## Features

- User signup and login with JWT authentication.
- Password hashing with bcrypt.
- AI website generation through a backend provider registry with automatic fallback on quota or provider availability errors.
- User-facing AI model selection without exposing provider URLs or keys.
- Project CRUD with owner-based access control.
- Project search, sort, and type filtering.
- Safe generated-site preview inside a sandboxed iframe.
- Public share URL for generated pages: `/p/:id`.
- HTML download for generated projects.
- Admin dashboard for listing and deleting users and projects.
- Backend tests with Jest and Supertest.
- GitHub Actions CI for backend tests and frontend build.

## Tech Stack

- Frontend: React, Vite, React Router, React-Bootstrap, Bootstrap, Axios.
- Backend: Node.js, Express, mysql2, bcrypt, jsonwebtoken, cors, dotenv, express-validator, express-rate-limit.
- Database: MySQL 8+.
- AI API: OpenAI-compatible APIs such as Gemini, Groq, Mistral, or Cerebras.
- Tests: Jest and Supertest.

## Project Structure

```text
backend/
  src/
    config/
    controllers/
    middleware/
    routes/
    services/
    app.js
    server.js
  db/schema.sql
  db/migrations/
  scripts/init-db.js
  scripts/migrate-db.js
  tests/

frontend/
  src/
    api/
    components/
    context/
    pages/
    App.jsx
    main.jsx
```

## Prerequisites

- Node.js 20 or newer.
- npm.
- A MySQL 8+ database. The production recommendation is Aiven MySQL.
- A Gemini API key, plus optional Groq, Mistral, and Cerebras API keys for additional providers.

## Environment Variables

Never commit real secrets. The real local files are ignored by Git.

Backend example:

```bash
cp backend/.env.example backend/backend.env
```

Required backend variables:

```env
PORT=3000
DB_HOST=
DB_PORT=3306
DB_USER=
DB_PASSWORD=
DB_NAME=synthosite
DB_SSL_REJECT_UNAUTHORIZED=false
JWT_SECRET=change_me
AI_API_KEY=
GEMINI_API_KEY=
GROQ_API_KEY=
MISTRAL_API_KEY=
CEREBRAS_API_KEY=
CORS_ORIGIN=http://localhost:5173
```

Use `DB_SSL_REJECT_UNAUTHORIZED=false` locally with Aiven if Node reports a self-signed certificate chain. For stricter production setups, configure the provider CA certificate and use `true`.

`AI_API_KEY` is kept as a legacy local fallback for Gemini. New deployments should use `GEMINI_API_KEY`. `GROQ_API_KEY`, `MISTRAL_API_KEY`, and `CEREBRAS_API_KEY` enable the additional fallback providers.

Frontend example:

```bash
cp frontend/.env.example frontend/frontend.env
```

Required frontend variable:

```env
VITE_API_URL=http://127.0.0.1:3000/api
```

`127.0.0.1` avoids local conflicts where another tool may bind to `localhost` through IPv6.

## Installation

From the repository root:

```bash
npm run install:all
```

Or install each app separately:

```bash
npm install --prefix backend
npm install --prefix frontend
```

## Database Setup

The SQL schema is stored in:

```text
backend/db/schema.sql
```

Initialize the configured database:

```bash
npm run db:init --prefix backend
```

The script creates the `users` and `projects` tables from `schema.sql`.

If the tables already exist, MySQL will return an error. In that case, the database has already been initialized.

For an existing database created before AI model tracking was added, run:

```bash
npm run db:migrate --prefix backend
```

This adds `projects.model_used` if it is missing.

To promote a user to admin:

```sql
UPDATE users SET role = 'admin' WHERE email = 'your-email@example.com';
```

Log out and log back in after changing the role so the JWT contains the updated role.

## Running Locally

Start the backend:

```bash
npm run dev:backend
```

Start the frontend in another terminal:

```bash
npm run dev:frontend
```

Open:

```text
http://localhost:5173
```

Health check:

```text
http://127.0.0.1:3000/api/health
```

## Main API Routes

Auth:

- `POST /api/auth/signup`
- `POST /api/auth/login`

Projects:

- `GET /api/projects?search=&sort=&type=`
- `GET /api/projects/:id`
- `POST /api/projects/generate`
- `PUT /api/projects/:id`
- `DELETE /api/projects/:id`

Models and usage:

- `GET /api/models`
- `GET /api/usage`

Admin:

- `GET /api/admin/users`
- `DELETE /api/admin/users/:id`
- `GET /api/admin/projects`
- `DELETE /api/admin/projects/:id`

Public:

- `GET /p/:id`

## Tests

Run backend tests:

```bash
npm test --prefix backend
```

The test suite covers:

- Signup creates a user with a hashed password.
- Login returns a JWT.
- Login rejects a wrong password.
- Protected project route rejects missing JWT.
- Protected project route accepts a valid JWT.
- Admin routes reject non-admin users.
- Admin routes return data for admin users.
- Model routes return public model labels only.
- Usage routes return every registered model, including zero-usage models.
- AI generation falls back to the next provider when a provider returns quota, invalid-key, unavailable-model, or temporary server errors.

## Build

Build the frontend:

```bash
npm run build --prefix frontend
```

## Deployment

Recommended deployment targets:

- Frontend: Vercel.
- Backend: Render.
- Database: Aiven MySQL.

### Aiven MySQL

1. Create a MySQL service on Aiven.
2. Copy host, port, user, password, and database name.
3. Set these values in Render environment variables.
4. Run `backend/db/schema.sql` once, either with a MySQL client or locally through `npm run db:init --prefix backend`.
5. For existing databases, run `npm run db:migrate --prefix backend` once to add newer columns.

### Render Backend

Create a new Web Service from the repository.

Recommended settings:

- Root directory: `backend`
- Build command: `npm install`
- Start command: `npm start`

Required environment variables:

- `PORT`
- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `DB_SSL_REJECT_UNAUTHORIZED`
- `JWT_SECRET`
- `GEMINI_API_KEY`
- `GROQ_API_KEY`
- `MISTRAL_API_KEY`
- `CEREBRAS_API_KEY`
- `CORS_ORIGIN`

Set `CORS_ORIGIN` to the deployed Vercel frontend URL.

### Vercel Frontend

Create a new Vercel project from the repository.

Recommended settings:

- Root directory: `frontend`
- Build command: `npm run build`
- Output directory: `dist`

Required environment variable:

- `VITE_API_URL=https://your-render-backend-url.onrender.com/api`

## CI/CD

The workflow is defined in:

```text
.github/workflows/ci.yml
```

On push and pull requests, GitHub Actions:

1. Installs backend dependencies.
2. Runs backend tests.
3. Installs frontend dependencies.
4. Builds the frontend.

Secrets are not stored in the repository. Production secrets must be configured in GitHub Actions, Render, Vercel, and Aiven dashboards.

## Security Notes

- AI API keys and database credentials are server-side only.
- Passwords are stored as bcrypt hashes in `password_hash`.
- JWT payload contains only `id` and `role`.
- SQL queries use placeholders and parameter arrays.
- Generated AI HTML is treated as untrusted content.
- The frontend previews generated HTML only inside a sandboxed iframe.
- The frontend sends only model IDs such as `gemini-flash`, never provider URLs or API keys.
- `/api/models` returns only public IDs and labels.
- `/api/usage` returns only model IDs, labels, estimated usage, and estimated limits.
- Sensitive routes are protected by JWT and admin routes require `role = admin`.
- Auth and generation routes are rate-limited.

## Assignment Checklist

- Styles with React-Bootstrap and a global design system.
- Complete project CRUD.
- Search, sort, and filtering.
- Public section, user accounts, login, and admin section.
- MySQL database script.
- Backend security tests.
- Cloud deployment plan for Vercel, Render, and Aiven.
- GitHub Actions CI/CD workflow.
