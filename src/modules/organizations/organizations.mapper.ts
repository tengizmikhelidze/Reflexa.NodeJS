import {
    OrganizationSummary,
    OrganizationRow,
    MembershipRow,
    MembershipSummary,
} from './organizations.types.js';

export function mapOrganization(row: OrganizationRow): OrganizationSummary {
    return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        isActive: row.is_active,
        createdAt: row.created_at,
    };
}

export function mapMembership(row: MembershipRow, roleCodes: string[]): MembershipSummary {
    return {
        id: row.id,
        userId: row.user_id,
        status: row.status,
        joinedAt: row.joined_at,
        roles: roleCodes,
    };
}

