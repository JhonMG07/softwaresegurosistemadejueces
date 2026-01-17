'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FilePlus } from 'lucide-react';
import { AddDocumentDialog } from './add-document-dialog';

interface AddDocumentButtonProps {
    caseId: string;
}

export function AddDocumentButton({ caseId }: AddDocumentButtonProps) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <Button
                size="sm"
                variant="outline"
                onClick={() => setOpen(true)}
                className="mr-2"
                title="Agregar Documento"
            >
                <FilePlus className="h-4 w-4 mr-2" />
                Agregar Docs
            </Button>
            <AddDocumentDialog
                caseId={caseId}
                open={open}
                onOpenChange={setOpen}
            />
        </>
    );
}
