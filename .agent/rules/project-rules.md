---
trigger: always_on
---

# Project Development Rules

- Treat @docs/project-plan.md as the primary source of truth.
- Work on only the feature explicitly named in the user's prompt.
- Read the relevant feature plan before proposing changes.
- Do not implement requirements belonging to future features.
- Do not add features, services, databases, or abstractions that are not required.
- Keep the MVP simple and maintainable.
- Use TypeScript and follow the stack defined in the project plan.
- Never expose API keys in logs, source files, commits, or error messages.
- API keys must follow the storage approach defined in the project plan.
- Pexels results must never exceed five items per request or scene.
- Script-piece text export must contain one segment per line.
- Before coding, produce an implementation plan and wait for approval.
- After implementation, run linting, type-checking, tests, and a production build.
- Show a walkthrough describing what changed and how it was verified.
- Update documentation only when the implementation changes an agreed behavior.