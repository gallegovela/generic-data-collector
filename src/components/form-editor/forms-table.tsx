"use client";

import { MoreHorizontal, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getFillAction } from "@/lib/form-editor/fill-link";
import {
  archiveFormAction,
  createFormAction,
  duplicateFormAction,
} from "@/server/forms/form.actions";
import type { FormSummary } from "@/server/forms/form.repository";

type FormRow = Omit<FormSummary, "updatedAt"> & { updatedAt: string };

const STATUS_LABELS: Record<string, string> = { draft: "Borrador", published: "Publicado" };

function NameDialog({
  open,
  onOpenChange,
  title,
  description,
  action,
  hidden,
  defaultName,
  submitLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  action: typeof createFormAction;
  hidden?: Record<string, string>;
  defaultName: string;
  submitLabel: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, undefined);

  useEffect(() => {
    if (state?.formId) {
      onOpenChange(false);
      router.refresh();
    }
  }, [state, onOpenChange, router]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form action={formAction} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {Object.entries(hidden ?? {}).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <div className="flex flex-col gap-2">
            <Label htmlFor="form-name">Nombre</Label>
            <Input id="form-name" name="name" defaultValue={defaultName} required />
            {state?.error && (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ArchiveDialog({
  form,
  onOpenChange,
}: {
  form: FormRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(archiveFormAction, undefined);

  useEffect(() => {
    if (state && !state.error) {
      onOpenChange(false);
      router.refresh();
    }
  }, [state, onOpenChange, router]);

  return (
    <AlertDialog open={form !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <form action={formAction} className="flex flex-col gap-4">
          <AlertDialogHeader>
            <AlertDialogTitle>Archivar formulario</AlertDialogTitle>
            <AlertDialogDescription>
              «{form?.name}» dejará de aparecer en el listado. No se borra ningún dato.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <input type="hidden" name="formId" value={form?.id ?? ""} />
          {state?.error && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button type="submit" variant="destructive" disabled={pending}>
              Archivar
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function FillItem({ form }: { form: FormRow }) {
  const action = getFillAction(form);
  if (action.available) {
    return (
      <DropdownMenuItem render={<Link href={action.href} />}>Rellenar</DropdownMenuItem>
    );
  }
  return (
    <DropdownMenuItem disabled aria-disabled="true" className="flex-col items-start gap-0.5">
      <span>Rellenar</span>
      <span className="text-xs text-muted-foreground">{action.reason}</span>
    </DropdownMenuItem>
  );
}

/**
 * Listado de formularios con crear, rellenar, duplicar y archivar.
 *
 * Cubre: RF-EDT-01, RF-EDT-02, RF-EDT-13, RF-EDT-14, CA-EDT-04, CA-EDT-05, CA-EDT-06,
 * CA-EDT-13, CA-EDT-14, CA-EDT-15
 */
export function FormsTable({ forms }: { forms: FormRow[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [duplicating, setDuplicating] = useState<FormRow | null>(null);
  const [archiving, setArchiving] = useState<FormRow | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Formularios</h1>
        <Button type="button" onClick={() => setCreating(true)}>
          <Plus className="size-4" aria-hidden="true" /> Nuevo formulario
        </Button>
      </div>

      {forms.length === 0 ? (
        <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          Todavía no hay formularios. Crea el primero con «Nuevo formulario».
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Versión publicada</TableHead>
              <TableHead>Respuestas</TableHead>
              <TableHead>Modificado</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {forms.map((form) => (
              <TableRow key={form.id} data-testid="form-row" data-form-name={form.name}>
                <TableCell>
                  <Link href={`/admin/forms/${form.id}`} className="font-medium hover:underline">
                    {form.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{STATUS_LABELS[form.status] ?? form.status}</Badge>
                </TableCell>
                <TableCell>{form.publishedVersionLabel}</TableCell>
                <TableCell data-testid="response-count">
                  {form.responseCount > 0 ? (
                    <Link href={`/admin/forms/${form.id}/submissions`} className="hover:underline">
                      {form.responseCount}
                    </Link>
                  ) : (
                    form.responseCount
                  )}
                </TableCell>
                <TableCell>{new Date(form.updatedAt).toLocaleString("es-ES")}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      aria-label={`Acciones de «${form.name}»`}
                      className="rounded p-1 hover:bg-muted"
                    >
                      <MoreHorizontal className="size-4" aria-hidden="true" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => router.push(`/admin/forms/${form.id}`)}>
                        Abrir
                      </DropdownMenuItem>
                      <FillItem form={form} />
                      <DropdownMenuItem onClick={() => setDuplicating(form)}>Duplicar</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setArchiving(form)}>Archivar</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {creating && (
        <NameDialog
          open
          onOpenChange={setCreating}
          title="Nuevo formulario"
          description="Se crea vacío; añadirás los campos en el editor."
          action={createFormAction}
          defaultName=""
          submitLabel="Crear"
        />
      )}
      {duplicating && (
        <NameDialog
          open
          onOpenChange={(open) => !open && setDuplicating(null)}
          title="Duplicar formulario"
          description="Se crea una copia independiente con otro nombre."
          action={duplicateFormAction}
          hidden={{ sourceFormId: duplicating.id }}
          defaultName={`${duplicating.name} (copia)`}
          submitLabel="Duplicar"
        />
      )}
      <ArchiveDialog form={archiving} onOpenChange={(open) => !open && setArchiving(null)} />
    </div>
  );
}
