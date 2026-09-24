PROMPT 1: CREATE IMPLEMENTATION PLAN
Implement Feature X using:

@docs/project-plan.md
@docs/features/X.md

This task is limited to Feature 1.

Before coding:

1. Inspect the existing repository
2. Identify the files that need to change
3. Produce an implementation plan
4. Map every acceptance criterion to an implementation task
5. Wait for my approval

Do not implement requirements from Features X, X, or X.
Do not add functionality that is not required by the documents.

PROMPT 2: PROCEED WITH IMPLEMENTATION PLAN
Proceed with the approved plan.

After implementation:

- Run linting
- Run TypeScript checks
- Run relevant tests
- Run the production build
- Test the main user flow
- Produce a walkthrough
- Report every acceptance criterion as Passed, Failed, or Not Tested

Do not start the next feature.

PROMPT 3: REVIEW
Audit the completed implementation against:

@docs/project-plan.md
@docs/features/X.md

Do not modify code yet.

Create a table containing:

- Acceptance criterion
- Implemented location
- Verification method
- Result
- Remaining issue

Also identify accidental implementation of later features, unnecessary complexity, security problems, and incomplete error handling.

PROMPT 4: IF ISSUES ARE FOUND:
Fix only the failed or incomplete items from the audit.

Do not refactor unrelated code.
Do not implement later features.
Run the relevant verification commands again and update the walkthrough.