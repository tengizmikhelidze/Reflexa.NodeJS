Proceed to Step 5 only.

Implement sessions.service.ts.

I want business logic for:

* sync completed session
* list visible sessions
* get session detail
* assign session
* soft delete session

Requirements:

* no SQL in service except transaction orchestration if needed
* use typed app errors
* enforce organization-scoped access
* enforce idempotent sync by organization + clientSessionId
* validate kit/hub/pods belong to organization
* validate assigned user/team/preset belong to organization
* write audit log on delete
* deletion must be idempotent/safe
* centralize super admin bypass logic
* do not implement controller/routes yet
