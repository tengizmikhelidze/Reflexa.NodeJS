import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../../shared/errors/http-errors.js';
import { sendSuccess } from '../../shared/utils/response.js';
import { PresetsService } from './presets.service.js';
import { listPresetsQuerySchema } from './presets.validation.js';
import { CreatePresetInput, UpdatePresetInput } from './presets.types.js';

export class PresetsController {
    constructor(private readonly presetsService: PresetsService) {}

    // POST /presets
    create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) return next(new UnauthorizedError());
            const preset = await this.presetsService.createPreset(req.body as CreatePresetInput, req.user);
            sendSuccess(res, { preset }, 201);
        } catch (err) { next(err); }
    };

    // GET /presets
    list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) return next(new UnauthorizedError());
            const parsed = listPresetsQuerySchema.safeParse(req.query);
            const filters = parsed.success ? parsed.data : {};
            const presets = await this.presetsService.listPresets(filters, req.user);
            sendSuccess(res, { presets });
        } catch (err) { next(err); }
    };

    // GET /presets/:presetId
    getDetail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) return next(new UnauthorizedError());
            const preset = await this.presetsService.getPresetDetail(
                req.params['presetId'] as string,
                req.user
            );
            sendSuccess(res, { preset });
        } catch (err) { next(err); }
    };

    // PATCH /presets/:presetId
    update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) return next(new UnauthorizedError());
            const preset = await this.presetsService.updatePreset(
                req.params['presetId'] as string,
                req.body as UpdatePresetInput,
                req.user
            );
            sendSuccess(res, { preset });
        } catch (err) { next(err); }
    };

    // DELETE /presets/:presetId
    delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) return next(new UnauthorizedError());
            await this.presetsService.deletePreset(
                req.params['presetId'] as string,
                req.user
            );
            sendSuccess(res, null, 200);
        } catch (err) { next(err); }
    };
}

