# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Initial setup (install dependencies, generate Prisma client, run migrations)
npm run setup

# Development server (uses Turbopack)
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Run a single test file
npx vitest run src/lib/__tests__/file-system.test.ts

# Run tests in watch mode
npx vitest

# Lint
npm run lint

# Reset database
npm run db:reset
```

## Environment Setup

Create a `.env` file in the project root (not tracked by git). Without API keys, the app runs in mock mode returning static component stubs.

```
ANTHROPIC_API_KEY=your-key        # preferred provider
OPENAI_API_KEY=your-key           # alternative
AI_PROVIDER=anthropic             # "anthropic" | "openai" — defaults to anthropic
JWT_SECRET=your-secret            # defaults to "development-secret-key"
```

Provider selection logic is in `src/lib/provider.ts`: `AI_PROVIDER` takes precedence; falls back to whichever key is present; falls back to `MockLanguageModel` if neither key is set.

## Architecture

UIGen is an AI-powered React component generator with live preview. Users describe components in a chat interface, and the AI generates code that renders in real-time.

### Core Data Flow

1. **Chat API** (`src/app/api/chat/route.ts`) — Receives messages and virtual file system state, streams AI responses using Vercel AI SDK. Anthropic provider gets `cacheControl: ephemeral` on the system message for prompt caching.
2. **AI Tools** — The AI uses two tools to modify the virtual file system:
   - `str_replace_editor` (`src/lib/tools/str-replace.ts`) — Create files, replace strings, insert text
   - `file_manager` (`src/lib/tools/file-manager.ts`) — Rename and delete files
3. **Tool calls** are processed both server-side (for persistence) and client-side for UI updates via `handleToolCall` in `file-system-context.tsx`

### Key Systems

**Virtual File System** (`src/lib/file-system.ts`)
- In-memory file system using `VirtualFileSystem` class — nothing is written to disk
- Serializes to JSON for persistence in the database
- The root is always `/`; `/App.jsx` is the preview entrypoint

**Live Preview** (`src/components/preview/PreviewFrame.tsx` + `src/lib/transform/jsx-transformer.ts`)
- Transforms JSX/TSX in the browser using Babel standalone
- Creates blob URLs and import maps for ES modules
- Renders in a sandboxed iframe with React 19 from esm.sh and Tailwind CSS via CDN
- **CSS `import` statements are stripped** by the transformer — use Tailwind classes instead
- Internal imports inside the virtual FS must use the `@/` alias (e.g., `import Foo from '@/components/Foo'`)
- External icon libraries (heroicons, lucide, etc.) are not available in the preview; use emojis, inline SVG, or Unicode symbols

**Context Providers** (`src/lib/contexts/`)
- `FileSystemProvider` — Manages virtual file system state and tool call handling; auto-selects `/App.jsx` as the active file when present
- `ChatProvider` — Wraps Vercel AI SDK's `useChat` hook, connects chat to file system, tracks anonymous work in sessionStorage via `anon-work-tracker.ts`

**Anonymous Work Tracking** (`src/lib/anon-work-tracker.ts`)
- Unauthenticated users' messages and file system state are saved to `sessionStorage` on every message
- On sign-up/sign-in, this data is used to populate the new project so work is not lost

### Authentication

JWT stored in an `auth-token` httpOnly cookie (7-day expiry). Implemented in `src/lib/auth.ts` using `jose`. Middleware (`src/middleware.ts`) protects `/api/projects` and `/api/filesystem` — notably `/api/chat` is **not** middleware-protected; project persistence is guarded inside the route handler instead. Server actions in `src/actions/` handle sign-up, sign-in, and sign-out with bcrypt password hashing.

### Database

SQLite via Prisma. Schema in `prisma/schema.prisma` — always refer to this file for the data model.
- `User` — Email/password auth
- `Project` — Stores `messages` (JSON array) and `data` (serialized virtual FS JSON); `userId` is nullable to allow anonymous project stubs

Prisma client is generated to `src/generated/prisma/`.

### Path Aliases

- `@/*` maps to `src/*` (TypeScript/Next.js)
- Components use shadcn/ui (new-york style) in `src/components/ui/`

### Testing

Vitest + jsdom + `@testing-library/react`. Test files live alongside source in `__tests__/` subdirectories. Run a single file with `npx vitest run <path>`.
