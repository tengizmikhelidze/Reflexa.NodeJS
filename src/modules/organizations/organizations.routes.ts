import { Router } from 'express';
import { getDb } from '../../config/database.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { validate } from '../../shared/middlewares/validate.middleware.js';
import { UsersRepository } from '../users/users.repository.js';
import { OrganizationsRepository } from './organizations.repository.js';
import { OrganizationsService } from './organizations.service.js';
import { OrganizationsController } from './organizations.controller.js';
import {
    createOrganizationSchema,
    addMemberSchema,
    assignRolesSchema,
    organizationIdParamSchema,
    membershipIdParamSchema,
} from './organizations.validation.js';

/**
 * All organization routes require authentication.
 * Path-param validation is applied per route.
 */
export async function createOrganizationsRouter(): Promise<Router> {
    const pool = await getDb();

    const usersRepo = new UsersRepository(pool);
    const orgsRepo = new OrganizationsRepository(pool);
    const orgsService = new OrganizationsService(orgsRepo, usersRepo);
    const controller = new OrganizationsController(orgsService);

    const router = Router();

    // All routes require a valid access token
    router.use(authMiddleware);

    // POST /organizations
    router.post(
        '/',
        validate(createOrganizationSchema),
        controller.create
    );

    // GET /organizations
    router.get('/', controller.list);

    // GET /organizations/:organizationId/me
    router.get(
        '/:organizationId/me',
        validate(organizationIdParamSchema, 'params'),
        controller.getMyProfile
    );

    // POST /organizations/:organizationId/members
    router.post(
        '/:organizationId/members',
        validate(organizationIdParamSchema, 'params'),
        validate(addMemberSchema),
        controller.addMember
    );

    // GET /organizations/:organizationId/members
    router.get(
        '/:organizationId/members',
        validate(organizationIdParamSchema, 'params'),
        controller.listMembers
    );

    // POST /organizations/:organizationId/members/:membershipId/roles
    router.post(
        '/:organizationId/members/:membershipId/roles',
        validate(membershipIdParamSchema, 'params'),
        validate(assignRolesSchema),
        controller.assignRoles
    );

    // GET /organizations/:organizationId/members/:membershipId/permissions
    router.get(
        '/:organizationId/members/:membershipId/permissions',
        validate(membershipIdParamSchema, 'params'),
        controller.getPermissions
    );

    return router;
}

