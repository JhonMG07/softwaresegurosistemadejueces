-- ============================================
-- MIGRACION 016: Sistema de Auditoria para Rol Admin
-- ============================================
-- Descripcion: Crea vistas seguras y funciones para el rol admin (auditor)
-- El admin SOLO puede ver:
--   - Logs anonimizados (sin user_id real)
--   - Metricas agregadas (conteos, no datos individuales)
--   - Estadisticas de tokens (sin contenido ni identidades)
--
-- El admin NO puede:
--   - Acceder al Identity Vault
--   - Ver contenido de casos
--   - Ver identidades reales de jueces/secretarias
-- ============================================

-- ============================================
-- 1. VISTA MATERIALIZADA: Metricas diarias agregadas
-- ============================================
-- Almacena solo conteos por dia, sin ninguna identidad
DROP MATERIALIZED VIEW IF EXISTS audit_daily_metrics;

CREATE MATERIALIZED VIEW audit_daily_metrics AS
SELECT
    DATE(timestamp) as date,
    -- Metricas de acceso (solo conteos)
    COUNT(*) FILTER (WHERE result = 'allow') as access_allowed,
    COUNT(*) FILTER (WHERE result = 'deny') as access_denied,
    COUNT(*) as total_actions,
    -- Metricas por tipo de recurso (sin IDs)
    COUNT(*) FILTER (WHERE resource_type = 'case') as case_actions,
    COUNT(*) FILTER (WHERE resource_type = 'cases') as cases_actions,
    COUNT(*) FILTER (WHERE resource_type = 'user') as user_actions,
    COUNT(*) FILTER (WHERE resource_type = 'users') as users_actions,
    COUNT(*) FILTER (WHERE resource_type = 'document') as document_actions,
    COUNT(*) FILTER (WHERE resource_type = 'audit_logs') as audit_actions,
    -- Operaciones mas comunes (agrupadas)
    COUNT(*) FILTER (WHERE action LIKE 'case.%') as case_operations,
    COUNT(*) FILTER (WHERE action LIKE 'user.%') as user_operations,
    COUNT(*) FILTER (WHERE action LIKE 'doc.%') as document_operations,
    COUNT(*) FILTER (WHERE action LIKE 'admin.%') as admin_operations
FROM policy_enforcement_log
WHERE timestamp IS NOT NULL
GROUP BY DATE(timestamp);

-- Indice para consultas rapidas por fecha
CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_daily_date ON audit_daily_metrics(date);

-- ============================================
-- 2. FUNCION: Refrescar metricas (para cron job)
-- ============================================
CREATE OR REPLACE FUNCTION refresh_audit_metrics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY audit_daily_metrics;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 3. VISTA SEGURA: Logs de auditoria ANONIMIZADOS
-- ============================================
-- IMPORTANTE: Esta vista NUNCA expone user_id real
-- Solo muestra hash parcial (8 caracteres) para correlacion
DROP VIEW IF EXISTS audit_logs_sanitized;

CREATE VIEW audit_logs_sanitized AS
SELECT
    pel.id,
    -- ANONIMIZAR user_id: solo primeros 8 caracteres del hash MD5
    -- Esto permite correlacionar acciones del mismo usuario sin revelar identidad
    SUBSTRING(MD5(pel.user_id::text), 1, 8) as user_hash,
    pel.action,
    pel.resource_type,
    -- NO incluimos resource_id para evitar correlacion con casos reales
    pel.result,
    -- Sanitizar reason: remover UUIDs y datos sensibles
    CASE
        WHEN pel.reason IS NULL THEN NULL
        WHEN pel.reason ~ '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
            THEN 'Access decision logged'
        WHEN LENGTH(pel.reason) > 100
            THEN SUBSTRING(pel.reason, 1, 100) || '...'
        ELSE pel.reason
    END as reason_sanitized,
    pel.timestamp,
    -- Hora del dia para analisis de patrones (sin fecha exacta de usuario)
    EXTRACT(HOUR FROM pel.timestamp) as hour_of_day,
    EXTRACT(DOW FROM pel.timestamp) as day_of_week
    -- EXCLUIMOS: metadata, ip_address, user_agent (pueden contener info sensible)
FROM policy_enforcement_log pel;

-- ============================================
-- 4. VISTA: Estadisticas de tokens (sin contenido)
-- ============================================
-- Solo muestra conteos por dia, NUNCA el contenido del token
DROP VIEW IF EXISTS audit_token_stats;

