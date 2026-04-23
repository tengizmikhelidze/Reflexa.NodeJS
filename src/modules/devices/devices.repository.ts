import sql from 'mssql';
import {
    DeviceKitRow,
    HubDeviceRow,
    PodDeviceRow,
    PodPairingHistoryRow,
    DeviceKitUserAccessRow,
} from './devices.types.js';

export interface CreateDeviceKitData {
    organizationId: string;
    name: string;
    code: string;
    description?: string;
    ownerUserId?: string;
    maxPods?: number;
}

export interface CreateHubData {
    deviceKitId: string;
    hardwareUid: string;
    serialNumber?: string;
    firmwareVersion?: string;
    bluetoothName?: string;
}

export interface CreatePodData {
    hardwareUid: string;
    serialNumber?: string;
    firmwareVersion?: string;
    currentDeviceKitId: string;
    displayName?: string;
    logicalIndex?: number;
}

export interface UpsertKitAccessData {
    deviceKitId: string;
    userId: string;
    canOperate: boolean;
    canManage: boolean;
    grantedByUserId?: string;
}

export class DevicesRepository {
    constructor(private readonly pool: sql.ConnectionPool) {}

    // ── Device Kits ───────────────────────────────────────────────────────────

    /**
     * Create a new device kit.
     * Soft-delete: deleted_at IS NULL means active.
     */
    async createDeviceKit(data: CreateDeviceKitData): Promise<DeviceKitRow> {
        const result = await this.pool
            .request()
            .input('organizationId', sql.UniqueIdentifier, data.organizationId)
            .input('name', sql.NVarChar(150), data.name)
            .input('code', sql.NVarChar(100), data.code)
            .input('description', sql.NVarChar(500), data.description ?? null)
            .input('ownerUserId', sql.UniqueIdentifier, data.ownerUserId ?? null)
            .input('maxPods', sql.Int, data.maxPods ?? 20)
            .query<DeviceKitRow>(`
                INSERT INTO app.device_kits
                    (organization_id, name, code, description, owner_user_id, max_pods)
                OUTPUT
                    INSERTED.id, INSERTED.organization_id, INSERTED.name, INSERTED.code,
                    INSERTED.description, INSERTED.owner_user_id, INSERTED.max_pods,
                    INSERTED.created_at, INSERTED.updated_at, INSERTED.deleted_at
                VALUES
                    (@organizationId, @name, @code, @description, @ownerUserId, @maxPods)
            `);
        return result.recordset[0];
    }

    /**
     * Find a device kit by ID. Returns null if not found or soft-deleted.
     */
    async findDeviceKitById(id: string): Promise<DeviceKitRow | null> {
        const result = await this.pool
            .request()
            .input('id', sql.UniqueIdentifier, id)
            .query<DeviceKitRow>(`
                SELECT id, organization_id, name, code, description,
                       owner_user_id, max_pods, created_at, updated_at, deleted_at
                FROM app.device_kits
                WHERE id = @id
                  AND deleted_at IS NULL
            `);
        return result.recordset[0] ?? null;
    }

    /**
     * Find a device kit by code. Used to enforce unique code constraint at service level.
     */
    async findDeviceKitByCode(code: string): Promise<DeviceKitRow | null> {
        const result = await this.pool
            .request()
            .input('code', sql.NVarChar(100), code)
            .query<DeviceKitRow>(`
                SELECT id, organization_id, name, code, description,
                       owner_user_id, max_pods, created_at, updated_at, deleted_at
                FROM app.device_kits
                WHERE code = @code
                  AND deleted_at IS NULL
            `);
        return result.recordset[0] ?? null;
    }

    /**
     * List all non-deleted device kits. For super admin use only.
     */
    async findAllDeviceKits(): Promise<DeviceKitRow[]> {
        const result = await this.pool
            .request()
            .query<DeviceKitRow>(`
                SELECT id, organization_id, name, code, description,
                       owner_user_id, max_pods, created_at, updated_at, deleted_at
                FROM app.device_kits
                WHERE deleted_at IS NULL
                ORDER BY created_at DESC
            `);
        return result.recordset;
    }

