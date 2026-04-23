import { z } from 'zod';

// --- Path Param Schemas ---

export const presetIdParamSchema = z.object({
    presetId: z.string().uuid('presetId must be a valid UUID'),
});

// --- Body Schemas ---

export const createPresetSchema = z
    .object({
        scope:          z.enum(['USER', 'ORGANIZATION']),
        organizationId: z.string().uuid('organizationId must be a valid UUID').optional(),
        name:           z.string().trim().min(1).max(150),
        description:    z.string().trim().max(500).optional(),
        configJson:     z.record(z.string(), z.unknown()),
    })
    .refine(
        (data) => data.scope === 'USER' || (data.scope === 'ORGANIZATION' && data.organizationId !== undefined),
        { message: 'organizationId is required when scope is ORGANIZATION', path: ['organizationId'] }
    );

export const updatePresetSchema = z
    .object({
        name:        z.string().trim().min(1).max(150).optional(),
        description: z.string().trim().max(500).nullable().optional(),
        configJson:  z.record(z.string(), z.unknown()).optional(),
    })
    .refine(
        (data) => data.name !== undefined || data.description !== undefined || data.configJson !== undefined,
        { message: 'At least one field (name, description, configJson) must be provided' }
    );

// --- Query Schemas ---

export const listPresetsQuerySchema = z.object({
    scope:           z.enum(['USER', 'ORGANIZATION']).optional(),
    organizationId:  z.string().uuid().optional(),
    createdByUserId: z.string().uuid().optional(),
});

// --- Inferred Types ---

export type CreatePresetSchema    = z.infer<typeof createPresetSchema>;
export type UpdatePresetSchema    = z.infer<typeof updatePresetSchema>;
export type ListPresetsQuerySchema = z.infer<typeof listPresetsQuerySchema>;

