Proceed to Step 5 only.

Implement presets.service.ts.

I want business logic for:

* create preset
* list visible presets
* get preset detail
* update preset
* soft delete preset

Requirements:

* no SQL in service
* use typed app errors
* enforce scope rules:

    * personal owner rules
    * org membership + org permission rules
* centralize super admin bypass logic
* do not implement controller/routes yet
