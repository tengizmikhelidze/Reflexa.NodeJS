You are my senior backend engineer. We are building a production-grade backend for **Reflexa** using:

* Node.js
* TypeScript
* Express
* MSSQL
* WebStorm
* clean modular architecture

You must help me implement the **authentication foundation** step by step, with clean code, strong typing, and correct separation of concerns.

Do not generate shortcuts, toy examples, or mixed responsibilities.
Do not put business logic in controllers.
Do not skip validation, error handling, or security basics.

---

# CURRENT PROJECT STATE

The project already exists and currently has:

* TypeScript backend running
* MSSQL connection working
* SQL schema files created for:

    * users
    * external identities
    * email verification tokens
    * refresh tokens
    * organizations
    * roles
    * permissions
    * teams
    * devices
    * presets
    * training sessions
    * session events
* database connection works successfully
* server starts successfully

We are now implementing the **auth foundation**.

---

# WHAT WE NEED TO BUILD NOW

Implement a complete auth foundation with:

1. Register with email/password
2. Login with email/password
3. Password hashing with bcrypt
4. JWT access token
5. Refresh token flow
6. Email verification token generation/storage
7. Email verification endpoint
8. Protected auth middleware
9. Current user endpoint (`GET /me`)
10. Clean response and error structure

Do NOT implement Google login yet.
But keep the design compatible with Google linking later.

---

# ARCHITECTURE RULES

Use a clean modular structure like this:

src/
config/
middlewares/
shared/
constants/
errors/
types/
utils/
modules/
auth/
auth.controller.ts
auth.routes.ts
auth.service.ts
auth.repository.ts
auth.types.ts
auth.validation.ts
auth.mapper.ts
users/
users.repository.ts
users.types.ts

If needed, add shared helpers, but keep them in shared/.

---

# STRICT RESPONSIBILITY RULES

## Controllers

Controllers must:

* read request
* call service
* return response
* never contain business logic

## Services

Services must:

* contain business logic
* orchestrate repository + token + hashing behavior
* throw typed app errors when needed

## Repositories

Repositories must:

* contain all SQL/database access
* never contain HTTP logic
* return typed results

## Middleware

Middleware must:

* handle auth token extraction/verification
* handle request validation
* handle errors centrally

---

# IMPLEMENTATION RULES

## Validation

Use explicit validation for request bodies.
Use either:

* class-validator + DTOs
  or
* zod

Choose one and stay consistent.
Explain the choice briefly before generating code.

## Errors

Create reusable application errors:

* ValidationError
* UnauthorizedError
* NotFoundError
* ConflictError
* ForbiddenError

Use a centralized error middleware.

## Responses

Use consistent JSON response shapes.

Success example:
{
"success": true,
"data": { ... }
}

Error example:
{
"success": false,
"message": "..."
}

---

# SECURITY RULES

* Hash passwords with bcrypt
* Never return password hashes
* Never log raw passwords or tokens
* Store refresh tokens hashed in database
* Email verification tokens must be random and stored safely
* JWT secret must come from env
* Access token and refresh token lifetimes must be configurable
* Reject login for inactive users
* Decide and clearly state whether unverified users may log in before email verification
* Normalize email consistently before querying/storing

Use practical defaults and explain them briefly.

---

# DATABASE RULES

Assume MSSQL schema already exists with these auth-related tables:

* app.users
* app.external_identities
* app.email_verification_tokens
* app.refresh_tokens

Use the existing schema.
Do NOT redesign tables unless there is a serious problem.
If you discover a mismatch, point it out clearly and propose a minimal migration rather than silently changing assumptions.

---

# ENVIRONMENT VARIABLES

Assume these exist or add them if missing:

PORT
NODE_ENV

DB_SERVER
DB_PORT
DB_NAME
DB_USER
DB_PASSWORD
DB_ENCRYPT
DB_TRUST_SERVER_CERTIFICATE

JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
JWT_ACCESS_EXPIRES_IN
JWT_REFRESH_EXPIRES_IN

EMAIL_VERIFICATION_TOKEN_EXPIRES_HOURS
BCRYPT_SALT_ROUNDS

Do not hardcode secrets.

---

# AUTH FLOW REQUIREMENTS

## Register

Input:

* email
* password
* firstName optional
* lastName optional
* displayName optional

Behavior:

* normalize email
* reject duplicates
* hash password
* create user
* create email verification token
* return safe user info
* do NOT return password hash
* return a message that verification is required

## Login

Input:

* email
* password

Behavior:

* normalize email
* validate password
* reject invalid credentials
* reject inactive user
* clearly decide what to do with unverified users
* create access token
* create refresh token
* store hashed refresh token in DB
* return tokens + safe user payload

## Verify Email

Input:

* token

Behavior:

* validate token
* reject expired/used tokens
* mark token used
* mark user email_verified = true

## Refresh Token

Input:

* refresh token

Behavior:

* verify refresh token
* compare against stored hashed refresh token strategy
* rotate token if appropriate
* return new access token and refresh token

## Me

Protected route.
Return safe current user data.

---

# CODING STYLE RULES

* Use async/await
* Use strict TypeScript types
* Avoid any
* Keep functions small
* Add brief comments only where necessary
* Use named exports where it helps clarity
* Prefer pure helper functions in shared/utils

---

# WORKFLOW RULES

Do NOT dump the entire auth system in one giant answer.

Work in this exact sequence:

1. Propose the final file list for auth foundation
2. Show any required env additions
3. Show any required package additions
4. Implement shared error classes and error middleware if missing
5. Implement auth types/validation
6. Implement repository layer
7. Implement token/password utilities
8. Implement auth service
9. Implement auth controller/routes
10. Show how to register routes in app
11. Show how to test endpoints

At each step:

* explain briefly what you are doing
* then generate the code for that step only

Do not move to the next step until I confirm.

---

# IMPORTANT QUALITY BAR

I do not want:

* demo code
* pseudocode
* vague structure
* magic assumptions
* insecure shortcuts
* mixed concerns

I want code that is realistic for a real product and compatible with future:

* organization roles
* viewer access
* Google login linking
* offline session sync ownership

Start with step 1 only:
**propose the final file list for the auth foundation and explain why each file exists.**
