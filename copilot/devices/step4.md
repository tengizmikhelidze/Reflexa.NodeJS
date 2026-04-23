Proceed to Step 4 only.

Implement the repository layer for the Devices module.

I want:

* devices.repository.ts

Requirements:

* SQL only, no business logic
* typed MSSQL queries and typed return values
* include methods needed for:

    * create device kit
    * find device kit by id
    * list device kits visible to a user
    * list all active kits for super admin if needed
    * create/update device kit access grant
    * list access grants for a kit
    * create hub device
    * find hub by kit id
    * create pod devices
    * find pod by id
    * find pod by hardware uid
    * list pods by kit id
    * update pod current_device_kit_id
    * create pairing history row
    * close active pairing history row
    * find active pairing for pod
* be explicit about soft-delete filtering and active access rules
* if any query assumption is risky, explain it before code
* do not implement service yet
