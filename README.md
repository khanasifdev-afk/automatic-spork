# YouTube Stock Video Generator

A private, client-only React application that runs locally in your browser and converts YouTube narration scripts into an ordered, sequentially numbered package of relevant Pexels stock-video clips ready for video editing.

## Architecture & Principles

- **Client-Side Only**: Runs 100% locally in your browser via Vite + React. No backend server, Node API, or cloud services.
- **Single-Session Workflow**: Ephemeral in-memory state. Refreshing the browser tab cleanly resets active job progress without persisting stale draft data.
- **Privacy First**: API keys for Google Gemini and Pexels are stored strictly in your browser's `localStorage` on this computer. They are never transmitted to any third-party server.
- **No Database**: No database or IndexedDB required.

## Technology Stack

- **Framework**: React 19 + TypeScript
- **Bundler**: Vite
- **Routing**: React Router (`react-router-dom`)
- **State Management**: Zustand (active single-session workflow state)
- **Styling**: Modern Vanilla CSS with CSS custom properties (sophisticated blue design system)
- **Icons**: Lucide React
- **Testing**: Vitest + React Testing Library + jsdom
- **Linting**: ESLint (v9 flat config) + TypeScript ESLint

## Getting Started

### Prerequisites

- Node.js 18+ (tested with Node 20+)
- npm 9+

### Installation

```bash
# Clone or open the workspace
cd /path/to/stock-video

# Install dependencies
npm install
```

### Development Server

```bash
npm run dev
```

Visit `http://localhost:5173` in your browser.

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Starts local development server with HMR |
| `npm run build` | Type-checks with `tsc` and bundles for production |
| `npm run test` | Runs the Vitest test suite |
| `npm run lint` | Lints TypeScript and React source files |
| `npm run preview` | Previews the production build locally |

## Project Structure

```text
├── docs/                # Architecture plans and feature specifications
│   ├── project-plan.md  # Primary source of truth
│   └── features/        # Feature specs (01 Settings, 02 Script, 03 Search, 04 Export)
├── src/
│   ├── components/      # UI components
│   │   └── layout/      # Shared navigation & shell layout
│   ├── pages/           # Route views (WorkspacePage, SettingsPage)
│   ├── styles/          # Design system & CSS custom properties (index.css)
│   ├── types/           # Shared TypeScript interfaces & types
│   ├── App.tsx          # Router configuration
│   └── main.tsx         # Application entry point
├── index.html           # HTML template
├── vite.config.ts       # Vite & Vitest configuration
└── tsconfig.json        # TypeScript project configuration
```

## Boundaries & Verification

- **API Keys**: All API keys are configured via the `/settings` page at runtime. No keys should ever be placed in source files or environment variables.
- **Features Roadmap**: Product features (Settings, Script Analysis, Video Search, and Export) are implemented sequentially according to the project plan.
