# Repository Guidelines

## Project Overview
This project is a browser-based window manager. It runs entirely in the browser for the UI, with local infrastructure to create and manage shells, and a backend designed for future online hosting.

## Implementation Summary
- Frontend: The visual window manager UI in the browser.
- Middle layer: A Node/Express/Socket.IO server that creates shells and passes data between the shells and the frontend.
- Backend: A Python service that persists sessions for future online use.

## Future Online Hosting Notes
The backend is for a later stage where the system runs online (e.g., accessing it at window-manager.io). The idea is that, as long as the local Socket.IO server is running on a user's computer, it can connect to the backend and proxy a session to the browser. This will require an extremely secure approach, since it involves creating shells on users' machines. Security design is deferred for now.

## Developer Ergonomics
Developer ergonomics is a top priority. APIs should be simple, grammatically obvious, and easy to reason about. Keep each endpoint or channel narrowly scoped so one thing never does too much.

## Global State Management (MobX)
- We use MobX for global state.
- There are two types of stores:
  - Local stores live alongside components (e.g., `src/components/Terminal/store.ts`) and are only imported by that component tree.
  - Global stores live in `src/state` and are imported via `import { sessions } from "state"`.
- Global stores are split into:
  - Store classes (the collection/manager, e.g., `src/state/requirements/store.ts`).
  - Instance classes (individual entity instances, e.g., `src/state/requirements/instance.ts`).
- Global stores should expose:
  - Observable `instances` keyed by UUID.
  - Computed getters for derived lists.
  - Action methods for load/create/update/delete.
  - A `reset()` for cleanup when relevant.
- Update `tsconfig.json` paths to include `state` so `import { sessions } from "state"` works.
- MobX style:
  - Use `makeAutoObservable(this)` in the constructor.
  - Section order: `/* ---- Observables ---- */`, `/* ---- Actions ---- */`, `/* ---- Computed ---- */`, `/* ---- Clean-up ---- */`.
  - Use JSDoc comments for members/methods: `/** This is a comment */` so they show on hover.
  - Do not use inline end-of-line comments.
  - Keep defaults in a `DEFAULTS` object and reset from it.
  - Use 4-space indentation and double quotes.

## Project Structure & Module Organization
- `src/app` holds the Next.js App Router (`layout.tsx`, `page.tsx`) and `globals.css`.
- `public/` serves static assets (e.g., `/favicon.ico`).
- `db/` is a Django project with settings in `db/settings.py` and deps in `db/pyproject.toml`.

## Build, Test, and Development Commands
- `npm run dev` starts the Next.js dev server on http://localhost:43123.
- `npm run build` builds the production Next.js bundle.
- `npm run start` serves the production build.
- `npm run lint` runs ESLint.
- `npm run middle:dev` runs the local middle server (Node/Express).
- Django (from `db/`): `python manage.py runserver`.

## Agent Execution Rules
- Do not run linting commands in this repository.
- Specifically, never run `npm run lint`, `eslint`, or any lint auto-fix command.
- Do not run build commands in this repository.
- Specifically, never run `npm run build` or `next build`.

## Local Middle Server Notes (Orbit)
- Middle server lives in `middle/` and is split into:
  - `middle/server.ts` (bootstrap)
  - `middle/ws.ts` (Socket.IO)
  - `middle/api/*.ts` (REST)
  - `middle/utils/*.ts` (db/tmux)
- PTYs run via tmux. We use a dedicated tmux server name (`-L orbit`) and session prefix `orbit-<id>` (colon is not allowed).
- Tmux UI chrome (status/borders) is disabled at startup.
- SQLite DB at `middle/db.sqlite` contains:
  - `sessions` (session metadata)
  - `config` (key/value settings like wallpaper)
- New REST endpoints:
  - `GET /api/config`, `POST /api/config`
  - `POST /api/wallpaper` (multipart upload to `public/wallpapers/`)
  - Sessions: `POST/GET/PATCH/DELETE /api/session` and `GET /api/sessions`

## Frontend State Notes
- `src/state/config/index.ts` is a MobX store for global UI config:
  - gap/border/shadow, wallpaper selection, wallpaper styles
  - API calls for `/api/config` and `/api/wallpaper`
- `src/state/window-manager/store.ts` owns all session fetching/patching (API section)
  - `ensureWorkspaceSession`, `createTerminalSession`, `createWindowWithSession`, `bootstrap`
  - `sessionId` and `ready` are stored here (components should be dumb)

## Frontend (TypeScript)
- TypeScript/TSX uses 4-space indentation and double quotes (match existing files in `src/app`).
- Prefer PascalCase components and `camelCase` utilities.
- Leave two blank lines after the last import before other code.
- For `Button` components, prefer built-in props (`variant`, `size`, etc.) instead of ad-hoc Tailwind class strings. Only use custom button classes when absolutely necessary.

## Tailwind
- Always use Tailwind CSS for styling.
- Use the `cn` utility for class composition via `import { cn } from "@/lib/cn"`.
- Use `cn` object conditionals for dynamic classes (for example: `cn("flex flex-col", { hidden: ifSomething })`) instead of ternaries inside class strings.
- In `cn(...)`, group classes by category in one string argument per category (not one class per line), separated by commas.
- Keep category order consistent: positioning first, then flexbox/layout, then sizing (`w-*`, `h-*`) and spacing (`m-*`, `p-*`), then text, then background, then visual/interaction classes (`rounded-*`, `shadow-*`, `pointer-events-*`, animation, etc.).
- For text colors, prefer semantic classes such as `text-high` and `text-low` instead of raw Tailwind grays.
- Prefer semantic palette classes (`blue-high`, `blue-mid`, `blue-low`, `red-*`, `yellow-*`, `green-*`) over raw Tailwind color scale classes where equivalents exist.
- Prefer `gap-*` for spacing between sibling elements instead of margin where possible.
