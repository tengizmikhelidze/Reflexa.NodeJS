Proceed to Step 8 only for the Teams module.

Apply the shared pagination model to team list endpoints.

At minimum:

* GET /teams
* GET /teams/:teamId/members

Requirements:

* preserve organization access rules
* preserve same-organization logic
* use deterministic ordering
* do not touch unrelated modules
