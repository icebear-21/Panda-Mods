"use client";

import { useActionState, useState } from "react";
import { AlertDialog } from "radix-ui";
import { LoaderCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteReleaseAction } from "@/app/actions";

export function DeleteReleaseButton({ releaseId, groupId, version, lastRelease }: {
  releaseId: string; groupId: string; version: string; lastRelease: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(deleteReleaseAction, { error: "" });
  return <AlertDialog.Root open={open} onOpenChange={next => { if (!pending) setOpen(next); }}>
    <AlertDialog.Trigger asChild>
      <Button type="button" variant="destructive" size="sm" aria-label={`Delete version ${version}`}><Trash2 />Delete</Button>
    </AlertDialog.Trigger>
    <AlertDialog.Portal>
      <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/70" />
      <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-card p-6 shadow-xl">
        <AlertDialog.Title className="text-lg font-semibold">Delete version {version}?</AlertDialog.Title>
        <AlertDialog.Description className="mt-3 text-sm leading-6 text-muted-foreground">
          This permanently deletes the release and its ZIP from local storage. Its download link will stop working.
          {lastRelease ? " This is the last release, so the pack will also be removed from the library." : " The remaining releases will stay available."}
        </AlertDialog.Description>
        <form action={action} className="mt-5">
          <input type="hidden" name="releaseId" value={releaseId} />
          <input type="hidden" name="groupId" value={groupId} />
          {state.error && <p role="alert" className="mb-4 text-sm text-destructive">{state.error}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <AlertDialog.Cancel asChild><Button type="button" variant="outline" disabled={pending}>Cancel</Button></AlertDialog.Cancel>
            <Button type="submit" variant="destructive" disabled={pending}>{pending ? <><LoaderCircle className="animate-spin" />Deleting…</> : "Delete permanently"}</Button>
          </div>
        </form>
      </AlertDialog.Content>
    </AlertDialog.Portal>
  </AlertDialog.Root>;
}
