Proceed to Step 5 only.

Implement organizations.service.ts.

I want business logic for:

* create organization
* list current user organizations
* get current user organization access profile
* add member by email
* list members
* assign roles to membership
* get effective permissions for membership

Requirements:

* no SQL in service
* use typed app errors
* enforce organization-scoped access
* enforce ACTIVE membership rules
* centralize super admin bypass logic
* permission resolution must merge role permissions + direct grants without duplicates
* when creating organization:

    * create org
    * create creator membership
    * assign ORG_ADMIN role
* if add-member email does not exist, decide clearly whether to return not found or defer invitation flow, and explain the decision briefly
* do not implement controller/routes yet
