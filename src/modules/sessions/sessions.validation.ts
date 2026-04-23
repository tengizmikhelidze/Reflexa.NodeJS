import { z } from 'zod';

// ─── Path Param Schemas ───────────────────────────────────────────────────────

export const sessionIdParamSchema = z.object({
    sessionId: z.string().uuid('sessionId must be a valid UUID'),
});

// ─── Body Schemas ─────────────────────────────────────────────────────────────

const activePodSchema = z.object({
    podDeviceId: z.string().uuid('podDeviceId must be a valid UUID'),
    podOrder:    z.number().int().min(0).optional(),
});

const sessionEventSchema = z.object({
    podDeviceId:    z.string().uuid().optional(),
    eventIndex:     z.number().int().min(0),
    eventType:      z.string().trim().min(1).max(50),
    eventTimestamp: z.string().datetime({ message: 'eventTimestamp must be a valid ISO 8601 datetime' }),
    elapsedMs:      z.number().int().min(0).optional(),
    reactionTimeMs: z.number().min(0).optional(),
    isCorrect:      z.boolean().optional(),
    payloadJson:    z.record(z.string(), z.unknown()).optional(),
});

export const syncSessionSchema = z.object({
    clientSessionId: z.string().trim().min(1).max(100),
    organizationId:  z.string().uuid('organizationId must be a valid UUID'),
    deviceKitId:     z.string().uuid('deviceKitId must be a valid UUID'),
    hubDeviceId:     z.string().uuid('hubDeviceId must be a valid UUID').optional(),

    startedByUserId:  z.string().uuid().optional(),
    assignedToUserId: z.string().uuid().optional(),
    teamId:           z.string().uuid().optional(),

    origin: z.enum(['OFFLINE_SYNC', 'WEB', 'ADMIN_CREATE']),
    status: z.enum(['COMPLETED', 'CANCELLED', 'FAILED']),
    endMode: z.enum(['TIME', 'TARGET', 'REPETITION', 'EARLY_END']),
    presetId:      z.string().uuid().optional(),
    trainingMode:  z.string().trim().min(1).max(50),
    configJson:    z.record(z.string(), z.unknown()),

    sessionStartedAt: z.string().datetime({ message: 'sessionStartedAt must be a valid ISO 8601 datetime' }),
    sessionEndedAt:   z.string().datetime({ message: 'sessionEndedAt must be a valid ISO 8601 datetime' }),
    durationMs:       z.number().int().min(0),

    score:           z.number().int().optional(),
    hitCount:        z.number().int().min(0),
    missCount:       z.number().int().min(0),
    accuracyPercent: z.number().min(0).max(100).optional(),

    avgReactionMs:   z.number().min(0).optional(),
    bestReactionMs:  z.number().min(0).optional(),
    worstReactionMs: z.number().min(0).optional(),

    notes: z.string().trim().max(1000).optional(),

    activePods: z.array(activePodSchema).optional(),
    events:     z.array(sessionEventSchema).optional(),
});

export const assignSessionSchema = z.object({
    assignedToUserId: z.string().uuid('assignedToUserId must be a valid UUID').nullable().optional(),
    teamId:           z.string().uuid('teamId must be a valid UUID').nullable().optional(),
});

export const listSessionsQuerySchema = z.object({
    organizationId:   z.string().uuid('organizationId must be a valid UUID').optional(),
    assignedToUserId: z.string().uuid('assignedToUserId must be a valid UUID').optional(),
    teamId:           z.string().uuid('teamId must be a valid UUID').optional(),
    limit:            z.coerce.number().int().min(1).max(200).default(50),
    offset:           z.coerce.number().int().min(0).default(0),
});

// ─── Inferred Types ───────────────────────────────────────────────────────────

export type SyncSessionSchema   = z.infer<typeof syncSessionSchema>;
export type AssignSessionSchema = z.infer<typeof assignSessionSchema>;
export type ListSessionsQuerySchema = z.infer<typeof listSessionsQuerySchema>;



