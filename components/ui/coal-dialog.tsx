"use client";

// Scoped to the coal-photo workflow so other report dialogs keep their behavior.
import * as React from "react";
import { Dialog as DialogPrimitive } from "@animate-ui/react/primitives/radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTitle = DialogPrimitive.Title;
const DialogDescription = DialogPrimitive.Description;

function DialogContent({ className, children, ...props }: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
    <DialogPrimitive.Content {...props} className={cn("fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-background text-foreground shadow-2xl outline-none", className)}>
      {children}
      <DialogPrimitive.Close className="absolute top-4 right-4 grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring" aria-label="Đóng cửa sổ"><X className="size-4" aria-hidden /></DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>;
}

export { Dialog, DialogContent, DialogTitle, DialogDescription };
