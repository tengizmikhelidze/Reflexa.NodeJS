import { PresetRow, PresetSummary, PresetDetail } from './presets.types.js';

function parseConfig(raw: string): Record<string, unknown> {
    try { return JSON.parse(raw) as Record<string, unknown>; }
    catch { return {}; }
}

export function mapPresetSummary(row: PresetRow): PresetSummary {
    return {
        id:              row.id,
        organizationId:  row.organization_id,
        createdByUserId: row.created_by_user_id,
        scope:           row.scope,
        name:            row.name,
        description:     row.description,
        createdAt:       row.created_at,
        updatedAt:       row.updated_at,
    };
}

export function mapPresetDetail(row: PresetRow): PresetDetail {
    return {
        ...mapPresetSummary(row),
        configJson: parseConfig(row.config_json),
    };
}

