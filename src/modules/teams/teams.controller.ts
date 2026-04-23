import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../../shared/errors/http-errors.js';
import { sendSuccess } from '../../shared/utils/response.js';
import { TeamsService } from './teams.service.js';
import { CreateTeamInput, AddTeamMemberInput, ListTeamsFilters } from './teams.types.js';

export class TeamsController {
    constructor(private readonly teamsService: TeamsService) {}

    // POST /teams
    create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) return next(new UnauthorizedError());
            const team = await this.teamsService.createTeam(req.body as CreateTeamInput, req.user);
            sendSuccess(res, { team }, 201);
        } catch (err) { next(err); }
    };

    // GET /teams — query params validated by validate(listTeamsQuerySchema, 'query') in routes
    list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) return next(new UnauthorizedError());
            const filters = req.query as unknown as ListTeamsFilters;
            const teams = await this.teamsService.listTeams(filters, req.user);
            sendSuccess(res, { teams });
        } catch (err) { next(err); }
    };

    // GET /teams/:teamId
    getDetail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) return next(new UnauthorizedError());
            const team = await this.teamsService.getTeamDetail(
                req.params['teamId'] as string,
                req.user
            );
            sendSuccess(res, { team });
        } catch (err) { next(err); }
    };

    // POST /teams/:teamId/members
    addMember = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) return next(new UnauthorizedError());
            const members = await this.teamsService.addTeamMember(
                req.params['teamId'] as string,
                req.body as AddTeamMemberInput,
                req.user
            );
            sendSuccess(res, { members }, 201);
        } catch (err) { next(err); }
    };

    // GET /teams/:teamId/members
    listMembers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) return next(new UnauthorizedError());
            const members = await this.teamsService.listTeamMembers(
                req.params['teamId'] as string,
                req.user
            );
            sendSuccess(res, { members });
        } catch (err) { next(err); }
    };

    // DELETE /teams/:teamId/members/:userId
    removeMember = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) return next(new UnauthorizedError());
            await this.teamsService.removeTeamMember(
                req.params['teamId'] as string,
                req.params['userId'] as string,
                req.user
            );
            sendSuccess(res, null, 200);
        } catch (err) { next(err); }
    };
}

