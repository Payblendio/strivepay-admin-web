"use client";

import { useMemo, useState, type ReactNode } from "react";
import { IconCheck, IconChevronDown, IconSearch } from "@tabler/icons-react";
import { Modal } from "@/components/ui/modal";

export type ChoiceOption = {
  value: string;
  label: string;
  description?: string;
  leading?: ReactNode;
};

export function ChoiceSelect({
  label,
  value,
  options,
  onChange,
  title,
  description,
  placeholder = "Select an option",
}: {
  label: string;
  value?: string;
  options: ChoiceOption[];
  onChange: (value: string) => void;
  title: string;
  description?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((option) => option.value === value);
  const visible = useMemo(
    () => options.filter((option) => `${option.label} ${option.description ?? ""} ${option.value}`.toLowerCase().includes(query.toLowerCase())),
    [options, query],
  );

  return (
    <div className="country-field">
      <label>{label}</label>
      <button className="country-trigger" type="button" onClick={() => setOpen(true)}>
        {selected ? (
          <span>
            {selected.leading}
            <span>
              <strong>{selected.label}</strong>
              {selected.description ? <small>{selected.description}</small> : null}
            </span>
          </span>
        ) : <span className="placeholder">{placeholder}</span>}
        <IconChevronDown className="country-chevron" size={18} stroke={2.2} />
      </button>
      <Modal className="access-selector-dialog" open={open} onClose={() => setOpen(false)} title={title} description={description}>
        {options.length > 6 ? (
          <label className="country-search">
            <IconSearch size={19} stroke={2} />
            <input autoFocus placeholder="Search" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
        ) : null}
        <div className="country-grid">
          {visible.map((option) => (
            <button
              type="button"
              key={option.value}
              className={option.value === value ? "selected" : ""}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
                setQuery("");
              }}
            >
              {option.leading}
              <span>
                <strong>{option.label}</strong>
                {option.description ? <small>{option.description}</small> : null}
              </span>
              {option.value === value ? <IconCheck className="country-check" size={19} stroke={2.4} /> : null}
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
