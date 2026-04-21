// ─── DB Row Types ─────────────────────────────────────────────────────────────

export interface OrganizationRow {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
    deleted_at: Date | null;
}

export interface MembershipRow {
    id: string;
    organization_id: string;
    user_id: string;
    status: string;          // ACTIVE | INVITED | SUSPENDED
    joined_at: Date;
    left_at: Date | null;
    created_at: Date;
}

export interface RoleRow {
    id: string;
    code: string;
    name: string;
    description: string | null;
}

// ─── Request Inputs ───────────────────────────────────────────────────────────

export interface CreateOrganizationInput {
    name: string;
    slug: string;
    description?: string;
}

export interface AddMemberInput {
    email: string;
    roleCodes?: string[];  // optional initial roles to assign
}

export interface AssignRolesInput {
    roleCodes: string[];   // replaces existing roles for the membership
}

// ─── Response Payloads ────────────────────────────────────────────────────────

export interface OrganizationSummary {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    isActive: boolean;
    createdAt: Date;
}

export interface MembershipSummary {
    id: string;
    userId: string;
    status: string;
    joinedAt: Date;
    roles: string[];       // role codes
}

export interface MemberWithRoles {
    membershipId: string;
    userId: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    displayName: string | null;
    status: string;
    joinedAt: Date;
    roles: string[];
}

export interface MyOrgAccessProfile {
    organization: OrganizationSummary;
    membership: MembershipSummary;
    effectivePermissions: string[];  // permission codes
}

export interface EffectivePermissionsResponse {
    membershipId: string;
    userId: string;
    organizationId: string;
    permissions: string[];  // deduplicated permission codes
}

