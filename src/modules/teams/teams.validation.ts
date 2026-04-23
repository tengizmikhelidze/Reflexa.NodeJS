import { z } from 'zod';

// --- Path Param Schemas ---

export const teamIdParamSchema = z.object({
    teamId: z.string().uuid('teamId must be a valid UUID'),
});

export const teamMemberParamSchema = z.object({
    teamId: z.string().uuid('teamId must be a valid UUID'),
    userId: z.string().uuid('userId must be a valid UUID'),
});

// --- Body Schemas ---

export const createTeamSchema = z.object({
    organizationId: z.string().uuid('organizationId must be a valid UUID'),
    name:           z.string().trim().min(1).max(150),
    description:    z.string().trim().max(500).optional(),
});

export const addTeamMemberSchema = z.object({
    userId: z.string().uuid('userId must be a valid UUID'),
});

// --- Query Schemas ---

export const listTeamsQuerySchema = z.object({
    organizationId: z.string().uuid().optional(),
});

// --- Inferred Types ---

export type CreateTeamSchema     = z.infer<typeof createTeamSchema>;
export type AddTeamMemberSchema  = z.infer<typeof addTeamMemberSchema>;
export type ListTeamsQuerySchema = z.infer<typeof listTeamsQuerySchema>;

