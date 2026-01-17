'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function addDocumentAction(caseId: string, formData: FormData) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new Error('No autenticado');
    }

    // Verificar rol de secretario
    const { data: profile } = await supabase
        .from('users_profile')
        .select('role')
        .eq('id', user.id)
        .single();

    if (profile?.role !== 'secretary') {
        throw new Error('No autorizado');
    }

    const file = formData.get('file') as File;

    if (!file) {
        throw new Error('Archivo requerido');
    }

    // Subir archivo
    const fileExt = file.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `cases/${fileName}`;

    const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

    if (uploadError) {
        throw new Error(`Error subiendo archivo: ${uploadError.message}`);
    }

    const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

    // Actualizar caso
    const { error: updateError } = await supabase
        .from('cases')
        .update({
            file_url: urlData.publicUrl
        })
        .eq('id', caseId);

    if (updateError) {
        throw new Error(`Error actualizando caso: ${updateError.message}`);
    }

    revalidatePath('/dashboard/secretary');
}
