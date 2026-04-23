import { Router } from 'express';
import { getDb } from '../../config/database.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { validate } from '../../shared/middlewares/validate.middleware.js';
import { OrganizationsRepository } from '../organizations/organizations.repository.js';
import { DevicesRepository } from './devices.repository.js';
import { DevicesService } from './devices.service.js';
import { DevicesController } from './devices.controller.js';
import {
    createDeviceKitSchema,
    grantKitAccessSchema,
    registerHubSchema,
    registerPodsSchema,
    reassignPodSchema,
    deviceKitIdParamSchema,
    podIdParamSchema,
} from './devices.validation.js';

/**
 * All device routes require authentication.
 * Path-param validation is applied per route.
 * Access control is enforced at service level.
 */
export async function createDevicesRouter(): Promise<Router> {
    const pool = await getDb();

    const orgsRepo    = new OrganizationsRepository(pool);
    const devicesRepo = new DevicesRepository(pool);
    const devicesService = new DevicesService(devicesRepo, orgsRepo);
    const controller  = new DevicesController(devicesService);

    const router = Router();

    // All routes require a valid access token
    router.use(authMiddleware);

    // ── Kit routes ──────────────────────────────────────────────────────────

    // POST /devices/kits — create a device kit
    router.post(
        '/kits',
        validate(createDeviceKitSchema),
        controller.createKit
    );

    // GET /devices/kits — list visible kits
    router.get('/kits', controller.listKits);

    // GET /devices/kits/:deviceKitId — get kit detail
    router.get(
        '/kits/:deviceKitId',
        validate(deviceKitIdParamSchema, 'params'),
        controller.getKit
    );

    // POST /devices/kits/:deviceKitId/access — grant/update kit access
    router.post(
        '/kits/:deviceKitId/access',
        validate(deviceKitIdParamSchema, 'params'),
        validate(grantKitAccessSchema),
        controller.grantAccess
    );

    // GET /devices/kits/:deviceKitId/access — list kit access grants
    router.get(
        '/kits/:deviceKitId/access',
        validate(deviceKitIdParamSchema, 'params'),
        controller.listAccess
    );

    // POST /devices/kits/:deviceKitId/hub — register hub
    router.post(
        '/kits/:deviceKitId/hub',
        validate(deviceKitIdParamSchema, 'params'),
        validate(registerHubSchema),
        controller.registerHub
    );

    // POST /devices/kits/:deviceKitId/pods — register pods
    router.post(
        '/kits/:deviceKitId/pods',
        validate(deviceKitIdParamSchema, 'params'),
        validate(registerPodsSchema),
        controller.registerPods
    );

    // GET /devices/kits/:deviceKitId/pods — list pods in kit
    router.get(
        '/kits/:deviceKitId/pods',
        validate(deviceKitIdParamSchema, 'params'),
        controller.listPods
    );

    // ── Pod routes ──────────────────────────────────────────────────────────

    // POST /devices/pods/:podId/reassign — explicit pod reassignment
    router.post(
        '/pods/:podId/reassign',
        validate(podIdParamSchema, 'params'),
        validate(reassignPodSchema),
        controller.reassignPod
    );

    return router;
}

