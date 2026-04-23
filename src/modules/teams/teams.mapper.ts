import { TeamRow, TeamSummary, TeamDetail } from './teams.types.js';

export function mapTeamSummary(row: TeamRow): TeamSummary {
    return {
        id:             row.id,
        organizationId: row.organization_id,
        name:           row.name,
        description:    row.description,
        createdAt:      row.created_at,
        updatedAt:      row.updated_at,
    };
}

export function mapTeamDetail(row: TeamRow, memberCount: number): TeamDetail {
    return {
        ...mapTeamSummary(row),
        memberCount,
    };
}