    /**
     * List device kits visible to a specific user:
     *   - kits they own (owner_user_id = userId)
     *   - kits they have explicit access grants for (device_kit_user_access)
     *   - kits in organizations they are an active member of
     */
    async findDeviceKitsVisibleToUser(userId: string): Promise<DeviceKitRow[]> {
        const result = await this.pool
            .request()
            .input('userId', sql.UniqueIdentifier, userId)
            .query<DeviceKitRow>(`
                SELECT DISTINCT
                    dk.id, dk.organization_id, dk.name, dk.code, dk.description,
                    dk.owner_user_id, dk.max_pods, dk.created_at, dk.updated_at, dk.deleted_at
                FROM app.device_kits dk
                WHERE dk.deleted_at IS NULL
                  AND (
                      dk.owner_user_id = @userId
                      OR EXISTS (
                          SELECT 1
                          FROM app.device_kit_user_access dkua
                          WHERE dkua.device_kit_id = dk.id
                            AND dkua.user_id = @userId
                      )
                      OR EXISTS (
                          SELECT 1
                          FROM app.organization_memberships om
                          WHERE om.organization_id = dk.organization_id
                            AND om.user_id = @userId
                            AND om.status = 'ACTIVE'
                            AND om.left_at IS NULL
                      )
                  )
                ORDER BY dk.created_at DESC
            `);
        return result.recordset;
    }

    /**
     * Count the number of pods currently assigned to a kit.
     */
    async countPodsInKit(deviceKitId: string): Promise<number> {
        const result = await this.pool
            .request()
            .input('deviceKitId', sql.UniqueIdentifier, deviceKitId)
            .query<{ pod_count: number }>(`
                SELECT COUNT(*) AS pod_count
                FROM app.pod_devices
                WHERE current_device_kit_id = @deviceKitId
                  AND is_active = 1
            `);
        return result.recordset[0]?.pod_count ?? 0;
    }

    // ── Kit Access Grants ─────────────────────────────────────────────────────

    /**
     * Upsert a kit-level access grant for a user.
     * Uses MERGE to handle both insert and update in a single round-trip.
     */
    async upsertKitAccess(data: UpsertKitAccessData): Promise<DeviceKitUserAccessRow> {
        const result = await this.pool
            .request()
            .input('deviceKitId', sql.UniqueIdentifier, data.deviceKitId)
            .input('userId', sql.UniqueIdentifier, data.userId)
            .input('canOperate', sql.Bit, data.canOperate)
            .input('canManage', sql.Bit, data.canManage)
            .input('grantedByUserId', sql.UniqueIdentifier, data.grantedByUserId ?? null)
            .query<DeviceKitUserAccessRow>(`
                MERGE app.device_kit_user_access AS target
                USING (SELECT @deviceKitId AS device_kit_id, @userId AS user_id) AS source
                    ON target.device_kit_id = source.device_kit_id
                   AND target.user_id       = source.user_id
                WHEN MATCHED THEN
                    UPDATE SET
                        can_operate       = @canOperate,
                        can_manage        = @canManage,
                        granted_by_user_id = @grantedByUserId
                WHEN NOT MATCHED THEN
                    INSERT (device_kit_id, user_id, can_operate, can_manage, granted_by_user_id)
                    VALUES (@deviceKitId, @userId, @canOperate, @canManage, @grantedByUserId)
                OUTPUT
                    INSERTED.id, INSERTED.device_kit_id, INSERTED.user_id,
                    INSERTED.can_operate, INSERTED.can_manage,
                    INSERTED.granted_by_user_id, INSERTED.created_at;
            `);
        return result.recordset[0];
    }

    /**
     * List all access grants for a kit.
     */
    async findKitAccessGrants(deviceKitId: string): Promise<DeviceKitUserAccessRow[]> {
        const result = await this.pool
            .request()
            .input('deviceKitId', sql.UniqueIdentifier, deviceKitId)
            .query<DeviceKitUserAccessRow>(`
                SELECT id, device_kit_id, user_id, can_operate, can_manage,
                       granted_by_user_id, created_at
                FROM app.device_kit_user_access
                WHERE device_kit_id = @deviceKitId
                ORDER BY created_at ASC
            `);
        return result.recordset;
    }

    /**
     * Find a single kit access grant for a specific user and kit.
     */
    async findKitAccessForUser(
        deviceKitId: string,
        userId: string
    ): Promise<DeviceKitUserAccessRow | null> {
        const result = await this.pool
            .request()
            .input('deviceKitId', sql.UniqueIdentifier, deviceKitId)
            .input('userId', sql.UniqueIdentifier, userId)
            .query<DeviceKitUserAccessRow>(`
                SELECT id, device_kit_id, user_id, can_operate, can_manage,
                       granted_by_user_id, created_at
                FROM app.device_kit_user_access
                WHERE device_kit_id = @deviceKitId
                  AND user_id       = @userId
            `);
        return result.recordset[0] ?? null;
    }

    // ── Hub Devices ───────────────────────────────────────────────────────────

