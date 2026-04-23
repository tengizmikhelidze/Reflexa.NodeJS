Proceed to Step 4 only.

Implement the repository layer for the Presets module.

I want:

* presets.repository.ts

Requirements:

* SQL only, no business logic
* typed MSSQL queries and typed return values
* include methods needed for:

  * create preset
  * find preset by id
  * list presets visible to a user
  * list all visible org presets for user orgs
  * update preset
  * soft delete preset
* be explicit about soft-delete filtering
* be explicit about USER vs ORGANIZATION scope queries
* do not implement service yet
