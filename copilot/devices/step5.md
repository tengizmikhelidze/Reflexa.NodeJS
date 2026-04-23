Proceed to Step 5 only.

Implement devices.service.ts.

I want business logic for:

* create device kit
* list visible kits for current user
* get device kit detail
* grant/update kit access
* list kit access grants
* register hub for a kit
* register pods for a kit
* list pods for a kit
* reassign pod to another kit

Requirements:

* no SQL in service
* use typed app errors
* enforce organization-scoped access + kit-level access rules
* centralize super admin bypass logic
* enforce one hub per kit
* do not silently reassign pods
* explicit manual reassign flow only
* preserve pairing history on reassign
* if registering pod(s) by hardware UID conflicts with an existing assignment, explain and throw conflict
* do not implement controller/routes yet
