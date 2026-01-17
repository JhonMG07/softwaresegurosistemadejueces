import Link from "next/link";
import { ShieldX, ArrowLeft, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Página de acceso no autorizado
 *
 * Se muestra cuando un usuario intenta acceder a un recurso
 * para el cual no tiene permisos.
 */
export default function UnauthorizedPage() {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
            <Card className="max-w-md w-full border-red-200 dark:border-red-900">
                <CardHeader className="text-center pb-2">
                    <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-950 rounded-full flex items-center justify-center mb-4">
                        <ShieldX className="h-8 w-8 text-red-600 dark:text-red-400" />
                    </div>
                    <CardTitle className="text-2xl text-red-600 dark:text-red-400">
                        Acceso No Autorizado
                    </CardTitle>
                </CardHeader>
                <CardContent className="text-center space-y-4">
                    <p className="text-slate-600 dark:text-slate-400">
                        No tienes permisos para acceder a este recurso.
                        Si crees que esto es un error, contacta al administrador del sistema.
                    </p>

                    <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
                        <Link href="/">
                            <Button variant="outline" className="w-full sm:w-auto">
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Volver al Inicio
                            </Button>
                        </Link>
                        <Link href="/auth/login">
                            <Button variant="destructive" className="w-full sm:w-auto">
                                <LogOut className="h-4 w-4 mr-2" />
                                Cerrar Sesión
                            </Button>
                        </Link>
                    </div>

                    <p className="text-xs text-slate-500 pt-4">
                        Código de error: 403 - Forbidden
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
