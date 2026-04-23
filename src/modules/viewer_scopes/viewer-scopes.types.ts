// --- DB Row Types ---

export interface ViewerScopeRow {
    id: string;
    organization_id: string;
    viewer_user_id: string;
    target_user_id: string;
    granted_by_user_id: string | null;
    created_at: Date;
}

// --- Request Inputs ---

export interface CreateViewerScopeInput {
    organizationId: string;
    viewerUserId: string;
    targetUserId: string;
}

export interface ListViewerScopesFilters {
    organizationId?: string;
    viewerUserId?: string;
}

// --- Response Shapes ---

export interface ViewerScopeSummary {
    id: string;
    organizationId: string;
    viewerUserId: string;
    targetUserId: string;
    grantedByUserId: string | null;
    createdAt: Date;
}

// NOTE: The current schema (app.viewer_access_scopes) supports only user-level
// visibility (viewer_user_id → target_user_id). Team-scoped visibility is NOT
// supported by the current schema and is therefore not implemented.

