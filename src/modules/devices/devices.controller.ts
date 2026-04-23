import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../../shared/errors/http-errors.js';
import { sendSuccess } from '../../shared/utils/response.js';
import { DevicesService } from './devices.service.js';
import {
    CreateDeviceKitInput,
    GrantKitAccessInput,
    RegisterHubInput,
    RegisterPodsInput,
    ReassignPodInput,
} from './devices.types.js';

export class DevicesController {
    constructor(private readonly devicesService: DevicesService) {}

    // POST /devices/kits
    createKit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) return next(new UnauthorizedError());
            const result = await this.devicesService.createDeviceKit(
                req.body as CreateDeviceKitInput,
                req.user
            );
            sendSuccess(res, { kit: result }, 201);
        } catch (err) { next(err); }
    };

    // GET /devices/kits
    listKits = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) return next(new UnauthorizedError());
            const result = await this.devicesService.listDeviceKits(req.user);
            sendSuccess(res, { kits: result });
        } catch (err) { next(err); }
    };

    // GET /devices/kits/:deviceKitId
    getKit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) return next(new UnauthorizedError());
            const result = await this.devicesService.getDeviceKitDetail(
                req.params['deviceKitId'] as string,
                req.user
            );
            sendSuccess(res, { kit: result });
        } catch (err) { next(err); }
    };

    // POST /devices/kits/:deviceKitId/access
    grantAccess = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) return next(new UnauthorizedError());
            const result = await this.devicesService.grantKitAccess(
                req.params['deviceKitId'] as string,
                req.body as GrantKitAccessInput,
                req.user
            );
            sendSuccess(res, { access: result }, 201);
        } catch (err) { next(err); }
    };

    // GET /devices/kits/:deviceKitId/access
    listAccess = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) return next(new UnauthorizedError());
            const result = await this.devicesService.listKitAccessGrants(
                req.params['deviceKitId'] as string,
                req.user
            );
            sendSuccess(res, { accessGrants: result });
        } catch (err) { next(err); }
    };

    // POST /devices/kits/:deviceKitId/hub
    registerHub = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) return next(new UnauthorizedError());
            const result = await this.devicesService.registerHub(
                req.params['deviceKitId'] as string,
                req.body as RegisterHubInput,
                req.user
            );
            sendSuccess(res, { hub: result }, 201);
        } catch (err) { next(err); }
    };

    // POST /devices/kits/:deviceKitId/pods
    registerPods = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) return next(new UnauthorizedError());
            const result = await this.devicesService.registerPods(
                req.params['deviceKitId'] as string,
                req.body as RegisterPodsInput,
                req.user
            );
            sendSuccess(res, { pods: result }, 201);
        } catch (err) { next(err); }
    };

    // GET /devices/kits/:deviceKitId/pods
    listPods = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) return next(new UnauthorizedError());
            const result = await this.devicesService.listPods(
                req.params['deviceKitId'] as string,
                req.user
            );
            sendSuccess(res, { pods: result });
        } catch (err) { next(err); }
    };

    // POST /devices/pods/:podId/reassign
    reassignPod = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) return next(new UnauthorizedError());
            const result = await this.devicesService.reassignPod(
                req.params['podId'] as string,
                req.body as ReassignPodInput,
                req.user
            );
            sendSuccess(res, { pod: result });
        } catch (err) { next(err); }
    };
}

