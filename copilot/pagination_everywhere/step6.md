Proceed to Step 6 only for the Sessions module.

Apply the shared pagination model to session list endpoints.

At minimum:

* GET /sessions

Requirements:

* preserve organization-scoped visibility
* preserve existing filters
* use deterministic ordering
* return paginated response shape
* do not paginate single-session detail endpoint
