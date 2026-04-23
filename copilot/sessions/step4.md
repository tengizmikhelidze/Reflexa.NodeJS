Proceed to Step 4 only.

Implement the repository layer for the Sessions module.

I want:

* sessions.repository.ts

Requirements:

* SQL only, no business logic
* typed MSSQL queries and typed return values
* include methods needed for:

  * find session by org + clientSessionId
  * create training session
  * create training_session_active_pods rows
  * create training_session_events rows
  * list sessions with basic filters
  * find session by id
  * get active pods for session
  * get events for session
  * update session assignment
  * soft delete session
  * create audit log entry
  * validate referenced kit/hub/pods/users/team/preset for organization
* be explicit about soft-delete filtering
* if any query assumption is risky, explain it before code
* repository methods that participate in sync/delete should support transaction usage
* do not implement service yet
