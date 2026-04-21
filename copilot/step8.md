Proceed to step 9 only.

Implement:

* `auth.controller.ts`
* `auth.routes.ts`

Requirements:

* keep controllers thin
* use service methods only
* wire routes cleanly
* include endpoints for:

    * POST /register
    * POST /login
    * POST /verify-email
    * POST /refresh-token
    * GET /me
* if logout is included in service, expose it too
* do not register routes in app yet
* do not move to endpoint testing yet
