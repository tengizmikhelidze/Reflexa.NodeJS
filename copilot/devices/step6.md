Proceed to Step 6 only.

Implement the minimal reusable access-check helper or service needed for device-kit access.

Requirements:

* support rules for:

    * org-level `devices.manage`
    * kit-level `can_manage`
    * kit-level `can_operate`
    * super admin bypass
* keep it minimal and reusable
* if service-level helper is better than middleware for this phase, implement that and explain why
* do not implement controller/routes yet
