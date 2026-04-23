Proceed to Step 2 only.

Verify schema assumptions for the Sessions module.

Check and list the exact tables/columns you will rely on from:

* app.training_sessions
* app.training_session_active_pods
* app.training_session_events
* app.device_kits
* app.hub_devices
* app.pod_devices
* app.users
* app.teams
* app.training_presets
* app.audit_logs

And any existing org/permission tables you need.

If there is any mismatch, stop and show the minimal migration needed.
Do not generate repository/service code yet.
