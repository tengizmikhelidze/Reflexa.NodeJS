USE [Reflexa];
GO

CREATE INDEX IX_users_normalized_email ON app.users(normalized_email);
CREATE INDEX IX_external_identities_user_id ON app.external_identities(user_id);

CREATE INDEX IX_organization_memberships_user_id ON app.organization_memberships(user_id);
CREATE INDEX IX_organization_memberships_org_id ON app.organization_memberships(organization_id);

CREATE INDEX IX_teams_organization_id ON app.teams(organization_id);
CREATE INDEX IX_team_memberships_user_id ON app.team_memberships(user_id);

CREATE INDEX IX_device_kits_organization_id ON app.device_kits(organization_id);
CREATE INDEX IX_hub_devices_device_kit_id ON app.hub_devices(device_kit_id);
CREATE INDEX IX_pod_devices_current_device_kit_id ON app.pod_devices(current_device_kit_id);
CREATE INDEX IX_pod_pairing_history_pod_device_id ON app.pod_pairing_history(pod_device_id);
CREATE INDEX IX_pod_pairing_history_device_kit_id ON app.pod_pairing_history(device_kit_id);

CREATE INDEX IX_training_presets_org_id ON app.training_presets(organization_id);
CREATE INDEX IX_training_presets_created_by_user_id ON app.training_presets(created_by_user_id);

CREATE INDEX IX_training_sessions_org_id ON app.training_sessions(organization_id);
CREATE INDEX IX_training_sessions_device_kit_id ON app.training_sessions(device_kit_id);
CREATE INDEX IX_training_sessions_started_by_user_id ON app.training_sessions(started_by_user_id);
CREATE INDEX IX_training_sessions_assigned_to_user_id ON app.training_sessions(assigned_to_user_id);
CREATE INDEX IX_training_sessions_team_id ON app.training_sessions(team_id);
CREATE INDEX IX_training_sessions_session_started_at ON app.training_sessions(session_started_at);
CREATE INDEX IX_training_sessions_status ON app.training_sessions(status);

CREATE INDEX IX_training_session_events_session_id ON app.training_session_events(training_session_id);
CREATE INDEX IX_training_session_events_pod_device_id ON app.training_session_events(pod_device_id);
CREATE INDEX IX_training_session_events_event_timestamp ON app.training_session_events(event_timestamp);

CREATE INDEX IX_sync_batches_user_id ON app.sync_batches(user_id);
CREATE INDEX IX_audit_logs_actor_user_id ON app.audit_logs(actor_user_id);
CREATE INDEX IX_audit_logs_organization_id ON app.audit_logs(organization_id);
GO