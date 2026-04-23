import { z } from 'zod';

// --- Path Param Schemas ---

export const scopeIdParamSchema = z.object({
    scopeId: z.string().uuid('scopeId must be a valid UUID'),
});

// --- Body Schemas ---

export const createViewerScopeSchema = z.object({
    organizationId: z.string().uuid('organizationId must be a valid UUID'),
    viewerUserId:   z.string().uuid('viewerUserId must be a valid UUID'),
    targetUserId:   z.string().uuid('targetUserId must be a valid UUID'),
}).refine(
    (data) => data.viewerUserId !== data.targetUserId,
    { message: 'viewerUserId and targetUserId must be different users', path: ['targetUserId'] }
);

// --- Query Schemas ---

export const listViewerScopesQuerySchema = z.object({
    organizationId: z.string().uuid().optional(),
    viewerUserId:   z.string().uuid().optional(),
});

// --- Inferred Types ---

export type CreateViewerScopeSchema     = z.infer<typeof createViewerScopeSchema>;
export type ListViewerScopesQuerySchema = z.infer<typeof listViewerScopesQuerySchema>;

