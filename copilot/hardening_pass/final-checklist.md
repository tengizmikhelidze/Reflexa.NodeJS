# Hardening Pass — Final Checklist

## ✅ Fixed Now

| # | Fix | Files Changed |
|---|-----|---------------|
| C1 | **Session list visibility too broad** — athletes now only see sessions assigned/started-by them or their viewer-scope targets | `sessions.service.ts`, `sessions.repository.ts` |
| C2 | **Session detail visibility too broad** — `requireOrgAccess` replaced with `requireCanSeeSession` applying role-based + viewer-scope check | `sessions.service.ts` |
| I1 | **Query param validation silently ignored** — `validate(schema, 'query')` middleware added to `GET /sessions` | `validate.middleware.ts`, `sessions.routes.ts`, `sessions.controller.ts` |
| I2 | **No pagination on sessions list** — `limit` (default 50, max 200) + `offset` added to query schema + SQL | `sessions.validation.ts`, `sessions.types.ts`, `sessions.repository.ts` |
| I3 | **validate middleware missing 'query' target** — added alongside existing `body`/`params` | `validate.middleware.ts` |
| M1 | **JSON.parse unguarded in sessions.mapper** — added try/catch, returns `{}` on corrupt data | `sessions.mapper.ts` |

## ⏸ Intentionally Deferred

| # | Issue | Reason |
|---|-------|--------|
| D1 | Pagination for other list endpoints (presets, teams, viewer-scopes, devices) | Not urgent; no large datasets expected yet. Add as data grows or before public launch. |
| D2 | Query param validation on presets/teams/viewer-scopes list controllers (still using safeParse fallback) | Low-risk: malformed UUIDs in optional filters either return 500 from MSSQL or produce empty results. `validate('query')` middleware is now available to add with one line per route. |
| D3 | Delete response standardization (some use `sendSuccessWithMessage`, some `sendSuccess(null)`) | Minor UX inconsistency, not a correctness issue. |
| D4 | N+1 pod validation queries in `syncSession` (one DB query per pod) | Acceptable at current batch sizes. Optimize with a batch membership query if pods > 20 become common. |

## 🔜 Recommended Before Frontend Integration

| # | Task | Priority |
|---|------|----------|
| R1 | **Seed role-permission mappings** — `database/queries/11.seed_role_permissions.sql` created and ready to run. ORG_ADMIN gets all 9 permissions. TRAINER gets session.start/end/assign + presets.manage + teams.manage. ATHLETE and VIEWER get no permissions (self-access and viewer-scope rules apply). | **DONE — run `11.seed_role_permissions.sql` against your DB** |
| R2 | **Add `validate('query')` to remaining list endpoints** — one-liner per route: `validate(listPresetsQuerySchema, 'query')` etc. | Medium |
| R3 | **Add pagination to remaining list endpoints** — presets, teams, devices especially. | Medium |
| R4 | **Error logging improvement** — currently only `console.error` in `error.middleware.ts`. Should use a structured logger (Winston, Pino) before production. | Medium |
| R5 | **Rate limiting** on auth endpoints (`POST /auth/login`, `POST /auth/register`) to prevent brute force. | Medium |
| R6 | **Postman collection update** — add new presets/teams/viewer-scopes + sessions pagination params. | Low |

