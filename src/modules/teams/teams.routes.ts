import { Router } from 'express';
import { getDb } from '../../config/database.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { validate } from '../../shared/middlewares/validate.middleware.js';
import { OrganizationsRepository } from '../organizations/organizations.repository.js';
import { TeamsRepository } from './teams.repository.js';
import { TeamsService } from './teams.service.js';
import { TeamsController } from './teams.controller.js';
import {
    createTeamSchema,
    addTeamMemberSchema,
    teamIdParamSchema,
    teamMemberParamSchema,
    listTeamsQuerySchema,
} from './teams.validation.js';

export async function createTeamsRouter(): Promise<Router> {
    const pool = await getDb();

    const orgsRepo  = new OrganizationsRepository(pool);
    const teamsRepo = new TeamsRepository(pool);
    const service   = new TeamsService(teamsRepo, orgsRepo);
    const controller = new TeamsController(service);

    const router = Router();

    // All routes require a valid access token
    router.use(authMiddleware);

    // POST /teams
    router.post('/', validate(createTeamSchema), controller.create);

    // GET /teams
    router.get('/', validate(listTeamsQuerySchema, 'query'), controller.list);

    // GET /teams/:teamId
    router.get('/:teamId', validate(teamIdParamSchema, 'params'), controller.getDetail);

    // POST /teams/:teamId/members
    router.post(
        '/:teamId/members',
        validate(teamIdParamSchema, 'params'),
        validate(addTeamMemberSchema),
        controller.addMember
    );

    // GET /teams/:teamId/members
    router.get(
        '/:teamId/members',
        validate(teamIdParamSchema, 'params'),
        controller.listMembers
    );

    // DELETE /teams/:teamId/members/:userId
    router.delete(
        '/:teamId/members/:userId',
        validate(teamMemberParamSchema, 'params'),
        controller.removeMember
    );

    return router;
}

