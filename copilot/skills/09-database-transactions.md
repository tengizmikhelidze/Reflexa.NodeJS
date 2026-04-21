# Skill 09 — Database Transactions

Use a transaction any time two or more SQL writes must succeed or fail together.

---

## When a Transaction Is Required

| Scenario | Why |
|----------|-----|
| Create org + membership + role assignment | Crash between steps leaves orphaned data |
| Verify email: mark token used + mark user verified | Crash between leaves inconsistent state |
| Rotate refresh token: revoke old + insert new | Crash between could leave no valid token |
| Any INSERT followed by a dependent INSERT | FK relationship means order matters |

If only one write happens, no transaction is needed.

---

## Transaction Pattern (mssql)

```typescript
import sql from 'mssql';

async createWithRelated(data: SomeData): Promise<MainRow> {
    const transaction = new sql.Transaction(this.pool);
    await transaction.begin();
    try {
        // Write 1
        const r1 = await transaction
            .request()
            .input('name', sql.NVarChar(200), data.name)
            .query<MainRow>(`
                INSERT INTO app.main (name)
                OUTPUT INSERTED.id, INSERTED.name
                VALUES (@name)
            `);
        const mainId = r1.recordset[0].id;

        // Write 2 (uses result from Write 1)
        await transaction
            .request()
            .input('mainId', sql.UniqueIdentifier, mainId)
            .input('value', sql.NVarChar(100), data.value)
            .query(`
                INSERT INTO app.related (main_id, value)
                VALUES (@mainId, @value)
            `);

        await transaction.commit();
        return r1.recordset[0];

    } catch (err) {
        await transaction.rollback();
        throw err;   // ← ALWAYS re-throw after rollback
    }
}
```

**Critical rules:**
- `await transaction.begin()` before any requests.
- All requests in the transaction use `transaction.request()`, NOT `this.pool.request()`.
- Always `await transaction.rollback()` in catch, then re-throw.
- Always `await transaction.commit()` at the end of try.
- Transactions live in the repository layer only — never in services.

---

## Real Example — createOrganizationWithAdmin

From `organizations.repository.ts`:

```typescript
async createOrganizationWithAdmin(
    data: CreateOrganizationData,
    userId: string,
    orgAdminRoleId: string
): Promise<OrganizationRow> {
    const transaction = new sql.Transaction(this.pool);
    await transaction.begin();
    try {
        // 1. Create org
        const orgResult = await transaction.request()
            .input('name', sql.NVarChar(200), data.name)
            .input('slug', sql.NVarChar(150), data.slug)
            .input('description', sql.NVarChar(1000), data.description ?? null)
            .query<OrganizationRow>(`
                INSERT INTO app.organizations (name, slug, description)
                OUTPUT INSERTED.id, INSERTED.name, INSERTED.slug, INSERTED.description,
                       INSERTED.is_active, INSERTED.created_at, INSERTED.updated_at, INSERTED.deleted_at
                VALUES (@name, @slug, @description)
            `);
        const org = orgResult.recordset[0];

        // 2. Create membership
        const membershipResult = await transaction.request()
            .input('organizationId', sql.UniqueIdentifier, org.id)
            .input('userId', sql.UniqueIdentifier, userId)
            .input('status', sql.NVarChar(30), 'ACTIVE')
            .query<{ id: string }>(`
                INSERT INTO app.organization_memberships (organization_id, user_id, status)
                OUTPUT INSERTED.id
                VALUES (@organizationId, @userId, @status)
            `);
        const membershipId = membershipResult.recordset[0].id;

        // 3. Assign role
        await transaction.request()
            .input('membershipId', sql.UniqueIdentifier, membershipId)
            .input('roleId', sql.UniqueIdentifier, orgAdminRoleId)
            .query(`
                INSERT INTO app.organization_membership_roles (organization_membership_id, role_id)
                VALUES (@membershipId, @roleId)
            `);

        await transaction.commit();
        return org;
    } catch (err) {
        await transaction.rollback();
        throw err;
    }
}
```

**Key pattern:** Resolve all read-only lookups (like finding the `ORG_ADMIN` role ID) BEFORE
starting the transaction in the service layer. Only writes go inside the transaction.

---

## Service-Side Preparation Pattern

```typescript
// Service — resolve reads BEFORE calling transactional repo method
async createOrganization(input: ..., actor: AuthUser) {
    // 1. Duplicate check (read-only)
    const existing = await this.orgsRepo.findBySlug(input.slug);
    if (existing) throw new ConflictError('...');

    // 2. Role lookup (read-only)
    const [orgAdminRole] = await this.orgsRepo.findRolesByCodes(['ORG_ADMIN']);
    if (!orgAdminRole) throw new Error('ORG_ADMIN not seeded');

    // 3. All writes — atomic in the repository
    const org = await this.orgsRepo.createOrganizationWithAdmin(
        { name: input.name, slug: input.slug },
        actor.userId,
        orgAdminRole.id   // ← passed in, not looked up inside the transaction
    );

    return mapOrganization(org);
}
```

---

## What NOT to Do

```typescript
// WRONG — writes without transaction
const org = await this.orgsRepo.create(data);           // if crash here...
const membership = await this.orgsRepo.createMembership(org.id, userId);  // ...this never runs
await this.orgsRepo.assignRole(membership.id, roleId);  // ...and this never runs

// CORRECT — use createOrganizationWithAdmin() which wraps all 3 in a transaction
```

