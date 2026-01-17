import { Shield, BarChart3, FileText, Key } from "lucide-react";
import Link from "next/link";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/logout-button";

interface AdminNavbarProps {
    activePath?: string;
}

export async function AdminNavbar({ activePath }: AdminNavbarProps) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    const { data: profile } = await supabase
        .from('users_profile')
        .select('real_name, email, role')
        .eq('id', user.id)
        .single();

    const displayName = profile?.real_name || profile?.email || user.email;
    const roleLabel = profile?.role === 'super_admin' ? 'Super Administrador' : 'Auditor';

    const navItems = [
        { href: '/admin', label: 'Dashboard', icon: BarChart3 },
        { href: '/admin/logs', label: 'Logs', icon: FileText },
        { href: '/admin/metrics', label: 'Métricas', icon: BarChart3 },
        { href: '/admin/tokens', label: 'Tokens', icon: Key },
    ];

    return (
        <header className="border-b bg-white dark:bg-slate-950 shadow-sm sticky top-0 z-50">
            <div className="container mx-auto px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Shield className="h-8 w-8 text-amber-600 dark:text-amber-500" />
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                                Panel de Auditoría
                            </h1>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                {roleLabel} - Sistema de Gestión Judicial
                            </p>
                        </div>
                    </div>

                    {/* Navigation */}
                    <nav className="hidden md:flex items-center gap-1">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = activePath === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isActive
                                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                                            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                                        }`}
                                >
                                    <Icon className="h-4 w-4" />
                                    {item.label}
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                {displayName}
                            </span>
                            <p className="text-xs text-slate-500 dark:text-slate-500">
                                {roleLabel}
                            </p>
                        </div>
                        <ThemeSwitcher />
                        <LogoutButton />
                    </div>
                </div>
            </div>
        </header>
    );
}
