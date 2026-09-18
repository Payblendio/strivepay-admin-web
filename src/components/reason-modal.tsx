"use client";

import { useState, type ReactNode } from "react";
import { Modal } from "@/components/ui/modal";
import { Button, TextField } from "@/components/ui/primitives";

export function ReasonModal({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  extraFields,
  busy = false,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  extraFields?: ReactNode;
  busy?: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");

  return (
    <Modal open={open} onClose={onClose} title={title} description={description} size="small">
      <form
        className="reason-form"
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm(reason.trim());
        }}
      >
        {extraFields}
        <label className="sp-field">
          <span>Reason</span>
          <textarea
            required
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Why is this change being made?"
          />
        </label>
        {error ? <p className="error-box">{error}</p> : null}
        <div className="reason-actions">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" loading={busy}>{confirmLabel}</Button>
        </div>
      </form>
    </Modal>
  );
}

export function AmountFields({
  currency,
  amount,
  onCurrency,
  onAmount,
}: {
  currency: string;
  amount: string;
  onCurrency: (value: string) => void;
  onAmount: (value: string) => void;
}) {
  return (
    <>
      <TextField label="Currency" value={currency} onChange={(event) => onCurrency(event.target.value)} placeholder="NGN" />
      <TextField label="Amount" value={amount} onChange={(event) => onAmount(event.target.value)} inputMode="decimal" placeholder="0.00" />
    </>
  );
}
