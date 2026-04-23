// --- DB Row Types ---

export interface TeamRow {
    id: string;
    organization_id: string;
    name: string;
    description: string | null;
    created_at: Date;
    updated_at: Date;
    deleted_at: Date | null;
}

export interface TeamMembershipRow {
    id: string;
    team_id: string;
    user_id: string;
    created_at: Date;
}

// --- Request Inputs ---

export interface CreateTeamInput {
    organizationId: string;
    name: string;
    description?: string;
}

export interface AddTeamMemberInput {
    userId: string;
}

export interface ListTeamsFilters {
    organizationId?: string;
}

// --- Response Shapes ---

export interface TeamSummary {
    id: string;
    organizationId: string;
    name: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface TeamDetail extends TeamSummary {
    memberCount: number;
}

export interface TeamMemberSummary {
    id: string;         // team_membership id
    teamId: string;
    userId: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    displayName: string | null;
    joinedAt: Date;
}