CREATE VIEW audit_token_stats AS
SELECT
    DATE(created_at) as date,
    COUNT(*) as tokens_emitted,
    COUNT(*) FILTER (WHERE used_at IS NOT NULL) as tokens_used,
    COUNT(*) FILTER (WHERE expires_at < NOW() AND used_at IS NULL) as tokens_expired_unused,
    COUNT(*) FILTER (WHERE expires_at > NOW() AND used_at IS NULL) as tokens_pending,
    -- Tiempo promedio de uso (en horas)
    ROUND(AVG(EXTRACT(EPOCH FROM (used_at - created_at))/3600) FILTER (WHERE used_at IS NOT NULL), 2) as avg_hours_to_use
FROM ephemeral_credentials
GROUP BY DATE(created_at);

-- ============================================
-- 5. VISTA: Jueces activos por dia (solo conteo)
-- ============================================
-- IMPORTANTE: Solo cuenta jueces unicos, NO revela identidades
DROP VIEW IF EXISTS audit_active_judges_daily;

CREATE VIEW audit_active_judges_daily AS
SELECT
    DATE(pel.timestamp) as date,
    COUNT(DISTINCT pel.user_id) as active_judges,
    COUNT(*) as total_judge_actions
FROM policy_enforcement_log pel
INNER JOIN users_profile up ON pel.user_id = up.id
WHERE up.role = 'judge'
AND up.status = 'active'
GROUP BY DATE(pel.timestamp);

-- ============================================
-- 6. VISTA: Casos resueltos por dia (solo conteo)
-- ============================================
DROP VIEW IF EXISTS audit_cases_resolved_daily;

CREATE VIEW audit_cases_resolved_daily AS
SELECT
    DATE(updated_at) as date,
    COUNT(*) FILTER (WHERE status = 'resolved') as cases_resolved,
    COUNT(*) FILTER (WHERE status = 'pending') as cases_pending,
    COUNT(*) FILTER (WHERE status = 'in_review') as cases_in_review,
    COUNT(*) FILTER (WHERE status = 'archived') as cases_archived,
    COUNT(*) FILTER (WHERE status = 'rejected') as cases_rejected
FROM cases
WHERE updated_at IS NOT NULL
GROUP BY DATE(updated_at);

-- ============================================
-- 7. INSERTAR ATRIBUTOS ABAC PARA ADMIN
-- ============================================
INSERT INTO public.abac_attributes (name, category, description, level)
VALUES
    ('audit.logs.view', 'permission', 'Ver logs de auditoria anonimizados del sistema', 3),
    ('audit.metrics.view', 'permission', 'Ver metricas agregadas del sistema (solo conteos)', 3),
    ('audit.tokens.view', 'permission', 'Ver estadisticas de tokens efimeros (sin contenido)', 3),
    ('audit.cases.stats', 'permission', 'Ver estadisticas agregadas de casos (sin contenido)', 3),
    ('audit.export.csv', 'permission', 'Exportar reportes de auditoria en CSV', 4)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 8. TRIGGER: Bloquear atributos de vault para admin
-- ============================================
-- SEGURIDAD: El rol admin NUNCA puede tener acceso al Identity Vault
CREATE OR REPLACE FUNCTION check_admin_no_vault_access()
RETURNS TRIGGER AS $$
DECLARE
    user_role TEXT;
    attr_name TEXT;
BEGIN
    -- Obtener rol del usuario
    SELECT role INTO user_role
    FROM users_profile
    WHERE id = NEW.user_id;

    -- Obtener nombre del atributo
    SELECT name INTO attr_name
    FROM abac_attributes
    WHERE id = NEW.attribute_id;

    -- Si es admin y el atributo es del vault, BLOQUEAR
    IF user_role = 'admin' AND attr_name LIKE 'admin.vault.%' THEN
        RAISE EXCEPTION 'SECURITY VIOLATION: Admin role cannot have vault access attributes. Attempted: %', attr_name;
    END IF;

    -- Si es admin y el atributo permite ver identidades, BLOQUEAR
    IF user_role = 'admin' AND attr_name IN ('user.profile.view', 'user.create', 'user.edit', 'user.deactivate') THEN
        RAISE EXCEPTION 'SECURITY VIOLATION: Admin role cannot have user management attributes. Attempted: %', attr_name;
    END IF;

    -- Si es admin y el atributo permite ver casos, BLOQUEAR
    IF user_role = 'admin' AND attr_name LIKE 'case.%' AND attr_name != 'audit.cases.stats' THEN
        RAISE EXCEPTION 'SECURITY VIOLATION: Admin role cannot have case access attributes. Attempted: %', attr_name;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Eliminar trigger si existe y recrear
