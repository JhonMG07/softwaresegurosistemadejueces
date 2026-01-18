import { createClient } from "@/lib/supabase/server";
import { IdentityVaultService } from "@/lib/vault/identity-service";
import { EphemeralCredentialsService } from "@/lib/services/ephemeral-credentials";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { TokenForm } from "./token-form";
import { CaseView } from "./case-view";
import { ClientNavbar } from "@/components/client-navbar";
import { Suspense } from "react";

// Forzar rendering dinámico para evitar errores de pre-rendering
export const dynamic = 'force-dynamic';

export default async function JudgeCasePage(props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const caseId = params.id;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/auth/login');
    }

    // 1. Verificar si el usuario tiene asignado este caso (Vault Check)
    const { hasAccess } = await IdentityVaultService.verifyAccess(user.id, caseId);

    if (!hasAccess) {
        // Si no está en el vault, 404 para no revelar existencia
        notFound();
    }

    // 2. Obtener datos básicos del caso (título, numero) para el form
    // Ojo: SOLO metadatos públicos si aún no hay token
    const { data: caseMetadata } = await supabase
        .from('cases')
        .select('id, case_number, title, description, classification, priority, case_type, status, file_url')
        .eq('id', caseId)
        .single();

    if (!caseMetadata) {
        notFound();
    }

    // Si ya está dictaminado, mostrar modo lectura sin token (o restringir)
    if (['dictaminado', 'cerrado'].includes(caseMetadata.status)) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
                <Suspense fallback={<div className="h-16 bg-white dark:bg-slate-900 border-b" />}>
                    <ClientNavbar displayName="Juez" />
                </Suspense>
                <div className="container mx-auto p-8 text-center pt-20">
                    <h1 className="text-2xl font-bold mb-4 text-slate-800 dark:text-slate-200">Caso Cerrado</h1>
                    <p className="text-muted-foreground">Este caso ya ha sido dictaminado y cerrado.</p>
                </div>
            </div>
        );
    }

    // 3. Verificar COOKIE de sesión para este caso
    const cookieStore = await cookies();
    const accessCookie = cookieStore.get(`case_access_${caseId}`);

    // Estado: ¿Tiene acceso desbloqueado?
    let isUnlocked = false;

    if (accessCookie?.value) {
        // Validar que el token en la cookie siga siendo válido en BD
        // (Por si fue revocado o usado en otra pestaña)
        const tokenInfo = await EphemeralCredentialsService.validateToken(accessCookie.value);
        if (tokenInfo && tokenInfo.caseId === caseId) {
            isUnlocked = true;
        }
    }

    // 4. Renderizar Vista Condicional
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            <Suspense fallback={<div className="h-16 bg-white dark:bg-slate-900 border-b" />}>
                <ClientNavbar displayName="Juez" />
            </Suspense>
            <div className="py-8">
                {!isUnlocked ? (
                    <TokenForm caseId={caseId} caseNumber={caseMetadata.case_number} />
                ) : (
                    <CaseView caseData={caseMetadata} />
                )}
            </div>
        </div>
    );
}
