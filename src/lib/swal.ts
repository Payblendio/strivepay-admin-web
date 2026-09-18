"use client";

const SWAL_CLASSES = {
  container: "strivepay-swal-container",
  popup: "strivepay-swal",
  icon: "strivepay-swal-icon",
  title: "strivepay-swal-title",
  htmlContainer: "strivepay-swal-copy",
  actions: "strivepay-swal-actions",
  confirmButton: "access-primary-button strivepay-swal-confirm",
  cancelButton: "soft-button",
  closeButton: "floating-close-button strivepay-swal-close",
  input: "strivepay-swal-input",
};

async function swal() {
  const { default: Swal } = await import("sweetalert2");
  return Swal;
}

function pauseOpenDialogs() {
  if (typeof document === "undefined") return [] as HTMLDialogElement[];
  const opened = [...document.querySelectorAll("dialog")].filter((dialog): dialog is HTMLDialogElement => dialog instanceof HTMLDialogElement && dialog.open);
  for (const dialog of opened) {
    dialog.setAttribute("data-swal-paused", "true");
    dialog.close();
  }
  return opened;
}

function resumeDialogs(dialogs: HTMLDialogElement[]) {
  for (const dialog of dialogs) {
    dialog.removeAttribute("data-swal-paused");
    if (dialog.isConnected && !dialog.open) dialog.showModal();
  }
}

async function fire(options: Record<string, unknown>) {
  const paused = pauseOpenDialogs();
  try {
    const Swal = await swal();
    return await Swal.fire(options);
  } finally {
    resumeDialogs(paused);
  }
}

export async function confirmAction({
  title,
  text,
  confirmLabel = "Continue",
  tone = "warning",
  showCancelButton = true,
}: {
  title: string;
  text: string;
  confirmLabel?: string;
  tone?: "success" | "warning" | "danger" | "info";
  showCancelButton?: boolean;
}) {
  const result = await fire({
    icon: tone === "danger" ? "error" : tone === "success" ? "success" : tone === "info" ? "info" : "warning",
    title,
    text,
    confirmButtonText: confirmLabel,
    showCancelButton,
    cancelButtonText: "Cancel",
    showCloseButton: true,
    closeButtonHtml: "&times;",
    buttonsStyling: false,
    heightAuto: false,
    reverseButtons: true,
    customClass: SWAL_CLASSES,
  });
  return result.isConfirmed;
}

export async function promptReason({
  title,
  text,
  confirmLabel = "Confirm",
}: {
  title: string;
  text: string;
  confirmLabel?: string;
}) {
  const result = await fire({
    icon: "warning",
    title,
    text,
    input: "textarea",
    inputPlaceholder: "Why is this change being made?",
    inputAttributes: { "aria-label": "Reason" },
    confirmButtonText: confirmLabel,
    showCancelButton: false,
    showCloseButton: true,
    closeButtonHtml: "&times;",
    buttonsStyling: false,
    heightAuto: false,
    reverseButtons: true,
    customClass: SWAL_CLASSES,
    inputValidator: (value: string) => value.trim() ? undefined : "Enter a reason for the audit trail",
  });
  if (!result.isConfirmed) return null;
  const reason = String(result.value ?? "").trim();
  return reason || null;
}

export async function notifySuccess(title: string, text?: string) {
  await fire({
    icon: "success",
    title,
    text,
    confirmButtonText: "Got it",
    showCloseButton: true,
    closeButtonHtml: "&times;",
    buttonsStyling: false,
    heightAuto: false,
    customClass: SWAL_CLASSES,
  });
}
