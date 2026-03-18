# ZVS Assistant

Desktop AI assistant (Electron + React + TypeScript) with:

- project-oriented chats,
- tool calling,
- background jobs,
- vector storage and document vectorization.

## Requirements

- Node.js 20+
- npm 10+
- Windows/macOS/Linux
- For embeddings/vectorization: local Ollama on `http://127.0.0.1:11434`

## Development

```bash
npm install
npm run dev
```

## Quality gates

```bash
npm run typecheck
npm run lint
```

## Build

```bash
npm run build
```

Windows-only release build:

```bash
npm run release:win
```

## Release checklist

- Verify `electron-builder.json5` values (`appId`, `productName`, artifacts)
- Ensure native deps are available for packaging (`better-sqlite3`, `@lancedb/lancedb`)
- Run `npm run typecheck` and `npm run lint`
- Run `npm run build` on target platform
- Smoke-test packaged app:
    - chat streaming,
    - tool execution,
    - job creation/cancel,
    - vectorization + vector search.
