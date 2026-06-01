# Task Plan

## Goal
Produce a professional root-cause and fix analysis for the non-payment issues in the widget/session/rate-limit/UI-sync stack, backed by code references and official docs, then choose the safest permanent fix.

## Scope
- Analyze current implementation and relevant official docs.
- Trace function-to-function, route-to-lib, UI-to-data, and DB/RLS flows for the widget, chat, analytics, appointment, clinic, settings, and dashboard refresh paths.
- Identify root causes, false positives, permanent fixes, and regression risks.

## Phases
1. Evidence collection: file inventory, exact line references, and official docs.
2. Root-cause map: backend, frontend, DB, RLS, token/session, rate-limit, and logging paths.
3. Option analysis: 3-4 fixes with security, scalability, reversibility, and maintenance tradeoffs.
4. Recommendation: choose the safest permanent fix and document impact on other flows.
5. Verification: testing plan, regression surface, and rollout/rollback notes.

## Checklist
- [ ] Relevant files and exact line references captured
- [ ] Function call graph mapped
- [ ] API request/response contracts mapped
- [ ] DB schema + RLS + migration links mapped
- [ ] Official docs gathered and cited
- [ ] Failure modes, regressions, and UI sync risks reviewed
- [ ] Candidate solutions compared
- [ ] Final verdict and next steps drafted