    /**
     * Create a hub for a device kit.
     * UQ_hub_devices_device_kit enforces one hub per kit at DB level.
     */
    async createHub(data: CreateHubData): Promise<HubDeviceRow> {
        const result = await this.pool
            .request()
            .input('deviceKitId', sql.UniqueIdentifier, data.deviceKitId)
            .input('hardwareUid', sql.NVarChar(100), data.hardwareUid)
            .input('serialNumber', sql.NVarChar(100), data.serialNumber ?? null)
            .input('firmwareVersion', sql.NVarChar(50), data.firmwareVersion ?? null)
            .input('bluetoothName', sql.NVarChar(100), data.bluetoothName ?? null)
            .query<HubDeviceRow>(`
                INSERT INTO app.hub_devices
                    (device_kit_id, hardware_uid, serial_number, firmware_version, bluetooth_name)
                OUTPUT
                    INSERTED.id, INSERTED.device_kit_id, INSERTED.hardware_uid,
                    INSERTED.serial_number, INSERTED.firmware_version, INSERTED.bluetooth_name,
                    INSERTED.is_active, INSERTED.last_seen_at, INSERTED.created_at, INSERTED.updated_at
                VALUES
                    (@deviceKitId, @hardwareUid, @serialNumber, @firmwareVersion, @bluetoothName)
            `);
        return result.recordset[0];
    }

    /**
     * Find the hub for a given device kit. Returns null if none exists.
     */
    async findHubByKitId(deviceKitId: string): Promise<HubDeviceRow | null> {
        const result = await this.pool
            .request()
            .input('deviceKitId', sql.UniqueIdentifier, deviceKitId)
            .query<HubDeviceRow>(`
                SELECT id, device_kit_id, hardware_uid, serial_number, firmware_version,
                       bluetooth_name, is_active, last_seen_at, created_at, updated_at
                FROM app.hub_devices
                WHERE device_kit_id = @deviceKitId
            `);
        return result.recordset[0] ?? null;
    }

    /**
     * Find a hub by its hardware UID — used to detect duplicate hardware registration.
     */
    async findHubByHardwareUid(hardwareUid: string): Promise<HubDeviceRow | null> {
        const result = await this.pool
            .request()
            .input('hardwareUid', sql.NVarChar(100), hardwareUid)
            .query<HubDeviceRow>(`
                SELECT id, device_kit_id, hardware_uid, serial_number, firmware_version,
                       bluetooth_name, is_active, last_seen_at, created_at, updated_at
                FROM app.hub_devices
                WHERE hardware_uid = @hardwareUid
            `);
        return result.recordset[0] ?? null;
    }

    // ── Pod Devices ───────────────────────────────────────────────────────────

    /**
     * Create a new pod and assign it to a device kit.
     */
    async createPod(data: CreatePodData): Promise<PodDeviceRow> {
        const result = await this.pool
            .request()
            .input('hardwareUid', sql.NVarChar(100), data.hardwareUid)
            .input('serialNumber', sql.NVarChar(100), data.serialNumber ?? null)
            .input('firmwareVersion', sql.NVarChar(50), data.firmwareVersion ?? null)
            .input('currentDeviceKitId', sql.UniqueIdentifier, data.currentDeviceKitId)
            .input('displayName', sql.NVarChar(100), data.displayName ?? null)
            .input('logicalIndex', sql.Int, data.logicalIndex ?? null)
            .query<PodDeviceRow>(`
                INSERT INTO app.pod_devices
                    (hardware_uid, serial_number, firmware_version,
                     current_device_kit_id, display_name, logical_index)
                OUTPUT
                    INSERTED.id, INSERTED.hardware_uid, INSERTED.serial_number,
                    INSERTED.firmware_version, INSERTED.current_device_kit_id,
                    INSERTED.display_name, INSERTED.logical_index,
                    INSERTED.battery_percent, INSERTED.battery_level,
                    INSERTED.is_active, INSERTED.last_seen_at,
                    INSERTED.created_at, INSERTED.updated_at
                VALUES
                    (@hardwareUid, @serialNumber, @firmwareVersion,
                     @currentDeviceKitId, @displayName, @logicalIndex)
            `);
        return result.recordset[0];
    }

    /**
     * Find a pod by its primary key ID.
     */
    async findPodById(id: string): Promise<PodDeviceRow | null> {
        const result = await this.pool
            .request()
            .input('id', sql.UniqueIdentifier, id)
            .query<PodDeviceRow>(`
                SELECT id, hardware_uid, serial_number, firmware_version,
                       current_device_kit_id, display_name, logical_index,
                       battery_percent, battery_level, is_active, last_seen_at,
                       created_at, updated_at
                FROM app.pod_devices
                WHERE id = @id
            `);
        return result.recordset[0] ?? null;
    }

