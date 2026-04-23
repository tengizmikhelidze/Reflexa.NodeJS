import { z } from 'zod';

// ─── Path Param Schemas ───────────────────────────────────────────────────────

export const deviceKitIdParamSchema = z.object({
    deviceKitId: z.string().uuid('deviceKitId must be a valid UUID'),
});

export const podIdParamSchema = z.object({
    podId: z.string().uuid('podId must be a valid UUID'),
});

// ─── Body Schemas ─────────────────────────────────────────────────────────────

export const createDeviceKitSchema = z.object({
    organizationId: z.string().uuid('organizationId must be a valid UUID'),
    name: z.string().trim().min(1, 'name is required').max(150),
    code: z
        .string()
        .trim()
        .min(1, 'code is required')
        .max(100)
        .regex(
            /^[a-z0-9-]+$/,
            'code must contain only lowercase letters, numbers, and hyphens'
        ),
    description: z.string().trim().max(500).optional(),
    maxPods: z.number().int().min(1).max(200).optional(),
});

export const grantKitAccessSchema = z.object({
    userId: z.string().uuid('userId must be a valid UUID'),
    canOperate: z.boolean(),
    canManage: z.boolean(),
});

export const registerHubSchema = z.object({
    hardwareUid: z.string().trim().min(1, 'hardwareUid is required').max(100),
    serialNumber: z.string().trim().max(100).optional(),
    firmwareVersion: z.string().trim().max(50).optional(),
    bluetoothName: z.string().trim().max(100).optional(),
});

export const registerPodsSchema = z.object({
    pods: z
        .array(
            z.object({
                hardwareUid: z.string().trim().min(1, 'hardwareUid is required').max(100),
                serialNumber: z.string().trim().max(100).optional(),
                firmwareVersion: z.string().trim().max(50).optional(),
                displayName: z.string().trim().max(100).optional(),
                logicalIndex: z.number().int().min(0).optional(),
            })
        )
        .min(1, 'At least one pod is required'),
});

export const reassignPodSchema = z.object({
    targetDeviceKitId: z.string().uuid('targetDeviceKitId must be a valid UUID'),
});

// ─── Inferred Types ───────────────────────────────────────────────────────────

export type CreateDeviceKitSchema = z.infer<typeof createDeviceKitSchema>;
export type GrantKitAccessSchema = z.infer<typeof grantKitAccessSchema>;
export type RegisterHubSchema = z.infer<typeof registerHubSchema>;
export type RegisterPodsSchema = z.infer<typeof registerPodsSchema>;
export type ReassignPodSchema = z.infer<typeof reassignPodSchema>;

