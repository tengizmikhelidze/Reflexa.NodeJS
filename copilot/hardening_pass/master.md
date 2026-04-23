You are my senior backend engineer. The Reflexa backend core is already implemented.

Modules already exist:

* auth
* organizations
* devices
* sessions
* presets
* teams
* viewer scopes

Current stack:

* Node.js
* TypeScript
* Express
* MSSQL
* modular architecture

Architecture must remain:

* controllers = thin HTTP layer only
* services = business logic
* repositories = SQL only
* middleware = auth / validation / error handling
* shared = reusable utilities/types/errors

Do not redesign the architecture.
Do not introduce unnecessary abstractions.
Do not do style-only refactors.

---

# GOAL

Perform a **full production hardening pass** across the backend.

This is not about adding new major features.
This is about making the current backend more correct, safe, consistent, and ready for frontend integration.

---

# AUDIT SCOPE

Review all implemented modules for:

1. transaction safety
2. concurrency / race conditions
3. idempotency correctness
4. permission correctness
5. session visibility correctness
6. soft-delete consistency
7. audit logging consistency
8. response consistency
9. HTTP status-code consistency
10. validation coverage
11. request typing quality
12. schema assumption correctness
13. NodeNext runtime correctness
14. missing guards for inactive/deleted users
15. duplicate or conflicting DB writes
16. access-control gaps
17. pagination needs on list endpoints
18. maintainability issues that can become bugs
19. frontend-readiness of response shapes
20. consistency between modules

---

# RULES

* do not redesign the architecture
* do not move logic into wrong layers
* do not add new frameworks
* do not make speculative changes
* only fix real issues
* if a DB migration is needed, keep it minimal and explicit
* if an area is already correct, say so clearly

Be strict, skeptical, and production-minded.

---

# WORKFLOW

Do NOT dump everything at once.

Work in this exact order:

1. audit report:

    * list issues grouped by severity:

        * critical
        * important
        * minor
2. explanation:

    * for each issue explain:

        * why it matters
        * where it exists
        * exact fix needed
3. code fixes:

    * generate only the necessary fixes
4. final checklist:

    * fixed now
    * intentionally deferred
    * recommended next

Start with Step 1 only:
**audit the backend and list all issues grouped by severity.**
