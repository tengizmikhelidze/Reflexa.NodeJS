// --- DB Row Types ---

export interface PresetRow {
    id: string;
    organization_id: string | null;
    created_by_user_id: string;
    scope: string; // 'USER' | 'ORGANIZATION'
    name: string;
    description: string | null;
    config_json: string; // JSON string — parsed before returning
    created_at: Date;
    updated_at: Date;
    deleted_at: Date | null;
}

// --- Request Inputs ---

export interface CreatePresetInput {
    scope: 'USER' | 'ORGANIZATION';
    organizationId?: string;
    name: string;
    description?: string;
    configJson: Record<string, unknown>;
}

export interface UpdatePresetInput {
    name?: string;
    description?: string | null;
    configJson?: Record<string, unknown>;
}

export interface ListPresetsFilters {
    scope?: string;
    organizationId?: string;
    createdByUserId?: string;
}

// --- Response Shapes ---

export interface PresetSummary {
    id: string;
    organizationId: string | null;
    createdByUserId: string;
    scope: string;
    name: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface PresetDetail extends PresetSummary {
    configJson: Record<string, unknown>;
}