    /**
     * Find a pod by its hardware UID — used to detect whether a pod is already
     * registered before adding it to a kit.
     */
    async findPodByHardwareUid(hardwareUid: string): Promise<PodDeviceRow | null> {
        const result = await this.pool
            .request()
            .input('hardwareUid', sql.NVarChar(100), hardwareUid)
            .query<PodDeviceRow>(`
                SELECT id, hardware_uid, serial_number, firmware_version,
                       current_device_kit_id, display_name, logical_index,
                       battery_percent, battery_level, is_active, last_seen_at,
                       created_at, updated_at
                FROM app.pod_devices
                WHERE hardware_uid = @hardwareUid
            `);
        return result.recordset[0] ?? null;
    }

    /**
     * List all active pods currently assigned to a kit.
     */
    async findPodsByKitId(deviceKitId: string): Promise<PodDeviceRow[]> {
        const result = await this.pool
            .request()
            .input('deviceKitId', sql.UniqueIdentifier, deviceKitId)
            .query<PodDeviceRow>(`
                SELECT id, hardware_uid, serial_number, firmware_version,
                       current_device_kit_id, display_name, logical_index,
                       battery_percent, battery_level, is_active, last_seen_at,
                       created_at, updated_at
                FROM app.pod_devices
                WHERE current_device_kit_id = @deviceKitId
                  AND is_active = 1
                ORDER BY logical_index ASC, created_at ASC
            `);
        return result.recordset;
    }

    /**
     * Update a pod's current_device_kit_id. Used during reassignment.
     */
    async updatePodKitAssignment(podId: string, newDeviceKitId: string): Promise<void> {
        await this.pool
            .request()
            .input('podId', sql.UniqueIdentifier, podId)
            .input('newDeviceKitId', sql.UniqueIdentifier, newDeviceKitId)
            .query(`
                UPDATE app.pod_devices
                SET current_device_kit_id = @newDeviceKitId,
                    updated_at            = SYSUTCDATETIME()
                WHERE id = @podId
            `);
    }

    // ── Pod Pairing History ───────────────────────────────────────────────────

    /**
     * Create a new pairing history row — called when a pod is assigned to a kit.
     */
    async createPairingHistory(
        podDeviceId: string,
        deviceKitId: string,
        pairedByUserId: string | null
    ): Promise<PodPairingHistoryRow> {
        const result = await this.pool
            .request()
            .input('podDeviceId', sql.UniqueIdentifier, podDeviceId)
            .input('deviceKitId', sql.UniqueIdentifier, deviceKitId)
            .input('pairedByUserId', sql.UniqueIdentifier, pairedByUserId)
            .query<PodPairingHistoryRow>(`
                INSERT INTO app.pod_pairing_history (pod_device_id, device_kit_id, paired_by_user_id)
                OUTPUT
                    INSERTED.id, INSERTED.pod_device_id, INSERTED.device_kit_id,
                    INSERTED.paired_by_user_id, INSERTED.paired_at, INSERTED.unpaired_at
                VALUES (@podDeviceId, @deviceKitId, @pairedByUserId)
            `);
        return result.recordset[0];
    }

    /**
     * Close the active pairing history row for a pod in its current kit.
     * Sets unpaired_at = now. Called during pod reassignment.
     */
    async closeActivePairingHistory(
        podDeviceId: string,
        deviceKitId: string
    ): Promise<void> {
        await this.pool
            .request()
            .input('podDeviceId', sql.UniqueIdentifier, podDeviceId)
            .input('deviceKitId', sql.UniqueIdentifier, deviceKitId)
            .query(`
                UPDATE app.pod_pairing_history
                SET unpaired_at = SYSUTCDATETIME()
                WHERE pod_device_id = @podDeviceId
                  AND device_kit_id = @deviceKitId
                  AND unpaired_at   IS NULL
            `);
    }

    /**
     * Find the active pairing history row for a pod (unpaired_at IS NULL).
     */
    async findActivePairingForPod(
        podDeviceId: string
    ): Promise<PodPairingHistoryRow | null> {
        const result = await this.pool
            .request()
            .input('podDeviceId', sql.UniqueIdentifier, podDeviceId)
            .query<PodPairingHistoryRow>(`
                SELECT id, pod_device_id, device_kit_id, paired_by_user_id, paired_at, unpaired_at
                FROM app.pod_pairing_history
                WHERE pod_device_id = @podDeviceId
                  AND unpaired_at   IS NULL
            `);
        return result.recordset[0] ?? null;
    }
}

