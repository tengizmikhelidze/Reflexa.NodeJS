Proceed to Step 4 only.

Implement the repository layer for organizations + roles/permissions.

I want:

* organizations.repository.ts

Requirements:

* SQL only, no business logic
* typed MSSQL queries and typed return values
* include repository methods needed for:

  * create organization
  * find organization by id
  * list organizations for user
  * list all active organizations for super admin if needed
  * create organization membership
  * find membership by org + user
  * find membership by id
  * list organization members
  * assign membership roles
  * remove/replace membership roles if needed
  * find roles by codes
  * find roles for membership
  * find permissions from roles
  * find direct permission grants for user in organization
  * compute effective permissions inputs
* be explicit and careful about ACTIVE membership filtering
* if any query assumption is risky, explain it before code
* do not implement service yet
