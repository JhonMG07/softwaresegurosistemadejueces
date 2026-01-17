import { AppNavbar } from '@/components/app-navbar';
import { CreateCaseForm } from '@/components/secretary/create-case-form';
import Link from 'next/link';

export default function CreateCasePage() {
    return (
        <>
            <AppNavbar />
            <div className="h-[calc(100vh-88px)] bg-background overflow-hidden relative">
                <div className="container mx-auto px-6 h-full flex flex-col pt-4">
                    <div className="w-full mb-4 sticky z-10 bg-background/95 backdrop-blur py-2">
                        <Link href="/dashboard/secretary" className="text-lg font-medium text-muted-foreground hover:underline hover:text-primary transition-colors flex items-center gap-2">
                            <span>←</span> Volver al Panel
                        </Link>
                    </div>
                    <div className="flex-1 overflow-auto pb-8">
                        <CreateCaseForm />
                    </div>
                </div>
            </div>
        </>
    );
}
