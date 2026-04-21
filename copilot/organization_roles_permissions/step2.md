Proceed to Step 2 only.

Verify schema assumptions for the organizations + roles/permissions phase.

Check and list the exact tables/columns you will rely on from:

* app.organizations
* app.roles
* app.permissions
* app.role_permissions
* app.organization_memberships
* app.organization_membership_roles
* app.user_permission_grants

If there is any mismatch, stop and show the minimal migration needed.
Do not generate repository/service code yet.
