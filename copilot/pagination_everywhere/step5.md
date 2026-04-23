Proceed to Step 5 only for the Devices module.

Apply the shared pagination model to all devices list endpoints that need it.

At minimum review/apply to:

* GET /devices/kits
* GET /devices/kits/:deviceKitId/access
* GET /devices/kits/:deviceKitId/pods

Requirements:

* preserve kit/org access rules
* preserve filters if they exist
* use deterministic ordering
* do not touch unrelated modules yet
