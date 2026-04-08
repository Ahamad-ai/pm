# Frontend agent context

## Purpose

`frontend/` contains a Next.js App Router UI for a single-board Kanban app. It uses a fake sign-in gate, syncs board state with backend APIs, and includes an AI chat sidebar.

## Stack

- Next.js 16 + React 19 + TypeScript
- Tailwind CSS v4 via `@import "tailwindcss"` in `src/app/globals.css`
- Drag and drop with `@dnd-kit/core` and `@dnd-kit/sortable`
- Unit tests with Vitest + Testing Library
- E2E tests with Playwright
- Static export enabled via `next.config.ts` (`output: "export"`)

## App structure

- `src/app/page.tsx`: root route, renders `AuthShell`
- `src/components/AuthShell.tsx`: login gate (`user` / `password`), auth state via localStorage, logout control
- `src/components/BackendKanbanBoard.tsx`: loads/saves board through `/api/board`, wires AI chat calls, handles loading/save/chat states
- `src/components/ChatSidebar.tsx`: right sidebar chat widget with message history and send form
- `src/components/KanbanBoard.tsx`: board interaction UI (rename, add/remove, drag/drop), supports controlled state
- `src/components/KanbanColumn.tsx`: editable column title, droppable area, card list
- `src/components/KanbanCard.tsx`: sortable card item and delete action
- `src/components/NewCardForm.tsx`: inline add-card form per column
- `src/components/KanbanCardPreview.tsx`: drag overlay preview card
- `src/lib/kanban.ts`: board types, seeded board data, `moveCard`, `createId`
- `src/lib/boardApi.ts`: API client for `GET/PUT /api/board` and `POST /api/chat`

## Data model (current)

- Board shape:
  - `columns: { id, title, cardIds[] }[]`
  - `cards: Record<string, { id, title, details }>`
- Initial board data lives in `src/lib/kanban.ts`
- Board persistence uses backend `/api/board` with `X-Username: user`
- AI chat uses backend `/api/chat` with `X-Username: user`
- Local auth persistence remains client-side only (`localStorage`)

## Testing

- Unit/component tests:
  - `src/components/KanbanBoard.test.tsx`
  - `src/components/BackendKanbanBoard.test.tsx`
  - `src/components/ChatSidebar.tsx` behavior is covered via `BackendKanbanBoard` integration-focused tests
  - `src/components/AuthShell.test.tsx`
  - `src/lib/kanban.test.ts`
- E2E tests:
  - `tests/kanban.spec.ts`
  - `tests-backend/kanban.backend.spec.ts` (runs against backend-served static build)
- Commands:
  - `npm run test:unit`
  - `npm run test:e2e`
  - `npm run test:e2e:backend`
  - `npm run test:all`

## UI and styling notes

- Theme tokens in `src/app/globals.css` mirror project palette from root `AGENTS.md`
- Main typography from `next/font/google` in `src/app/layout.tsx`
- Current UX focus: simple, gated single-board workflow with login/logout, AI sidebar chat, rename, add/remove, and drag/drop

## Constraints for future work

- Keep implementation simple; avoid introducing unnecessary abstractions
- Preserve existing test coverage and add integration tests for new cross-layer behavior
- Prepare components for eventual API-driven state without over-engineering before backend wiring
