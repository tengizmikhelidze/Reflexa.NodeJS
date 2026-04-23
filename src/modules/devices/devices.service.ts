import {
    ConflictError,
    ForbiddenError,
    NotFoundError,
} from '../../shared/errors/http-errors.js';
import { AuthUser } from '../../shared/types/auth-user.types.js';
import { OrganizationsRepository } from '../organizations/organizations.repository.js';
import { DevicesRepository } from './devices.repository.js';
import {
    mapDeviceKitSummary,
    mapDeviceKitDetail,
    mapHubSummary,
    mapPodSummary,
    mapKitAccessGrant,
} from './devices.mapper.js';
import {
    CreateDeviceKitInput,
    GrantKitAccessInput,
    RegisterHubInput,
    RegisterPodsInput,
    ReassignPodInput,
    DeviceKitSummary,
    DeviceKitDetail,
    HubSummary,
    PodSummary,
    KitAccessGrant,
    DeviceKitRow,
} from './devices.types.js';

export class DevicesService {
    constructor(
        private readonly devicesRepo: DevicesRepository,
        private readonly orgsRepo: OrganizationsRepository
    ) {}

    // ── Create Device Kit ─────────────────────────────────────────────────────

    /**
     * Creates a device kit in the specified organization.
     * Requires org-level devices.manage permission.
     * Creator is set as owner_user_id.
     */
    async createDeviceKit(
        input: CreateDeviceKitInput,
        actor: AuthUser
    ): Promise<DeviceKitSummary> {
        // Verify the organization exists and is active
        const org = await this.orgsRepo.findById(input.organizationId);
        if (!org || !org.is_active) {
            throw new NotFoundError('Organization not found.');
        }

        // Require org-level devices.manage permission
        await this.requireOrgPermission(input.organizationId, actor, 'devices.manage');

        // Enforce unique code
        const existing = await this.devicesRepo.findDeviceKitByCode(input.code);
        if (existing) {
            throw new ConflictError(`A device kit with code "${input.code}" already exists.`);
        }

        const kit = await this.devicesRepo.createDeviceKit({
            organizationId: input.organizationId,
            name:           input.name,
            code:           input.code,
            description:    input.description,
            ownerUserId:    actor.userId,
            maxPods:        input.maxPods,
        });

        return mapDeviceKitSummary(kit);
    }

    // ── List Visible Device Kits ──────────────────────────────────────────────

    /**
     * Lists device kits visible to the current user:
     *   - super admin: all non-deleted kits
     *   - others: owned kits + kits they have access grants for
     *             + all kits in organizations they are active members of
     */
    async listDeviceKits(actor: AuthUser): Promise<DeviceKitSummary[]> {
        const kits = actor.isSuperAdmin
            ? await this.devicesRepo.findAllDeviceKits()
            : await this.devicesRepo.findDeviceKitsVisibleToUser(actor.userId);

        return kits.map(mapDeviceKitSummary);
    }

    // ── Get Device Kit Detail ─────────────────────────────────────────────────

    /**
     * Returns detailed info on a kit including hub and pod count.
     * Requires kit view access.
     */
    async getDeviceKitDetail(
        deviceKitId: string,
        actor: AuthUser
    ): Promise<DeviceKitDetail> {
        const kit = await this.requireKitExists(deviceKitId);
        await this.requireKitViewAccess(kit, actor);

        const hub = await this.devicesRepo.findHubByKitId(deviceKitId);
        const podCount = await this.devicesRepo.countPodsInKit(deviceKitId);

        return mapDeviceKitDetail(kit, hub, podCount);
    }

    // ── Grant / Update Kit Access ─────────────────────────────────────────────

    /**
     * Grant or update kit-level access for a user.
     * Requires kit manage access.
     * If an access row already exists, it is updated (upsert).
     */
    async grantKitAccess(
        deviceKitId: string,
        input: GrantKitAccessInput,
        actor: AuthUser
    ): Promise<KitAccessGrant> {
        const kit = await this.requireKitExists(deviceKitId);
        await this.requireKitManageAccess(kit, actor);

        const row = await this.devicesRepo.upsertKitAccess({
            deviceKitId,
            userId:           input.userId,
            canOperate:       input.canOperate,
            canManage:        input.canManage,
            grantedByUserId:  actor.userId,
        });

        return mapKitAccessGrant(row);
    }

    // ── List Kit Access Grants ─────────────────────────────────────────────────

    /**
     * Lists all access grants for a kit.
     * Requires kit manage access.
     */
    async listKitAccessGrants(
        deviceKitId: string,
        actor: AuthUser
    ): Promise<KitAccessGrant[]> {
        const kit = await this.requireKitExists(deviceKitId);
        await this.requireKitManageAccess(kit, actor);

        const rows = await this.devicesRepo.findKitAccessGrants(deviceKitId);
        return rows.map(mapKitAccessGrant);
    }

    // ── Register Hub ──────────────────────────────────────────────────────────

