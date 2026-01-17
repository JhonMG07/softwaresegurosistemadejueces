/**
 * ABAC Helper Types
 */

export type ClearanceLevel = 1 | 2 | 3 | 4;

export type Classification = 'public' | 'confidential' | 'secret' | 'top_secret';

export interface ABACAttribute {
    id: string;
    name: string;
    category: 'permission' | 'authorization' | 'restriction';
    level: number;
    description: string;
}

export interface UserAttributeAssignment {
    id: string;
    user_id: string;
    attribute_id: string;
    granted_by: string;
    granted_at: string;
    expires_at: string | null;
    reason: string | null;
}

/**
 * Mapeo de clasificaciones a niveles de clearance requeridos
 */
export const CLASSIFICATION_LEVELS: Record<Classification, ClearanceLevel> = {
    'public': 1,
    'confidential': 2,
    'secret': 3,
    'top_secret': 4
};

/**
 * Nombres de atributos comunes (para evitar typos)
 */
export const ATTRIBUTES = {
    // Casos
    CASE_LIST_VIEW: 'case.list.view',
    CASE_DETAILS_VIEW: 'case.details.view',
    CASE_ASSIGNED_ONLY: 'case.assigned_only',
    CASE_CREATE: 'case.create',
    CASE_EDIT_METADATA: 'case.edit.metadata',
    CASE_EDIT_STATUS: 'case.edit.status',
    CASE_ASSIGN_JUDGE: 'case.assign.judge',
    CASE_CLOSE: 'case.close',
    CASE_DELETE: 'case.delete',

    // Documentos
    DOC_VIEW: 'doc.view',
    DOC_UPLOAD: 'doc.upload',
    DOC_DOWNLOAD: 'doc.download',
    DOC_SIGN: 'doc.sign.digital',
    DOC_DELETE: 'doc.delete',

    // Usuarios
    USER_LIST_VIEW: 'user.list.view',
    USER_PROFILE_VIEW: 'user.profile.view',
    USER_CREATE: 'user.create',
    USER_EDIT: 'user.edit',
    USER_DEACTIVATE: 'user.deactivate',

    // Clearance
    CLEARANCE_L1: 'clearance.L1.public',
    CLEARANCE_L2: 'clearance.L2.confidential',
    CLEARANCE_L3: 'clearance.L3.secret',
    CLEARANCE_L4: 'clearance.L4.top_secret',

    // Restricciones
    RESTRICT_READ_ONLY: 'restrict.read_only',
    RESTRICT_NO_EXPORT: 'restrict.no_export',
    RESTRICT_NO_DELETE: 'restrict.no_delete',

    // Admin (Super Admin)
    ADMIN_ABAC_MANAGE: 'admin.abac.manage',
    ADMIN_VAULT_REVEAL: 'admin.vault.reveal_identity',
    ADMIN_AUDIT_VIEW: 'admin.audit.view',

    // Auditoría (Rol Admin/Auditor)
    // Estos atributos son específicos para el rol "admin" (auditor)
    // que solo puede ver datos anonimizados y métricas agregadas
    AUDIT_LOGS_VIEW: 'audit.logs.view',
    AUDIT_METRICS_VIEW: 'audit.metrics.view',
    AUDIT_TOKENS_VIEW: 'audit.tokens.view',
    AUDIT_CASES_STATS: 'audit.cases.stats',
    AUDIT_EXPORT_CSV: 'audit.export.csv',
} as const;

/**
 * Acciones disponibles en el sistema
 */
export const ACTIONS = {
    // Casos
    CASE_CREATE: 'case.create',
    CASE_VIEW: 'case.view',
    CASE_VIEW_DETAILS: 'case.view_details',
    CASE_EDIT: 'case.edit',
    CASE_UPDATE_STATUS: 'case.update_status',
    CASE_ASSIGN: 'case.assign',
    CASE_CLOSE: 'case.close',
    CASE_DELETE: 'case.delete',

    // Documentos
    DOC_VIEW: 'doc.view',
    DOC_UPLOAD: 'doc.upload',
    DOC_DOWNLOAD: 'doc.download',
    DOC_SIGN: 'doc.sign',
    DOC_DELETE: 'doc.delete',

    // Usuarios
    USER_LIST: 'user.list',
    USER_VIEW: 'user.view',
    USER_CREATE: 'user.create',
    USER_EDIT: 'user.edit',
    USER_DEACTIVATE: 'user.deactivate',

    // Admin (Super Admin)
    ADMIN_REVEAL_IDENTITY: 'admin.reveal_identity',
    ADMIN_ABAC: 'admin.abac',
    ADMIN_AUDIT: 'admin.audit',

    // Auditoría (Rol Admin/Auditor)
    AUDIT_VIEW_LOGS: 'audit.view_logs',
    AUDIT_VIEW_METRICS: 'audit.view_metrics',
    AUDIT_VIEW_TOKENS: 'audit.view_tokens',
    AUDIT_VIEW_CASE_STATS: 'audit.view_case_stats',
    AUDIT_EXPORT: 'audit.export',
} as const;
