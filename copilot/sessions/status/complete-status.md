# Devices Module — Implementation Status

Generated: 2026-04-23
Status: ✅ Complete — `npx tsc --noEmit` passes with zero errors.

---

## Files Created

| File | Path | Status |
|------|------|--------|
| `devices.types.ts` | `src/modules/devices/devices.types.ts` | ✅ Done |
| `devices.validation.ts` | `src/modules/devices/devices.validation.ts` | ✅ Done |
| `devices.mapper.ts` | `src/modules/devices/devices.mapper.ts` | ✅ Done |
| `devices.repository.ts` | `src/modules/devices/devices.repository.ts` | ✅ Done |
| `devices.service.ts` | `src/modules/devices/devices.service.ts` | ✅ Done |
| `devices.controller.ts` | `src/modules/devices/devices.controller.ts` | ✅ Done |
| `devices.routes.ts` | `src/modules/devices/devices.routes.ts` | ✅ Done |

## Files Modified

| File | Change |
|------|--------|
| `src/routes/index.ts` | Registered `/api/devices` router |
| `api-integrations.md` | Added full Devices API documentation |

---

## Schema Verification — No Mismatches

All queries verified against `database/queries/5.devices.sql`.

| Table | Columns used | Notes |
|-------|-------------|-------|
| `app.device_kits` | `id, organization_id, name, code, description, owner_user_id, max_pods, created_at, updated_at, deleted_at` | `deleted_at IS NULL` = soft-delete filter |
| `app.hub_devices` | `id, device_kit_id, hardware_uid, serial_number, firmware_version, bluetooth_name, is_active, last_seen_at, created_at, updated_at` | `UQ_hub_devices_device_kit` enforces one hub per kit at DB level |
| `app.pod_devices` | `id, hardware_uid, serial_number, firmware_version, current_device_kit_id, display_name, logical_index, battery_percent, battery_level, is_active, last_seen_at, created_at, updated_at` | `is_active = 1` filters active pods |
| `app.pod_pairing_history` | `id, pod_device_id, device_kit_id, paired_by_user_id, paired_at, unpaired_at` | `unpaired_at IS NULL` = active pairing |
| `app.device_kit_user_access` | `id, device_kit_id, user_id, can_operate, can_manage, granted_by_user_id, created_at` | `UQ_device_kit_user_access` on (device_kit_id, user_id) |

No migration required.

---

## Endpoint List

Base: `http://localhost:3000/api`

| # | Method | Path | Auth | Permission |
|---|--------|------|------|------------|
| 1 | `POST` | `/api/devices/kits` | Bearer | `devices.manage` (org-level) |
| 2 | `GET` | `/api/devices/kits` | Bearer | visibility-based |
| 3 | `GET` | `/api/devices/kits/:deviceKitId` | Bearer | view access |
| 4 | `POST` | `/api/devices/kits/:deviceKitId/access` | Bearer | manage access |
| 5 | `GET` | `/api/devices/kits/:deviceKitId/access` | Bearer | manage access |
| 6 | `POST` | `/api/devices/kits/:deviceKitId/hub` | Bearer | manage access |
| 7 | `POST` | `/api/devices/kits/:deviceKitId/pods` | Bearer | manage access |
| 8 | `GET` | `/api/devices/kits/:deviceKitId/pods` | Bearer | view access |
| 9 | `POST` | `/api/devices/pods/:podId/reassign` | Bearer | manage access on BOTH kits |

---

## Access Control Rules

```
Can MANAGE a kit (create hub, add pods, grant access, reassign pods):
  super admin                          → YES (bypass)
  org-level devices.manage permission → YES (all kits in that org)
  kit-level can_manage = true          → YES (that specific kit only)

Can VIEW a kit (list kits, get detail, list pods):
  super admin                          → YES (all kits)
  org-level devices.manage permission → YES
  active org member (any role)         → YES (org's kits)
  kit-level can_operate OR can_manage  → YES (that specific kit only)
```

---

## Key Implementation Decisions

| Decision | Reason |
|----------|--------|
| Soft-delete on kits only | `deleted_at IS NULL` checked on all kit queries; no cascade |
| One hub per kit | DB unique constraint (`UQ_hub_devices_device_kit`) + explicit 409 before insert |
| Pod registration is all-or-nothing | Pre-flight check on all pods before any write; atomicity at batch level |
| Pod reassign requires explicit endpoint | Deliberate audited action — `registerPods` blocks pods assigned elsewhere |
| Pairing history always preserved | `closeActivePairingHistory` + `createPairingHistory` on every assign/reassign |
| MERGE for kit access upsert | Single round-trip, handles concurrent grant/update safely |
| Kit visibility via DISTINCT query | Owned + access grant + org membership all checked in one SQL query |
| Super admin bypass centralised | In `requireKitManageAccess` and `requireKitViewAccess` — not scattered |
| Service-level access helpers | Not middleware — helpers need DB context (kit object) that's already loaded |
| `registerPods` rejects already-assigned pods | Must use `/pods/:podId/reassign` — prevents accidental silent moves |

---

## Test Order

```
1.  POST /organizations         → create org; save organizationId
2.  POST /devices/kits          → create kit; save deviceKitId
3.  GET  /devices/kits          → verify kit appears
4.  GET  /devices/kits/:id      → verify detail (hub: null, podCount: 0)
5.  POST /devices/kits/:id/hub  → register hub; save hubId
6.  GET  /devices/kits/:id      → verify hub now appears
7.  POST /devices/kits/:id/hub  → must fail 409 (already has hub)
8.  POST /devices/kits/:id/pods → register 2 pods; save podIds
9.  GET  /devices/kits/:id/pods → verify 2 pods appear
10. POST /devices/kits/:id/access → grant access to another user
11. GET  /devices/kits/:id/access → verify access row appears
12. POST /devices/pods/:podId/reassign → move pod to another kit; verify pairing history
13. POST /devices/kits/:id/pods → try re-adding moved pod → 409
```

---

## DB Verification SQL

```sql
-- All kits in an org
SELECT id, name, code, owner_user_id, deleted_at
FROM app.device_kits
WHERE organization_id = '<orgId>';

-- Hub for a kit
SELECT id, hardware_uid, is_active
FROM app.hub_devices
WHERE device_kit_id = '<kitId>';

-- Pods in a kit
SELECT id, hardware_uid, display_name, logical_index, current_device_kit_id
FROM app.pod_devices
WHERE current_device_kit_id = '<kitId>' AND is_active = 1;

-- Full pairing history for a pod
SELECT pod_device_id, device_kit_id, paired_at, unpaired_at
FROM app.pod_pairing_history
WHERE pod_device_id = '<podId>'
ORDER BY paired_at DESC;

-- Kit access grants
SELECT user_id, can_operate, can_manage, granted_by_user_id
FROM app.device_kit_user_access
WHERE device_kit_id = '<kitId>';
```