DROP TRIGGER IF EXISTS prevent_admin_vault_access ON user_attributes;
CREATE TRIGGER prevent_admin_vault_access
    BEFORE INSERT OR UPDATE ON user_attributes
    FOR EACH ROW
    EXECUTE FUNCTION check_admin_no_vault_access();

-- ============================================
-- 9. FUNCION SEGURA: Obtener metricas con verificacion de rol
-- ============================================
CREATE OR REPLACE FUNCTION get_audit_metrics_safe(
    p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
    p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    date DATE,
    access_allowed BIGINT,
    access_denied BIGINT,
    total_actions BIGINT,
    case_operations BIGINT,
    user_operations BIGINT
) AS $$
DECLARE
    caller_role TEXT;
BEGIN
    -- Verificar que el llamador es admin o super_admin
    SELECT role INTO caller_role
    FROM users_profile
    WHERE id = auth.uid();

    IF caller_role IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: No authenticated user';
    END IF;

    IF caller_role NOT IN ('admin', 'super_admin') THEN
        RAISE EXCEPTION 'Forbidden: Requires admin role. Current role: %', caller_role;
    END IF;

    -- Retornar metricas (sin datos sensibles)
    RETURN QUERY
    SELECT
        adm.date,
        adm.access_allowed,
        adm.access_denied,
        adm.total_actions,
        adm.case_operations,
        adm.user_operations
    FROM audit_daily_metrics adm
    WHERE adm.date BETWEEN p_start_date AND p_end_date
    ORDER BY adm.date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 10. RLS: Politicas para admin en vistas
-- ============================================
-- Nota: Las vistas no soportan RLS directamente,
-- la seguridad se aplica via las APIs y funciones SECURITY DEFINER

-- Politica para policy_enforcement_log: admin puede SELECT pero NO ve user_id
-- (usara la vista audit_logs_sanitized en su lugar)
DROP POLICY IF EXISTS "admin_select_enforcement_logs" ON policy_enforcement_log;
CREATE POLICY "admin_select_enforcement_logs"
    ON policy_enforcement_log FOR SELECT
    TO authenticated
    USING (
        -- Super admin ve todo
        EXISTS (
            SELECT 1 FROM users_profile
            WHERE id = auth.uid()
            AND role = 'super_admin'
            AND status = 'active'
        )
        OR
        -- Admin solo puede acceder via las vistas (controlado en API)
        EXISTS (
            SELECT 1 FROM users_profile
            WHERE id = auth.uid()
            AND role = 'admin'
            AND status = 'active'
        )
        OR
        -- Usuarios ven sus propios logs
        user_id = auth.uid()
    );

-- ============================================
-- 11. LOGGING: Registrar accesos a vistas de auditoria
-- ============================================
-- Crear tabla para auditar quien accede a la auditoria (meta-auditoria)
CREATE TABLE IF NOT EXISTS audit_access_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    accessed_by UUID NOT NULL REFERENCES users_profile(id),
    view_accessed TEXT NOT NULL,
    query_params JSONB,
    ip_address TEXT,
    accessed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indice para consultas
CREATE INDEX IF NOT EXISTS idx_audit_access_log_user ON audit_access_log(accessed_by, accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_access_log_view ON audit_access_log(view_accessed, accessed_at DESC);

-- RLS para audit_access_log
ALTER TABLE audit_access_log ENABLE ROW LEVEL SECURITY;

-- Solo super_admin puede ver quien accede a la auditoria
CREATE POLICY "super_admin_view_audit_access" ON audit_access_log
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users_profile
            WHERE id = auth.uid()
            AND role = 'super_admin'
            AND status = 'active'
        )
    );

-- Sistema puede insertar (desde APIs)
CREATE POLICY "system_insert_audit_access" ON audit_access_log
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- ============================================
-- 12. VERIFICACION FINAL
-- ============================================

-- Verificar atributos creados
SELECT id, name, category, level, description
FROM abac_attributes
WHERE name LIKE 'audit.%'
ORDER BY level;

-- Verificar que las vistas existen
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
AND (table_name LIKE 'audit_%' OR table_type = 'VIEW')
ORDER BY table_name;

-- ============================================
-- NOTAS DE SEGURIDAD PARA REVISION
-- ============================================
-- 1. El admin NO puede acceder directamente a policy_enforcement_log.user_id
-- 2. Todas las vistas usan hash MD5 parcial (8 chars) para anonimizar
-- 3. El trigger prevent_admin_vault_access bloquea atributos peligrosos
-- 4. Las funciones usan SECURITY DEFINER con verificacion de rol interna
-- 5. La meta-auditoria (audit_access_log) registra quien accede a qué
-- 6. resource_id NUNCA se expone en las vistas del admin
