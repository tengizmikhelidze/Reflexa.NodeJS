import { z } from 'zod';

// ─── Path Params ──────────────────────────────────────────────────────────────

export const organizationIdParamSchema = z.object({
    organizationId: z.string().uuid('organizationId must be a valid UUID'),
});

export const membershipIdParamSchema = z.object({
    organizationId: z.string().uuid('organizationId must be a valid UUID'),
    membershipId: z.string().uuid('membershipId must be a valid UUID'),
});

export type OrganizationIdParam = z.infer<typeof organizationIdParamSchema>;
export type MembershipIdParam = z.infer<typeof membershipIdParamSchema>;

// ─── Create Organization ──────────────────────────────────────────────────────

export const createOrganizationSchema = z.object({
    name: z.string().trim().min(1, 'Name is required').max(200, 'Name is too long'),
    slug: z
        .string()
        .trim()
        .min(1, 'Slug is required')
        .max(150, 'Slug is too long')
        .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
    description: z.string().trim().max(1000).optional(),
});

export type CreateOrganizationSchema = z.infer<typeof createOrganizationSchema>;

// ─── Add Member ───────────────────────────────────────────────────────────────

export const addMemberSchema = z.object({
    email: z
        .string({ error: 'Email is required' })
        .trim()
        .toLowerCase()
        .email('Invalid email address'),
    roleCodes: z
        .array(z.string().trim().min(1))
        .optional(),
});

export type AddMemberSchema = z.infer<typeof addMemberSchema>;

// ─── Assign Roles ─────────────────────────────────────────────────────────────

export const assignRolesSchema = z.object({
    roleCodes: z
        .array(z.string().trim().min(1, 'Role code cannot be empty'))
        .min(1, 'At least one role code is required'),
});

export type AssignRolesSchema = z.infer<typeof assignRolesSchema>;

