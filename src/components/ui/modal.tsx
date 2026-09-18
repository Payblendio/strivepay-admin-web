"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { IconX } from "@tabler/icons-react";

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = "medium",
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  size?: "small" | "medium" | "large";
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open && dialog.getAttribute("data-swal-paused") !== "true") dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`ui-dialog ${size} ${className}`.trim()}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="dialog-panel">
        <header>
          <div>
            <span className="micro-label">STRIVEPAY</span>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close dialog">
            <IconX size={19} stroke={2} />
          </button>
        </header>
        <div className="dialog-body">{children}</div>
      </div>
    </dialog>
  );
}
