Proceed to Step 7 only.

Implement:

* organizations.controller.ts
* organizations.routes.ts

Requirements:

* thin controllers only
* use existing response helpers
* use validation middleware
* use auth middleware on all routes
* apply organization permission checks cleanly
* define endpoints for:

    * POST /organizations
    * GET /organizations
    * GET /organizations/:organizationId/me
    * POST /organizations/:organizationId/members
    * GET /organizations/:organizationId/members
    * POST /organizations/:organizationId/members/:membershipId/roles
    * GET /organizations/:organizationId/members/:membershipId/permissions
* do not integrate into app yet
