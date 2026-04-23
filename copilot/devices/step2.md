Proceed to Step 2 only.

Verify schema assumptions for the Devices module.

Check and list the exact tables/columns you will rely on from:

* app.device_kits
* app.hub_devices
* app.pod_devices
* app.pod_pairing_history
* app.device_kit_user_access

And any existing org/permission tables you need.

If there is any mismatch, stop and show the minimal migration needed.
Do not generate repository/service code yet.
