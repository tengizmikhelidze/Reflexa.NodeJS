Proceed to Step 3 only.

Implement:

* sessions.types.ts
* sessions.validation.ts

Requirements:

* use Zod
* define request/response types for:

  * sync session payload
  * session summary
  * session detail
  * session event item
  * active pod item
  * assign session payload
  * list sessions query filters
* include path-param validation for `sessionId`
* include careful validation for arrays like events and activePods
* do not implement repository/service/controller yet
