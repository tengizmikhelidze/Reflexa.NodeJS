import { ViewerScopeRow, ViewerScopeSummary } from './viewer-scopes.types.js';

export function mapViewerScope(row: ViewerScopeRow): ViewerScopeSummary {
    return {
        id:              row.id,
        organizationId:  row.organization_id,
        viewerUserId:    row.viewer_user_id,
        targetUserId:    row.target_user_id,
        grantedByUserId: row.granted_by_user_id,
        createdAt:       row.created_at,
    };
}

