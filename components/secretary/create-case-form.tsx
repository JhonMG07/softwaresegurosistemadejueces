'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createCaseAction } from '@/app/actions/create-case';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea'; // Assuming Textarea exists or I'll use standard textarea if not
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export function CreateCaseForm() {
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setLoading(true);
        const formData = new FormData(event.currentTarget);

        try {
            await createCaseAction(formData);
            toast.success('Caso creado exitosamente');
            router.push('/dashboard/secretary');
        } catch (error: any) {
            if (error.message === 'NEXT_REDIRECT') {
                // This might not be reachable if using Server Actions directly, but good safety.
                return;
            }
            setLoading(false);
            toast.error(error.message || 'Error al crear el caso');
        }
    };

    return (
        <Card className="w-full max-w-lg mx-auto">
            <CardHeader>
                <CardTitle>Nuevo Caso</CardTitle>
            </CardHeader>
            <form onSubmit={handleSubmit}>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="title">Título del Caso</Label>
                        <Input id="title" name="title" required placeholder="Ej. Demanda vs Empresa X" />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="case_type">Tipo de Caso</Label>
                        <Select name="case_type" required>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccione un tipo" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Penal">Penal</SelectItem>
                                <SelectItem value="Civil">Civil</SelectItem>
                                <SelectItem value="Laboral">Laboral</SelectItem>
                                <SelectItem value="Administrativo">Administrativo</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="priority">Prioridad</Label>
                        <Select name="priority" required defaultValue="medium">
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccione prioridad" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="low">Baja</SelectItem>
                                <SelectItem value="medium">Media</SelectItem>
                                <SelectItem value="high">Alta</SelectItem>
                                <SelectItem value="critical">Urgente</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Descripción</Label>
                        <Textarea
                            id="description"
                            name="description"
                            placeholder="Detalles del caso..."
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="file">Documento (PDF)</Label>
                        <Input id="file" name="file" type="file" accept="application/pdf" required />
                    </div>
                </CardContent>
                <CardFooter>
                    <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? 'Procesando...' : 'Crear Caso'}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
