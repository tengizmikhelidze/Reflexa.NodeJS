import { Router } from 'express';
import { getDb } from '../../config/database.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { validate } from '../../shared/middlewares/validate.middleware.js';
import { OrganizationsRepository } from '../organizations/organizations.repository.js';
import { PresetsRepository } from './presets.repository.js';
import { PresetsService } from './presets.service.js';
import { PresetsController } from './presets.controller.js';
import {
    createPresetSchema,
    updatePresetSchema,
    presetIdParamSchema,
} from './presets.validation.js';

export async function createPresetsRouter(): Promise<Router> {
    const pool = await getDb();

    const orgsRepo    = new OrganizationsRepository(pool);
    const presetsRepo = new PresetsRepository(pool);
    const service     = new PresetsService(presetsRepo, orgsRepo);
    const controller  = new PresetsController(service);

    const router = Router();

    // All routes require a valid access token
    router.use(authMiddleware);

    // POST /presets
    router.post('/', validate(createPresetSchema), controller.create);

    // GET /presets
    router.get('/', controller.list);

    // GET /presets/:presetId
    router.get('/:presetId', validate(presetIdParamSchema, 'params'), controller.getDetail);

    // PATCH /presets/:presetId
    router.patch(
        '/:presetId',
        validate(presetIdParamSchema, 'params'),
        validate(updatePresetSchema),
        controller.update
    );

    // DELETE /presets/:presetId
    router.delete('/:presetId', validate(presetIdParamSchema, 'params'), controller.delete);

    return router;
}

