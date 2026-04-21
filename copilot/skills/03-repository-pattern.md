# Skill 03 — Repository Pattern

All database access lives in repository classes. Nothing else touches SQL.

---

## Rules

- Repository methods contain only SQL + data mapping from raw DB results.
- Never import Express, never throw HTTP errors, never contain business logic.
- Always use parameterised queries — never string concatenation.
- Always filter `deleted_at IS NULL` for soft-delete tables.
- Use `OUTPUT INSERTED.*` for INSERT to return the created row in one round-trip.
- Column names in TypeScript interfaces match DB columns exactly (snake_case).
- Return typed results — never return `any`.

---

## MSSQL Type Mapping

| TypeScript | MSSQL type | Use for |
|------------|-----------|---------|
| `string` (UUID) | `sql.UniqueIdentifier` | PK, FK columns |
| `string` (text) | `sql.NVarChar(n)` | All text — always specify length |
| `number` (int) | `sql.Int` | Integer columns |
| `boolean` | `sql.Bit` | BIT columns |
| `Date` | `sql.DateTime2` | DATETIME2 columns |
| `null` | pass `null` directly | Nullable columns |

---

## Query Pattern

```typescript
// SELECT — single row
async findById(id: string): Promise<ThingRow | null> {
    const result = await this.pool
        .request()
        .input('id', sql.UniqueIdentifier, id)
        .query<ThingRow>(`
            SELECT id, name, is_active, created_at
            FROM app.things
            WHERE id = @id AND deleted_at IS NULL
        `);
    return result.recordset[0] ?? null;  // always ?? null, never undefined
}

// SELECT — multiple rows
async findAll(): Promise<ThingRow[]> {
    const result = await this.pool
        .request()
        .query<ThingRow>(`
            SELECT id, name, is_active, created_at
            FROM app.things
            WHERE deleted_at IS NULL
            ORDER BY name
        `);
    return result.recordset;  // always returns array (possibly empty)
}

// INSERT with OUTPUT
async create(name: string): Promise<ThingRow> {
    const result = await this.pool
        .request()
        .input('name', sql.NVarChar(200), name)
        .query<ThingRow>(`
            INSERT INTO app.things (name)
            OUTPUT INSERTED.id, INSERTED.name, INSERTED.is_active, INSERTED.created_at
            VALUES (@name)
        `);
    return result.recordset[0];  // OUTPUT always returns the inserted row
}

// UPDATE
async deactivate(id: string): Promise<void> {
    await this.pool
        .request()
        .input('id', sql.UniqueIdentifier, id)
        .query(`
            UPDATE app.things
            SET is_active = 0, updated_at = SYSUTCDATETIME()
            WHERE id = @id
        `);
}
```

---

## Dynamic IN Clause Pattern

For parameterised IN queries (e.g., find roles by codes):

```typescript
async findByCodes(codes: string[]): Promise<RoleRow[]> {
    if (codes.length === 0) return [];

    const req = this.pool.request();
    codes.forEach((code, i) => req.input(`code${i}`, sql.NVarChar(50), code));
    const placeholders = codes.map((_, i) => `@code${i}`).join(', ');

    const result = await req.query<RoleRow>(`
        SELECT id, code, name FROM app.roles
        WHERE code IN (${placeholders})
    `);
    return result.recordset;
}
```

---

## Transaction Pattern

Use for multiple writes that must be atomic (see `09-database-transactions.md` for full guide):

```typescript
async createWithRelated(data: SomeData): Promise<MainRow> {
    const transaction = new sql.Transaction(this.pool);
    await transaction.begin();
    try {
        const r1 = await transaction.request()
            .input('name', sql.NVarChar(200), data.name)
            .query<MainRow>(`INSERT INTO app.main (...) OUTPUT INSERTED.* VALUES (...)`);
        const mainId = r1.recordset[0].id;

        await transaction.request()
            .input('mainId', sql.UniqueIdentifier, mainId)
            .query(`INSERT INTO app.related (main_id) VALUES (@mainId)`);

        await transaction.commit();
        return r1.recordset[0];
    } catch (err) {
        await transaction.rollback();
        throw err;   // re-throw so the service layer sees the error
    }
}
```

---

## Email Lookup (users table specific)

The `app.users` table has `normalized_email AS UPPER(email) PERSISTED`.
The unique index and constraint are on `normalized_email`, NOT on `email`.

```typescript
async findByEmail(email: string): Promise<UserRow | null> {
    // Pass UPPER(email) — matches the persisted computed column + uses the index
    const result = await this.pool
        .request()
        .input('normalizedEmail', sql.NVarChar(320), email.toUpperCase())
        .query<UserRow>(`
            SELECT ...
            FROM app.users
            WHERE normalized_email = @normalizedEmail
              AND deleted_at IS NULL
        `);
    return result.recordset[0] ?? null;
}
```

- Email is lowercased by Zod validation before hitting service/repository.
- `.toUpperCase()` at repository boundary converts to match the persisted column.
- **Never insert `normalized_email`** — it is a computed column and will cause a SQL error.

---

## Multi-Row Join Grouping Pattern

When a JOIN produces multiple rows per entity (e.g., member with multiple roles):

```typescript
const map = new Map<string, MemberWithRoles>();
for (const row of result.recordset) {
    if (!map.has(row.membershipId)) {
        map.set(row.membershipId, {
            membershipId: row.membershipId,
            roles: [],
            // ...other fields
        });
    }
    if (row.roleCode) {
        map.get(row.membershipId)!.roles.push(row.roleCode);
    }
}
return Array.from(map.values());
```

---

## Active Record Conventions

| Field | Rule |
|-------|------|
| `deleted_at IS NULL` | Always filter — soft-delete standard |
| `is_active = 1` | Filter for orgs and users where applicable |
| `status = 'ACTIVE'` AND `left_at IS NULL` | BOTH required for memberships |
| `used_at IS NULL` | For verification/one-time tokens |
| `revoked_at IS NULL` | For refresh tokens |

