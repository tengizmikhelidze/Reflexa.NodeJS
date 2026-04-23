Proceed to Step 2 only.

Verify schema assumptions for the Viewer Scopes module.

Check and list the exact tables/columns you will rely on from:

* app.viewer_access_scopes
* app.organizations
* app.users

And any existing org/permission tables you need.

If there is any mismatch, stop and show the minimal migration needed.
Do not generate repository/service code yet.
