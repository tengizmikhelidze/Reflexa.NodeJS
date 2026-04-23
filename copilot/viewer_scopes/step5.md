Proceed to Step 5 only.

Implement viewer-scopes.service.ts.

I want business logic for:

* grant viewer scope
* list viewer scopes
* revoke viewer scope

Requirements:

* no SQL in service
* use typed app errors
* enforce organization-scoped access
* enforce `viewer.scope.manage`
* validate viewer and target belong to same organization
* centralize super admin bypass logic
* do not implement controller/routes yet
