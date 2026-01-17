import { createClient } from '@/lib/supabase/server';
import { AppNavbar } from '@/components/app-navbar';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge'; // Assuming Badge exists
import { redirect } from 'next/navigation';

// Force dynamic rendering to ensure fresh data
// export const dynamic = 'force-dynamic'; // Removed due to conflict with nextConfig.cacheComponents
// export const revalidate = 0; // Removed due to conflict with nextConfig.cacheComponents

import { AssignJudgeButton } from '@/components/secretary/assign-judge-button';
import { AddDocumentButton } from '@/components/secretary/add-document-button';

import { PaginationControls } from '@/components/ui/pagination-controls';

export default async function SecretaryDashboard(props: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const searchParams = await props.searchParams;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/auth/login');
    }

    // Verificar rol
    const { data: profile } = await supabase
        .from('users_profile')
        .select('role')
        .eq('id', user.id)
        .single();

    if (profile?.role !== 'secretary') {
        // Si no es secretario, redirigir a home para que el router decida
        redirect('/');
    }

    // Paginación
    const page = Number(searchParams['page']) || 1;
    const limit = 10;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Obtener casos creados por este secretario (Count)
    const { count } = await supabase
        .from('cases')
        .select('*', { count: 'exact', head: true })
        .in('status', ['pending', 'assigned', 'in_progress', 'resolved', 'closed']);

    // Obtener casos paginados
    const { data: cases } = await supabase
        .from('cases')
        .select(`
      id,
      title,
      status,
      created_at,
      created_at,
      file_url,
      case_assignments (
        anon_actor_id,
        role
      )
    `)
        .in('status', ['pending', 'assigned', 'in_progress', 'resolved', 'closed'])
        .order('created_at', { ascending: false })
        .range(from, to);


    return (
        <>
            <AppNavbar />
            <div className="min-h-[calc(100vh-88px)] bg-background p-8">
                <div className="max-w-6xl mx-auto space-y-8">

                    <div className="flex justify-between items-center sticky top-[88px] z-10 bg-background/95 backdrop-blur py-4 border-b">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">Panel de Secretaría</h1>
                            <p className="text-muted-foreground mt-2">
                                Gestión y radicación de casos judiciales
                            </p>
                        </div>
                        <div className="flex items-center gap-4">
                            <PaginationControls
                                totalCount={count || 0}
                                pageSize={limit}
                                currentPage={page}
                            />
                            <Link href="/dashboard/secretary/create">
                                <Button>+ Nuevo Caso</Button>
                            </Link>
                        </div>
                    </div>

                    <div className="border rounded-lg bg-card">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Título</TableHead>
                                    <TableHead>Juez Asignado (ID Anónimo)</TableHead>
                                    <TableHead className="text-center">Estado</TableHead>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead className="text-center">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {!cases || cases.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                            No hay casos registrados
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    cases.map((c) => {
                                        // Buscar el asignado que sea role='judge'
                                        const judgeAssignment = c.case_assignments.find((a: any) => a.role === 'judge');

                                        return (
                                            <TableRow key={c.id}>
                                                <TableCell className="font-medium">{c.title}</TableCell>
                                                <TableCell className="font-mono text-xs">
                                                    {judgeAssignment ? judgeAssignment.anon_actor_id : 'Pendiente'}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant={
                                                        c.status === 'assigned' ? 'default' :
                                                            c.status === 'in_progress' ? 'secondary' :
                                                                c.status === 'resolved' ? 'secondary' :
                                                                    c.status === 'closed' ? 'destructive' :
                                                                        c.status === 'pending' ? 'secondary' : 'default'
                                                    } className={`w-32 justify-center ${c.status === 'assigned' ? 'bg-blue-600 hover:bg-blue-700' :
                                                        c.status === 'in_progress' ? 'bg-yellow-500 hover:bg-yellow-600' :
                                                            c.status === 'resolved' ? 'bg-purple-600 text-white hover:bg-purple-700' :
                                                                c.status === 'closed' ? 'bg-green-600 hover:bg-green-700' :
                                                                    c.status === 'pending' ? 'bg-gray-400 hover:bg-gray-500' : ''
                                                        }`}>
                                                        {c.status === 'assigned' && 'Asignado'}
                                                        {c.status === 'in_progress' && 'En Revisión'}
                                                        {c.status === 'resolved' && 'Dictaminado'}
                                                        {c.status === 'closed' ? 'Cerrado' : ''}
                                                        {c.status === 'pending' && 'Por Asignar'}
                                                        {!['assigned', 'in_progress', 'resolved', 'closed', 'pending'].includes(c.status) && c.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {new Date(c.created_at).toLocaleDateString()}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {c.status === 'pending' && (
                                                        <div className="flex justify-center items-center gap-2">
                                                            {!c.file_url && (
                                                                <AddDocumentButton caseId={c.id} />
                                                            )}
                                                            <AssignJudgeButton caseId={c.id} disabled={!c.file_url} />
                                                        </div>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </div>
        </>
    );
}
