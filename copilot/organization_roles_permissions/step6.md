Proceed to Step 6 only.

Implement the minimal reusable permission-checking helper or middleware needed for this phase.

Requirements:

* keep it organization-scoped
* work with existing auth middleware
* support checks like:

    * current user must be member of organization
    * current user must have specific permission inside organization
    * super admin may bypass where appropriate
* do not over-engineer
* if middleware is not the best fit yet, implement a reusable service/helper instead and explain why
* do not implement controller/routes yet
