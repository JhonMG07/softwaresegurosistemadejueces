import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

/**
 * Página raíz que redirige según el rol del usuario
 */
export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Si no está autenticado, redirigir a login
  if (!user) {
    redirect('/auth/login');
  }

  // Obtener perfil del usuario
  const { data: profile } = await supabase
    .from('users_profile')
    .select('role')
    .eq('id', user.id)
    .single();

  // Redirigir según el rol
  if (profile?.role === 'super_admin') {
    redirect('/supreme-court');
  } else if (profile?.role === 'admin') {
    // Rol admin (auditor) → Panel de auditoría
    redirect('/admin');
  } else if (profile?.role === 'judge') {
    redirect('/judge/cases');
  } else if (profile?.role === 'secretary') {
    redirect('/dashboard/secretary');
  }

  // Rol desconocido, redirigir a login
  redirect('/auth/login');
}
