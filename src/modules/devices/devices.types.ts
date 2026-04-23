// --- DB Row Types ---

export interface DeviceKitRow {
    id: string;
    organization_id: string;
    name: string;
    code: string;
    description: string | null;
    owner_user_id: string | null;
    max_pods: number;
    created_at: Date;
    updated_at: Date;
    deleted_at: Date | null;
}

export interface HubDeviceRow {
    id: string;
    device_kit_id: string;
    hardware_uid: string;
    serial_number: string | null;
    firmware_version: string | null;
    bluetooth_name: string | null;
    is_active: boolean;
    last_seen_at: Date | null;
    created_at: Date;
    updated_at: Date;
}

export interface PodDeviceRow {
    id: string;
    hardware_uid: string;
    serial_number: string | null;
    firmware_version: string | null;
    current_device_kit_id: string | null;
    display_name: string | null;
    logical_index: number | null;
    battery_percent: number | null;
    battery_level: string | null;
    is_active: boolean;
    last_seen_at: Date | null;
    created_at: Date;
    updated_at: Date;
}

export interface PodPairingHistoryRow {
    id: string;
    pod_device_id: string;
    device_kit_id: string;
    paired_by_user_id: string | null;
    paired_at: Date;
    unpaired_at: Date | null;
}

export interface DeviceKitUserAccessRow {
    id: string;
    device_kit_id: string;
    user_id: string;
    can_operate: boolean;
    can_manage: boolean;
    granted_by_user_id: string | null;
    created_at: Date;
}

// ─── Request Inputs ───────────────────────────────────────────────────────────

export interface CreateDeviceKitInput {
    organizationId: string;
    name: string;
    code: string;
    description?: string;
    maxPods?: number;
}

export interface GrantKitAccessInput {
    userId: string;
    canOperate: boolean;
    canManage: boolean;
}

export interface RegisterHubInput {
    hardwareUid: string;
    serialNumber?: string;
    firmwareVersion?: string;
    bluetoothName?: string;
}

export interface RegisterPodInput {
    hardwareUid: string;
    serialNumber?: string;
    firmwareVersion?: string;
    displayName?: string;
    logicalIndex?: number;
}

export interface RegisterPodsInput {
    pods: RegisterPodInput[];
}

export interface ReassignPodInput {
    targetDeviceKitId: string;
}

// ─── Response Shapes ──────────────────────────────────────────────────────────

export interface DeviceKitSummary {
    id: string;
    organizationId: string;
    name: string;
    code: string;
    description: string | null;
    ownerUserId: string | null;
    maxPods: number;
    createdAt: Date;
}

export interface HubSummary {
    id: string;
    hardwareUid: string;
    serialNumber: string | null;
    firmwareVersion: string | null;
    bluetoothName: string | null;
    isActive: boolean;
    lastSeenAt: Date | null;
}

export interface PodSummary {
    id: string;
    hardwareUid: string;
    serialNumber: string | null;
    firmwareVersion: string | null;
    currentDeviceKitId: string | null;
    displayName: string | null;
    logicalIndex: number | null;
    batteryPercent: number | null;
    batteryLevel: string | null;
    isActive: boolean;
    lastSeenAt: Date | null;
}

export interface KitAccessGrant {
    id: string;
    deviceKitId: string;
    userId: string;
    canOperate: boolean;
    canManage: boolean;
    grantedByUserId: string | null;
    createdAt: Date;
}

export interface DeviceKitDetail extends DeviceKitSummary {
    hub: HubSummary | null;
    podCount: number;
}