    /**
     * Registers a hub for a device kit.
     * Enforces one hub per kit — returns 409 if hub already exists.
     * Also rejects if the hardware UID is already registered to any kit.
     */
    async registerHub(
        deviceKitId: string,
        input: RegisterHubInput,
        actor: AuthUser
    ): Promise<HubSummary> {
        const kit = await this.requireKitExists(deviceKitId);
        await this.requireKitManageAccess(kit, actor);

        // One hub per kit (DB unique constraint would also catch this, but explicit error is better)
        const existingHub = await this.devicesRepo.findHubByKitId(deviceKitId);
        if (existingHub) {
            throw new ConflictError(
                'This device kit already has a hub registered. Remove the existing hub first.'
            );
        }

        // Reject duplicate hardware UID across all kits
        const duplicateHardwareHub = await this.devicesRepo.findHubByHardwareUid(input.hardwareUid);
        if (duplicateHardwareHub) {
            throw new ConflictError(
                `A hub with hardware UID "${input.hardwareUid}" is already registered to another kit.`
            );
        }

        const hub = await this.devicesRepo.createHub({
            deviceKitId,
            hardwareUid:     input.hardwareUid,
            serialNumber:    input.serialNumber,
            firmwareVersion: input.firmwareVersion,
            bluetoothName:   input.bluetoothName,
        });

        return mapHubSummary(hub);
    }

    // ── Register Pods ─────────────────────────────────────────────────────────

    /**
     * Registers one or more pods for a device kit.
     *
     * Per-pod logic:
     *   - hardware_uid not seen before → create pod + pairing history
     *   - hardware_uid exists, current_device_kit_id = null (unassigned) → assign + pairing history
     *   - hardware_uid exists, current_device_kit_id = this kit → 409 (already here)
     *   - hardware_uid exists, current_device_kit_id = other kit → 409 (must use explicit reassign)
     *
     * Processing is all-or-nothing: if any pod conflicts, the entire batch is rejected.
     */
    async registerPods(
        deviceKitId: string,
        input: RegisterPodsInput,
        actor: AuthUser
    ): Promise<PodSummary[]> {
        const kit = await this.requireKitExists(deviceKitId);
        await this.requireKitManageAccess(kit, actor);

        // Pre-flight: validate all pods before writing any, to fail fast on conflicts
        for (const podInput of input.pods) {
            const existing = await this.devicesRepo.findPodByHardwareUid(podInput.hardwareUid);
            if (!existing) continue; // new pod — OK

            if (existing.current_device_kit_id === deviceKitId) {
                throw new ConflictError(
                    `Pod with hardware UID "${podInput.hardwareUid}" is already assigned to this kit.`
                );
            }
            if (existing.current_device_kit_id !== null) {
                throw new ConflictError(
                    `Pod with hardware UID "${podInput.hardwareUid}" is already assigned to another kit. Use the explicit reassign endpoint to move it.`
                );
            }
        }

        // All pods are clear — proceed with writes
        const results: PodSummary[] = [];

        for (const podInput of input.pods) {
            const existing = await this.devicesRepo.findPodByHardwareUid(podInput.hardwareUid);

            let pod;
            if (!existing) {
                // New pod — create it
                pod = await this.devicesRepo.createPod({
                    hardwareUid:        podInput.hardwareUid,
                    serialNumber:       podInput.serialNumber,
                    firmwareVersion:    podInput.firmwareVersion,
                    currentDeviceKitId: deviceKitId,
                    displayName:        podInput.displayName,
                    logicalIndex:       podInput.logicalIndex,
                });
            } else {
                // Existing unassigned pod — assign it
                await this.devicesRepo.updatePodKitAssignment(existing.id, deviceKitId);
                // Reload to get updated row
                pod = (await this.devicesRepo.findPodById(existing.id))!;
            }

            // Create pairing history
            await this.devicesRepo.createPairingHistory(pod.id, deviceKitId, actor.userId);

            results.push(mapPodSummary(pod));
        }

        return results;
    }

    // ── List Pods ─────────────────────────────────────────────────────────────

    /**
     * Lists all active pods currently in a kit.
     * Requires kit view access.
     */
    async listPods(deviceKitId: string, actor: AuthUser): Promise<PodSummary[]> {
        const kit = await this.requireKitExists(deviceKitId);
        await this.requireKitViewAccess(kit, actor);

        const pods = await this.devicesRepo.findPodsByKitId(deviceKitId);
        return pods.map(mapPodSummary);
    }

    // ── Reassign Pod ──────────────────────────────────────────────────────────

