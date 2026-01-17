import { createClient } from '@/lib/supabase/server';

/**
 * Contexto de evaluación para verificar permisos
 */
export interface EvaluationContext {
    userId: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    metadata?: Record<string, any>;
}

/**
 * Resultado de la evaluación de permisos
 */
export interface EvaluationResult {
    allowed: boolean;
    reason: string;
    policy?: string;
    attributesChecked?: string[];
}

/**
 * Atributo ABAC del usuario
 */
interface UserAttribute {
    id: string;
    name: string;
    category: string;
    level: number;
    description: string | null;
}

/**
 * Motor de evaluación ABAC (Attribute-Based Access Control)
 * 
 * Este servicio evalúa permisos basado en:
 * 1. Atributos asignados al usuario
 * 2. Políticas de seguridad activas
 * 3. Contexto de la acción (recurso, metadata)
 */
export class ABACEvaluator {
    /**
     * Punto de entrada principal para verificar permisos
     * 
     * @example
     * const evaluator = new ABACEvaluator();
     * const result = await evaluator.checkPermission({
     *   userId: 'uuid',
     *   action: 'case.create',
     *   resourceType: 'case'
     * });
     * if (!result.allowed) {
     *   throw new Error(result.reason);
     * }
     */
    async checkPermission(context: EvaluationContext): Promise<EvaluationResult> {
        const { userId, action, resourceType, resourceId } = context;

        try {
            const supabase = await createClient();

            // 1. Obtener atributos activos del usuario
            const userAttributes = await this.getUserAttributes(userId, supabase);

            // 2. Verificar si tiene el atributo específico para la acción
            const requiredAttribute = this.mapActionToAttribute(action);

            if (requiredAttribute) {
                const hasRequired = userAttributes.some(
                    (attr: UserAttribute) => attr.name === requiredAttribute
                );

                if (!hasRequired) {
                    await this.logDecision(context, false, `Missing required attribute: ${requiredAttribute}`, supabase);
                    return {
                        allowed: false,
                        reason: `Permiso denegado: requiere atributo "${requiredAttribute}"`,
                        attributesChecked: [requiredAttribute]
                    };
                }
            }

            // 3. Verificar restricciones (si tiene restricciones, denegar)
            const restrictions = userAttributes.filter(
                attr => attr.category === 'restriction'
            );

            for (const restriction of restrictions) {
                if (this.restrictionAppliesToAction(restriction.name, action)) {
                    await this.logDecision(
                        context,
                        false,
                        `Blocked by restriction: ${restriction.name}`,
                        supabase
                    );
                    return {
                        allowed: false,
                        reason: `Acción bloqueada por restricción: ${restriction.description}`,
                        policy: 'Restriction Policy'
                    };
                }
            }

            // 4. Verificar clearance level si es un caso clasificado
            if (resourceType === 'case' && context.metadata?.classification) {
                const hasProperClearance = await this.checkClearanceLevel(
                    userId,
                    context.metadata.classification,
                    supabase
                );

                if (!hasProperClearance) {
                    await this.logDecision(
                        context,
                        false,
                        `Insufficient clearance for classification: ${context.metadata.classification}`,
                        supabase
                    );
                    return {
                        allowed: false,
                        reason: 'Nivel de seguridad insuficiente para este caso',
                        policy: 'Classification Control'
                    };
                }
            }

            // 5. Si pasó todas las verificaciones, permitir
            await this.logDecision(context, true, 'All checks passed', supabase);

            return {
                allowed: true,
                reason: 'Acceso permitido',
                attributesChecked: userAttributes.map(a => a.name)
            };

        } catch (error) {
            console.error('[ABAC] Error evaluating permission:', error);
            // En caso de error, denegar por seguridad
            return {
                allowed: false,
                reason: 'Error del sistema - acceso denegado por seguridad'
            };
        }
    }

    /**
     * Obtener atributos activos del usuario (no expirados)
     */
    private async getUserAttributes(userId: string, supabase: any): Promise<UserAttribute[]> {
        const { data, error } = await supabase
            .from('user_attributes')
            .select(`
        attribute_id,
        expires_at,
        abac_attributes (
          id,
          name,
          category,
          level,
          description
        )
      `)
            .eq('user_id', userId)
            .or('expires_at.is.null,expires_at.gt.now()');  // Solo atributos activos

        if (error) {
            console.error('[ABAC] Error fetching user attributes:', error);
            throw error;
        }

        // Aplanar la estructura anidada
        return (data
            ?.map((ua: { abac_attributes: UserAttribute }) => ua.abac_attributes)
            .filter(Boolean) || []) as UserAttribute[];
    }

