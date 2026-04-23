Proceed to Step 2 only.

Define the shared pagination model for the backend.

I want:

* shared TypeScript types for pagination input/output
* shared Zod schema for pagination query params
* clear default values
* clear max page size rule
* the final standard paginated response shape

Requirements:

* keep it minimal
* make it reusable across modules
* do not update module repositories/services/controllers yet