    /**
     * Explicitly reassigns a pod from its current kit to a new kit.
     * This is a deliberate, audited action — not silent overwrite.
     *
     * Requires manage access on BOTH the source kit and the target kit.
     *
     * Flow:
     *   1. Load pod
     *   2. Verify pod is currently assigned somewhere
     *   3. Verify target kit exists
     *   4. Check manage access on source kit + target kit
     *   5. Close active pairing history on source kit
     *   6. Update pod.current_device_kit_id = targetKitId
     *   7. Create new pairing history on target kit
     */
    async reassignPod(
        podId: string,
        input: ReassignPodInput,
        actor: AuthUser
    ): Promise<PodSummary> {
        const pod = await this.devicesRepo.findPodById(podId);
        if (!pod) {
            throw new NotFoundError('Pod not found.');
        }

        if (!pod.current_device_kit_id) {
            throw new ConflictError(
                'Pod is not currently assigned to any kit. Use the register pods endpoint instead.'
            );
        }

        if (pod.current_device_kit_id === input.targetDeviceKitId) {
            throw new ConflictError('Pod is already assigned to the target kit.');
        }

        // Load and validate both kits
        const sourceKit = await this.requireKitExists(pod.current_device_kit_id);
        const targetKit = await this.requireKitExists(input.targetDeviceKitId);

        // Require manage access on source kit (actor must be authorised to remove from it)
        await this.requireKitManageAccess(sourceKit, actor);

        // Require manage access on target kit (actor must be authorised to add to it)
        await this.requireKitManageAccess(targetKit, actor);

        // Close active pairing on source
        await this.devicesRepo.closeActivePairingHistory(pod.id, sourceKit.id);

        // Move pod
        await this.devicesRepo.updatePodKitAssignment(pod.id, targetKit.id);

        // Open new pairing on target
        await this.devicesRepo.createPairingHistory(pod.id, targetKit.id, actor.userId);

        const updated = await this.devicesRepo.findPodById(pod.id);
        return mapPodSummary(updated!);
    }

    // ── Access Check Helpers ──────────────────────────────────────────────────

    /**
     * Requires the actor to have kit MANAGE access.
     *
     * Passes if ANY of:
     *   - actor is super admin
     *   - actor has org-level devices.manage permission on the kit's organization
     *   - actor has kit-level can_manage = true in device_kit_user_access
     */
    async requireKitManageAccess(kit: DeviceKitRow, actor: AuthUser): Promise<void> {
        if (actor.isSuperAdmin) return;

        // Check org-level permission
        const hasOrgPermission = await this.checkOrgPermission(
            kit.organization_id,
            actor.userId,
            'devices.manage'
        );
        if (hasOrgPermission) return;

        // Check kit-level can_manage
        const kitAccess = await this.devicesRepo.findKitAccessForUser(kit.id, actor.userId);
        if (kitAccess?.can_manage) return;

        throw new ForbiddenError(
            'You do not have permission to manage this device kit.'
        );
    }

    /**
     * Requires the actor to have kit VIEW (operate or manage) access.
     *
     * Passes if ANY of:
     *   - actor is super admin
     *   - actor has org-level devices.manage permission on the kit's organization
     *   - actor is an active member of the kit's organization
     *   - actor has kit-level can_operate = true OR can_manage = true
     */
    async requireKitViewAccess(kit: DeviceKitRow, actor: AuthUser): Promise<void> {
        if (actor.isSuperAdmin) return;

        // Check org-level permission
        const hasOrgPermission = await this.checkOrgPermission(
            kit.organization_id,
            actor.userId,
            'devices.manage'
        );
        if (hasOrgPermission) return;

        // Check org membership (active members can view their org's kits)
        const membership = await this.orgsRepo.findMembership(
            kit.organization_id,
            actor.userId
        );
        if (membership && membership.status === 'ACTIVE' && !membership.left_at) return;

        // Check kit-level access (can_operate OR can_manage)
        const kitAccess = await this.devicesRepo.findKitAccessForUser(kit.id, actor.userId);
        if (kitAccess?.can_operate || kitAccess?.can_manage) return;

        throw new ForbiddenError(
            'You do not have access to this device kit.'
        );
    }

    // ── Private Helpers ───────────────────────────────────────────────────────

    private async requireKitExists(deviceKitId: string): Promise<DeviceKitRow> {
        const kit = await this.devicesRepo.findDeviceKitById(deviceKitId);
        if (!kit) throw new NotFoundError('Device kit not found.');
        return kit;
    }

    /**
     * Requires actor to have a specific org-level permission.
     * Super admin bypasses automatically.
     */
    private async requireOrgPermission(
        organizationId: string,
        actor: AuthUser,
        permissionCode: string
    ): Promise<void> {
        if (actor.isSuperAdmin) return;

        const membership = await this.orgsRepo.findMembership(organizationId, actor.userId);
        if (!membership || membership.status !== 'ACTIVE' || membership.left_at !== null) {
            throw new ForbiddenError('You are not an active member of this organization.');
        }

        const permissions = await this.orgsRepo.findEffectivePermissions(
            organizationId,
            actor.userId
        );

        if (!permissions.includes(permissionCode)) {
            throw new ForbiddenError(
                `You do not have the required permission: ${permissionCode}`
            );
        }
    }

    /**
     * Returns true if the user has a specific org-level permission.
     * Does NOT throw — used for conditional checks.
     */
    private async checkOrgPermission(
        organizationId: string,
        userId: string,
        permissionCode: string
    ): Promise<boolean> {
        const membership = await this.orgsRepo.findMembership(organizationId, userId);
        if (!membership || membership.status !== 'ACTIVE' || membership.left_at !== null) {
            return false;
        }

        const permissions = await this.orgsRepo.findEffectivePermissions(
            organizationId,
            userId
        );

        return permissions.includes(permissionCode);
    }
}

