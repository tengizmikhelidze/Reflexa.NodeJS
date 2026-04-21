Proceed to auth middleware implementation before route registration.

Implement:

* JWT auth middleware
* request user typing
* protected route support for `GET /me`

Requirements:

* verify bearer token
* attach current user identity to request
* keep it ready for future role/permission middleware
* define proper Express request typing extension
* do not implement role middleware yet
