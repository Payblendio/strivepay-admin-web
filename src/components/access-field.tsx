type AccessFieldProps = {
  children: React.ReactNode;
  error?: string;
  hint?: string;
  id: string;
  label: string;
  action?: React.ReactNode;
};

export function AccessField({ children, error, hint, id, label, action }: AccessFieldProps) {
  return (
    <div className={`access-field${error ? " is-invalid" : ""}`}>
      <div className="access-field-label-row">
        <label htmlFor={id}>{label}</label>
        {action}
      </div>
      {children}
      {error ? <p className="access-field-message" id={`${id}-error`}>{error}</p> : null}
      {!error && hint ? <p className="access-field-hint" id={`${id}-hint`}>{hint}</p> : null}
    </div>
  );
}
