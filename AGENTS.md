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

## Backend (Python)
- Python follows standard Django/PEP 8 conventions with 4-space indentation.
- Leave two blank lines after the last import before other code.

## Backend (Python) Model Pattern
- Django models should expose stable UUIDs, created/edited timestamps, typed relationships, and a `serialized` property for API payloads.
- Prefer `TYPE_CHECKING` blocks to provide precise types for relations without runtime imports.
- Model order: fields/values, then `@property` methods, then other methods. At the bottom: `__str__`, then `@property serialized`.
- Import order: typing at top, installed packages in the middle, then a blank line, then local imports.
- Example imports:
```python
from __future__ import annotations
from typing import TYPE_CHECKING, Union

from django.db import models
import logging
import uuid as uuid_lib


from .history import get_history
```
- Example model:
```python
class Chat(models.Model):
    uuid = models.UUIDField(
        default=uuid_lib.uuid4,
        db_index=True,
        editable=False,
        unique=True
    )

    date_created = models.DateTimeField(
        auto_now_add=True
    )

    date_edited = models.DateTimeField(
        auto_now=True
    )

    creator = models.ForeignKey(
        'Account',
        related_name='chats',
        on_delete=models.CASCADE,
    ) # type: ignore

    if TYPE_CHECKING:
        from api.models.account.model import Account
        from api.models.project.model import Project

        id: int

        creator: Account
        project: Project
        role: Role
        file: Union[File, None]
        product: Union[Product, None]
        requirement: Union[Requirement, None]
        task: Union[Task, None]
        vendor_portal: Union[VendorPortal, None]

        messages: models.ManyToManyField[Message, Chat]

    def __str__(self):
        return f'Chat - { self.project.name }/{ self.role.name }'

    @property
    def serialized(self):
        return {
            'uuid': str(self.uuid),

            'dateCreated': self.date_created.isoformat(),
            'dateEdited': self.date_edited.isoformat() if self.date_edited else None,

            'creator': str(self.creator.uuid),
            'project': str(self.project.uuid),
            'role': str(self.role.name),

            'file': str(self.file.uuid) if self.file else None,
            'product': str(self.product.uuid) if self.product else None,
            'requirement': str(self.requirement.uuid) if self.requirement else None,
            'task': str(self.task.uuid) if self.task else None,
            'vendorPortal': str(self.vendor_portal.uuid) if self.vendor_portal else None,

            'name': self.name,

            'messages': [str(message.uuid) for message in self.messages.all()],
        }
```

## Testing Guidelines
- No automated tests yet. If added, document the command and use `*.test.tsx` or `*.spec.ts`.

## Commit & Pull Request Guidelines
- No established convention yet. Use imperative commits (e.g., `Add landing page layout`) and include PR summary, testing notes, and UI screenshots when relevant.

## Configuration Tips
- Put Next.js env vars in `.env.local` and keep Node deps at root, Python deps in `db/`.
