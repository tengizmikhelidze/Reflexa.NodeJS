import {
    DeviceKitRow,
    HubDeviceRow,
    PodDeviceRow,
    DeviceKitUserAccessRow,
    DeviceKitSummary,
    DeviceKitDetail,
    HubSummary,
    PodSummary,
    KitAccessGrant,
} from './devices.types.js';

export function mapDeviceKitSummary(row: DeviceKitRow): DeviceKitSummary {
    return {
        id:            row.id,
        organizationId: row.organization_id,
        name:          row.name,
        code:          row.code,
        description:   row.description,
        ownerUserId:   row.owner_user_id,
        maxPods:       row.max_pods,
        createdAt:     row.created_at,
    };
}

export function mapDeviceKitDetail(
    row: DeviceKitRow,
    hub: HubDeviceRow | null,
    podCount: number
): DeviceKitDetail {
    return {
        ...mapDeviceKitSummary(row),
        hub: hub ? mapHubSummary(hub) : null,
        podCount,
    };
}

export function mapHubSummary(row: HubDeviceRow): HubSummary {
    return {
        id:              row.id,
        hardwareUid:     row.hardware_uid,
        serialNumber:    row.serial_number,
        firmwareVersion: row.firmware_version,
        bluetoothName:   row.bluetooth_name,
        isActive:        row.is_active,
        lastSeenAt:      row.last_seen_at,
    };
}

export function mapPodSummary(row: PodDeviceRow): PodSummary {
    return {
        id:                  row.id,
        hardwareUid:         row.hardware_uid,
        serialNumber:        row.serial_number,
        firmwareVersion:     row.firmware_version,
        currentDeviceKitId:  row.current_device_kit_id,
        displayName:         row.display_name,
        logicalIndex:        row.logical_index,
        batteryPercent:      row.battery_percent,
        batteryLevel:        row.battery_level,
        isActive:            row.is_active,
        lastSeenAt:          row.last_seen_at,
    };
}

export function mapKitAccessGrant(row: DeviceKitUserAccessRow): KitAccessGrant {
    return {
        id:              row.id,
        deviceKitId:     row.device_kit_id,
        userId:          row.user_id,
        canOperate:      row.can_operate,
        canManage:       row.can_manage,
        grantedByUserId: row.granted_by_user_id,
        createdAt:       row.created_at,
    };
}

