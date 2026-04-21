import { Request, Response, NextFunction } from 'express';
import { OrganizationsService } from './organizations.service.js';
import { sendSuccess } from '../../shared/utils/response.js';
import { UnauthorizedError } from '../../shared/errors/http-errors.js';
import {
    CreateOrganizationInput,
    AddMemberInput,
    AssignRolesInput,
} from './organizations.types.js';

export class OrganizationsController {
    constructor(private readonly orgsService: OrganizationsService) {}

    // POST /organizations
    create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) return next(new UnauthorizedError());
            const result = await this.orgsService.createOrganization(
                req.body as CreateOrganizationInput,
                req.user
            );
            sendSuccess(res, { organization: result }, 201);
        } catch (err) { next(err); }
    };

    // GET /organizations
    list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) return next(new UnauthorizedError());
            const result = await this.orgsService.listOrganizations(req.user);
            sendSuccess(res, { organizations: result });
        } catch (err) { next(err); }
    };

    // GET /organizations/:organizationId/me
    getMyProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) return next(new UnauthorizedError());
            const result = await this.orgsService.getMyAccessProfile(
                req.params.organizationId,
                req.user
            );
            sendSuccess(res, result);
        } catch (err) { next(err); }
    };

    // POST /organizations/:organizationId/members
    addMember = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) return next(new UnauthorizedError());
            const result = await this.orgsService.addMember(
                req.params.organizationId,
                req.body as AddMemberInput,
                req.user
            );
            sendSuccess(res, { member: result }, 201);
        } catch (err) { next(err); }
    };

    // GET /organizations/:organizationId/members
    listMembers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) return next(new UnauthorizedError());
            const result = await this.orgsService.listMembers(
                req.params.organizationId,
                req.user
            );
            sendSuccess(res, { members: result });
        } catch (err) { next(err); }
    };

    // POST /organizations/:organizationId/members/:membershipId/roles
    assignRoles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) return next(new UnauthorizedError());
            const result = await this.orgsService.assignRoles(
                req.params.organizationId,
                req.params.membershipId,
                req.body as AssignRolesInput,
                req.user
            );
            sendSuccess(res, { assignedRoles: result });
        } catch (err) { next(err); }
    };

    // GET /organizations/:organizationId/members/:membershipId/permissions
    getPermissions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) return next(new UnauthorizedError());
            const result = await this.orgsService.getEffectivePermissions(
                req.params.organizationId,
                req.params.membershipId,
                req.user
            );
            sendSuccess(res, result);
        } catch (err) { next(err); }
    };
}

