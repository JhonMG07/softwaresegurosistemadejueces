import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { enforcePermission } from '@/lib/abac/evaluator';
import { IdentityVaultService } from '@/lib/vault/identity-service';

// GET /api/admin/cases/[id] - Obtener detalles de un caso
export async function GET(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    const caseId = params.id;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // 1. ABAC: Verificar permiso
        await enforcePermission(user.id, 'case.details.view', 'cases', { resourceId: caseId });

        // 2. Obtener caso (RLS aplicará verificación de clearance)
        const { data: caseItem, error: caseError } = await supabaseAdmin
            .from('cases')
            .select('*')
            .eq('id', caseId)
            .single();

        if (caseError || !caseItem) {
            return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 });
        }

        // 3. Obtener asignación si existe
        const { data: assignment } = await supabaseAdmin
            .from('case_assignments')
            .select('anon_actor_id')
            .eq('case_id', caseId)
            .single();

        let assignedJudge = null;
        let assignedJudgeId = null;

        if (assignment?.anon_actor_id) {
            const identityResult = await IdentityVaultService.resolveIdentity(assignment.anon_actor_id, user.id);
            if (identityResult) {
                assignedJudgeId = identityResult.userId;
                const { data: judgeProfile } = await supabaseAdmin
                    .from('users_profile')
                    .select('id, real_name, email, role')
                    .eq('id', assignedJudgeId)
                    .single();

                if (judgeProfile) {
                    assignedJudge = {
                        id: judgeProfile.id,
                        fullName: judgeProfile.real_name,
                        email: judgeProfile.email,
                        role: judgeProfile.role
                    };
                }
            }
        }

        return NextResponse.json({
            case: {
                ...caseItem,
                assignedJudgeId,
                assignedJudge
            }
        });

    } catch (error: any) {
        if (error.message?.includes('Permiso denegado')) {
            return NextResponse.json({ error: error.message }, { status: 403 });
        }
        console.error('[GET /api/admin/cases/[id]] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH /api/admin/cases/[id] - Actualizar caso
export async function PATCH(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    const caseId = params.id;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // 1. ABAC: Verificar permiso
        await enforcePermission(user.id, 'case.edit.metadata', 'cases', { resourceId: caseId });

        // 2. Parsear datos
        const body = await request.json();
        const { title, description, priority, status, classification, deadline } = body;

        const updateData: any = {};
        if (title) updateData.title = title;
        if (description) updateData.description = description;
        if (priority) updateData.priority = priority;
        if (status) updateData.status = status;
        if (classification) updateData.classification = classification;
        if (deadline !== undefined) updateData.deadline = deadline;

        updateData.updated_at = new Date().toISOString();

        // 3. Actualizar
        const { error: updateError } = await supabaseAdmin
            .from('cases')
            .update(updateData)
            .eq('id', caseId);

        if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        if (error.message?.includes('Permiso denegado')) {
            return NextResponse.json({ error: error.message }, { status: 403 });
        }
        console.error('[PATCH /api/admin/cases/[id]] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
