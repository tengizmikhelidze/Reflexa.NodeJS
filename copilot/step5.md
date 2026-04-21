Proceed to step 6 only.

Implement the repository layer for auth.

I want:

* `auth.repository.ts`
* `users.repository.ts` if needed
* typed MSSQL queries using the existing schema

Requirements:

* use existing tables:

    * app.users
    * app.external_identities
    * app.email_verification_tokens
    * app.refresh_tokens
* no business logic in repositories
* repositories should return typed results
* include methods needed for:

    * find user by email
    * create user
    * create email verification token
    * find verification token
    * mark verification token used
    * mark user verified
    * store hashed refresh token
    * find refresh token record
    * revoke/rotate refresh token if needed

Important:

* if you discover schema mismatch, stop and point it out clearly
* do not silently change DB assumptions
* do not implement service logic yet
