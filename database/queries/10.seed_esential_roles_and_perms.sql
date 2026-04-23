USE [Reflexa];
GO

INSERT INTO app.roles (code, name, description)
SELECT 'SUPER_ADMIN', 'Super Admin', 'Global platform administrator'
WHERE NOT EXISTS (SELECT 1 FROM app.roles WHERE code = 'SUPER_ADMIN');

INSERT INTO app.roles (code, name, description)
SELECT 'ORG_ADMIN', 'Organization Admin', 'Organization administrator'
WHERE NOT EXISTS (SELECT 1 FROM app.roles WHERE code = 'ORG_ADMIN');

INSERT INTO app.roles (code, name, description)
SELECT 'TRAINER', 'Trainer', 'Trainer / coach role'
WHERE NOT EXISTS (SELECT 1 FROM app.roles WHERE code = 'TRAINER');

INSERT INTO app.roles (code, name, description)
SELECT 'ATHLETE', 'Athlete', 'Regular athlete/user'
WHERE NOT EXISTS (SELECT 1 FROM app.roles WHERE code = 'ATHLETE');

INSERT INTO app.roles (code, name, description)
SELECT 'VIEWER', 'Viewer', 'Restricted read-only viewer'
WHERE NOT EXISTS (SELECT 1 FROM app.roles WHERE code = 'VIEWER');
GO

INSERT INTO app.permissions (code, name, description)
SELECT 'session.start', 'Start Session', 'Can start sessions'
WHERE NOT EXISTS (SELECT 1 FROM app.permissions WHERE code = 'session.start');

INSERT INTO app.permissions (code, name, description)
SELECT 'session.end', 'End Session', 'Can end sessions'
WHERE NOT EXISTS (SELECT 1 FROM app.permissions WHERE code = 'session.end');

INSERT INTO app.permissions (code, name, description)
SELECT 'session.delete', 'Delete Session', 'Can delete synced sessions'
WHERE NOT EXISTS (SELECT 1 FROM app.permissions WHERE code = 'session.delete');

INSERT INTO app.permissions (code, name, description)
SELECT 'session.assign', 'Assign Session', 'Can assign sessions to users or teams'
WHERE NOT EXISTS (SELECT 1 FROM app.permissions WHERE code = 'session.assign');

INSERT INTO app.permissions (code, name, description)
SELECT 'users.manage', 'Manage Users', 'Can manage organization users'
WHERE NOT EXISTS (SELECT 1 FROM app.permissions WHERE code = 'users.manage');

INSERT INTO app.permissions (code, name, description)
SELECT 'teams.manage', 'Manage Teams', 'Can manage teams'
WHERE NOT EXISTS (SELECT 1 FROM app.permissions WHERE code = 'teams.manage');

INSERT INTO app.permissions (code, name, description)
SELECT 'devices.manage', 'Manage Devices', 'Can manage kits, hub, and pods'
WHERE NOT EXISTS (SELECT 1 FROM app.permissions WHERE code = 'devices.manage');

INSERT INTO app.permissions (code, name, description)
SELECT 'presets.manage', 'Manage Presets', 'Can manage organization presets'
WHERE NOT EXISTS (SELECT 1 FROM app.permissions WHERE code = 'presets.manage');

INSERT INTO app.permissions (code, name, description)
SELECT 'viewer.scope.manage', 'Manage Viewer Scopes', 'Can assign viewer access scopes'
WHERE NOT EXISTS (SELECT 1 FROM app.permissions WHERE code = 'viewer.scope.manage');
GO