    /**
     * Mapear acción a atributo requerido
     */
    private mapActionToAttribute(action: string): string | null {
        const mapping: Record<string, string> = {
            // Casos
            'case.create': 'case.create',
            'case.view': 'case.list.view',
            'case.view_details': 'case.details.view',
            'case.edit': 'case.edit.metadata',
            'case.update_status': 'case.edit.status',
            'case.assign': 'case.assign.judge',
            'case.close': 'case.close',
            'case.delete': 'case.delete',

            // Documentos
            'doc.view': 'doc.view',
            'doc.upload': 'doc.upload',
            'doc.download': 'doc.download',
            'doc.sign': 'doc.sign.digital',
            'doc.delete': 'doc.delete',

            // Usuarios
            'user.list': 'user.list.view',
            'user.view': 'user.profile.view',
            'user.create': 'user.create',
            'user.edit': 'user.edit',
            'user.deactivate': 'user.deactivate',

            // Admin
            'admin.reveal_identity': 'admin.vault.reveal_identity',
            'admin.abac': 'admin.abac.manage',
            'admin.audit': 'admin.audit.view',
        };

        return mapping[action] || null;
    }

    /**
     * Verificar si una restricción aplica a la acción
     */
    private restrictionAppliesToAction(restriction: string, action: string): boolean {
        const rules: Record<string, string[]> = {
            'restrict.no_export': ['doc.download', 'doc.export'],
            'restrict.no_delete': ['case.delete', 'doc.delete', 'user.deactivate'],
            'restrict.read_only': ['case.edit', 'case.create', 'doc.upload', 'doc.delete'],
        };

        const blockedActions = rules[restriction] || [];
        return blockedActions.some(blocked => action.startsWith(blocked));
    }

    /**
     * Verificar clearance level para casos clasificados
     */
    private async checkClearanceLevel(
        userId: string,
        classification: string,
        supabase: any
    ): Promise<boolean> {
        const requiredLevels: Record<string, number> = {
            'public': 1,
            'confidential': 2,
            'secret': 3,
            'top_secret': 4
        };

        const requiredLevel = requiredLevels[classification] || 1;

        // Obtener el nivel más alto de clearance del usuario
        const { data } = await supabase
            .from('user_attributes')
            .select(`
        abac_attributes!inner(name, level)
      `)
            .eq('user_id', userId)
            .like('abac_attributes.name', 'clearance.%')
            .or('expires_at.is.null,expires_at.gt.now()');

        if (!data || data.length === 0) {
            return classification === 'public';  // Sin clearance solo puede ver públicos
        }

        // Obtener el máximo nivel
        const maxLevel = Math.max(
            ...data.map((item: { abac_attributes: { name: string } }) => {
                const name = item.abac_attributes.name;
                if (name.includes('L1')) return 1;
                if (name.includes('L2')) return 2;
                if (name.includes('L3')) return 3;
                if (name.includes('L4')) return 4;
                return 0;
            })
        );

        return maxLevel >= requiredLevel;
    }

    /**
     * Registrar decisión de acceso en audit log
     */
    private async logDecision(
        context: EvaluationContext,
        allowed: boolean,
        reason: string,
        supabase: any,
        policyId?: string
    ): Promise<void> {
        try {
            await supabase
                .from('policy_enforcement_log')
                .insert({
                    user_id: context.userId,
                    policy_id: policyId,
                    action: context.action,
                    resource_type: context.resourceType,
                    resource_id: context.resourceId,
                    result: allowed ? 'allow' : 'deny',
                    reason,
                    metadata: context.metadata,
                    // ip_address y user_agent se pueden obtener del request en producción
                });
        } catch (error) {
            // No fallar si el logging falla
            console.error('[ABAC] Error logging decision:', error);
        }
    }

    /**
     * Helper: Verificar si usuario tiene atributo específico
     */
    async hasAttribute(userId: string, attributeName: string): Promise<boolean> {
        try {
            const supabase = await createClient();

            const { data } = await supabase
                .from('user_attributes')
                .select(`
          abac_attributes!inner(name)
        `)
                .eq('user_id', userId)
                .eq('abac_attributes.name', attributeName)
                .or('expires_at.is.null,expires_at.gt.now()')
                .maybeSingle();

            return !!data;
        } catch (error) {
            console.error('[ABAC] Error checking attribute:', error);
            return false;
        }
    }

    /**
     * Helper: Verificar si usuario tiene nivel de clearance mínimo
     */
    async hasClearance(userId: string, minLevel: number): Promise<boolean> {
        try {
            const supabase = await createClient();
            const userAttributes = await this.getUserAttributes(userId, supabase);

            const clearances = userAttributes.filter(
                attr => attr.name.startsWith('clearance.')
            );

            const maxLevel = Math.max(
                ...clearances.map(attr => {
                    if (attr.name.includes('L4')) return 4;
                    if (attr.name.includes('L3')) return 3;
                    if (attr.name.includes('L2')) return 2;
                    if (attr.name.includes('L1')) return 1;
                    return 0;
                }),
                0
            );

            return maxLevel >= minLevel;
        } catch (error) {
            console.error('[ABAC] Error checking clearance:', error);
            return false;
        }
    }
}

/**
 * Helper function para uso rápido en API routes
 */
export async function enforcePermission(
    userId: string,
    action: string,
    resourceType: string,
    options?: {
        resourceId?: string;
        metadata?: Record<string, any>;
    }
): Promise<void> {
    const evaluator = new ABACEvaluator();

    const result = await evaluator.checkPermission({
        userId,
        action,
        resourceType,
        resourceId: options?.resourceId,
        metadata: options?.metadata
    });

    if (!result.allowed) {
        throw new Error(result.reason);
    }
}
