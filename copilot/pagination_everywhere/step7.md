Proceed to Step 7 only for the Presets module.

Apply the shared pagination model to preset list endpoints.

At minimum:

* GET /presets

Requirements:

* preserve USER vs ORGANIZATION scope logic
* preserve filters
* use deterministic ordering
* do not touch unrelated modules
