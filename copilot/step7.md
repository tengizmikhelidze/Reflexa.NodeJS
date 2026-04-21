Proceed to step 8 only.

Implement `auth.service.ts`.

I want full business logic for:

* register
* login
* verify email
* refresh token
* logout if needed now
* get current user

Requirements:

* controllers must stay thin
* services must orchestrate repositories + utilities
* use typed app errors
* hash refresh tokens before storing them
* decide clearly whether unverified users may log in and explain the decision briefly
* never return password hash
* use safe user response mapping

Do not generate controller/routes yet.
