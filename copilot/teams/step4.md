Proceed to Step 4 only.

Implement the repository layer for the Teams module.

I want:

* teams.repository.ts

Requirements:

* SQL only, no business logic
* typed MSSQL queries and typed return values
* include methods needed for:

  * create team
  * find team by id
  * list teams visible to user
  * add team membership
  * remove team membership
  * list team members
  * find team membership
  * verify user belongs to same organization
* be explicit about soft-delete filtering
* do not implement service yet
