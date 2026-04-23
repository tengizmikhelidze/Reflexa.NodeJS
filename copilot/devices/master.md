You are my senior backend engineer. We are extending the Reflexa backend with the **Devices module**.

Current stack:

* Node.js
* TypeScript
* Express
* MSSQL
* modular architecture
* auth module already implemented
* organizations + roles/permissions module already implemented

Architecture must remain:

* controllers = thin HTTP layer only
* services = business logic
* repositories = SQL only
* middleware = auth / validation / error handling
* shared = reusable types, errors, utils

Do not redesign the architecture.
Do not introduce unnecessary abstractions.
Do not generate demo code.

---

# CURRENT SYSTEM CONTEXT

Already implemented:

* authentication
* organizations
* roles/permissions
* active membership rules
* organization-scoped permissions
* reusable validation middleware
* reusable auth middleware

We are now implementing the **Devices module** only.

---

# DATABASE CONTEXT

Use the existing MSSQL schema and do NOT silently change it.

Tables available for this phase:

* app.device_kits
* app.hub_devices
* app.pod_devices
* app.pod_pairing_history
* app.device_kit_user_access
* app.organizations
* app.organization_memberships
* app.organization_membership_roles
* app.roles
* app.permissions
* app.role_permissions
* app.user_permission_grants

If any schema mismatch exists, stop and state the minimal migration needed.

---

# GOAL OF THIS PHASE

Implement the backend foundation for:

* device kits
* hub device ownership
* pod inventory
* pairing / re-pairing tracking
* device access grants

Do NOT implement live hardware communication in backend.
Do NOT implement OTA.
Do NOT implement sessions yet.

This phase is only about:

* storing and managing device ownership and structure
* organization-level access to devices
* pod binding history
* permission-gated device operations

---

# DEVICE MODEL RULES

## Core model

* one **device kit** belongs to one organization
* one **hub device** belongs to one device kit
* many **pod devices** can be assigned to one device kit
* pods may later move to another kit only through a deliberate/manual re-pair flow
* pod pairing history must be preserved

## Access model

* device kits may be shared
* users may be granted:

    * `can_operate`
    * `can_manage`
* organization permissions still apply
* super admin may bypass where appropriate

## Ownership

* `owner_user_id` on device_kits is the primary owner
* shared access is handled separately in `device_kit_user_access`

---

# WHAT TO BUILD IN THIS PHASE

Implement endpoints for:

* POST   /devices/kits
* GET    /devices/kits
* GET    /devices/kits/:deviceKitId
* POST   /devices/kits/:deviceKitId/access
* GET    /devices/kits/:deviceKitId/access
* POST   /devices/kits/:deviceKitId/hub
* POST   /devices/kits/:deviceKitId/pods
* GET    /devices/kits/:deviceKitId/pods
* POST   /devices/pods/:podId/reassign

If you think one or two small support endpoints are necessary, explain why before adding them.

---

# ENDPOINT RULES

## POST /devices/kits

* authenticated
* user must have organization-scoped permission to manage devices
* create a device kit
* assign owner_user_id
* return device kit summary

## GET /devices/kits

* authenticated
* return kits available to the current user
* include:

    * owned kits
    * shared kits
    * org-accessible kits if your access logic supports it
* super admin may list all non-deleted kits

## GET /devices/kits/:deviceKitId

* authenticated
* user must have access to the kit
* return:

    * kit info
    * hub info if present
    * owner
    * organization
    * summary counts

## POST /devices/kits/:deviceKitId/access

* authenticated
* requires permission to manage devices or kit-level manage access
* grant access to a user for this kit
* allow:

    * can_operate
    * can_manage
* if access row already exists, update it instead of duplicating

## GET /devices/kits/:deviceKitId/access

* authenticated
* requires manage permission on the kit/org
* return all user access grants for that kit

## POST /devices/kits/:deviceKitId/hub

* authenticated
* requires manage permission
* create or register the hub for the kit
* enforce one hub per kit
* if a hub already exists, return conflict unless you deliberately choose replace behavior and explain why

## POST /devices/kits/:deviceKitId/pods

* authenticated
* requires manage permission
* add/register one or more pods to the kit
* if pod already exists and is assigned elsewhere, do not silently reassign
* use pairing history rules

## GET /devices/kits/:deviceKitId/pods

* authenticated
* requires access to the kit
* return pods currently assigned to the kit

## POST /devices/pods/:podId/reassign

* authenticated
* requires manage permission
* explicit manual re-pair flow only
* move pod from old kit to new kit
* update `current_device_kit_id`
* close old active pairing history row
* create new pairing history row
* this should be treated as a deliberate audited action

---

# PERMISSION MODEL

Use existing organization permission infrastructure.

Device operations should respect:

* org membership and ACTIVE status
* org-level permissions from roles/direct grants
* kit-level direct access grants from `device_kit_user_access`

For this phase, define the effective rules clearly.

Suggested logic:

* `devices.manage` at organization level can manage any kit in that organization
* `device_kit_user_access.can_manage = true` can manage that specific kit
* `device_kit_user_access.can_operate = true` can view/use but not manage
* super admin bypasses checks where appropriate

Be explicit about this in service logic.

---

# VALIDATION RULES

Use Zod consistently.

Validate:

* create device kit input
* grant access input
* register hub input
* register pods input
* pod reassign input
* path params for `deviceKitId` and `podId`

Do not validate ad hoc in controllers.

---

# TYPES / OUTPUTS

Define types for:

* device kit summary
* device kit detail
* hub summary
* pod summary
* kit access grant
* create kit input
* grant access input
* register hub input
* register pod input
* reassign pod input

Do not expose unnecessary internal DB fields.

---

# IMPORTANT IMPLEMENTATION DETAILS

1. Be explicit about soft-delete filtering on kits
2. Be explicit about one-hub-per-kit enforcement
3. Pod reassign must preserve history
4. Do not silently overwrite pairings
5. Access checks must be deterministic and reusable
6. Super admin behavior must be centralized and consistent
7. Manual re-pair flow should be explicit and safe

---

# WORKFLOW

Do NOT generate everything at once.

Work in this exact order:

1. Propose final file list for this phase
2. Verify schema assumptions against existing tables/columns
3. Define types + validation
4. Implement repositories
5. Implement service
6. Implement access-check helper if needed
7. Implement controller + routes
8. Integrate routes
9. Show test order and sample requests/responses
10. Do a gap audit for this phase

At each step:

* explain briefly
* generate code only for that step
* wait for my confirmation

Start with Step 1 only:
**propose the final file list for the Devices module and explain why each file exists.**
