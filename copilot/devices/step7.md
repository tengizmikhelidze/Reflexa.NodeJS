Proceed to Step 7 only.

Implement:

* devices.controller.ts
* devices.routes.ts

Requirements:

* thin controllers only
* use existing response helpers
* use validation middleware
* use auth middleware on all routes
* define endpoints for:

    * POST /devices/kits
    * GET /devices/kits
    * GET /devices/kits/:deviceKitId
    * POST /devices/kits/:deviceKitId/access
    * GET /devices/kits/:deviceKitId/access
    * POST /devices/kits/:deviceKitId/hub
    * POST /devices/kits/:deviceKitId/pods
    * GET /devices/kits/:deviceKitId/pods
    * POST /devices/pods/:podId/reassign
* do not integrate into app yet
