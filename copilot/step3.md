Proceed to step 4 only.

Implement shared application error classes and centralized error middleware.

I want:

* file list for this step
* code for each file
* brief explanation of how the error flow works

Requirements:

* create reusable typed errors:

    * ValidationError
    * UnauthorizedError
    * ForbiddenError
    * NotFoundError
    * ConflictError
* keep them in `src/shared/errors`
* update the global error middleware to use them properly
* do not implement auth logic yet
* do not move to the next step
