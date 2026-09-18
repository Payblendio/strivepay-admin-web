"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { Button, TextField } from "@/components/ui/primitives";
import { adminFetch } from "@/lib/admin-session";

type RoleOption = { slug: string; name: string };

export function CreateAdminForm({ roleOptions }: { roleOptions: RoleOption[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const sorted = useMemo(
    () => [...roleOptions].sort((a, b) => a.name.localeCompare(b.name) || a.slug.localeCompare(b.slug)),
    [roleOptions],
  );

  function toggle(slug: string) {
    setRoles((current) => (current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug]));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await adminFetch("/api/admin/rbac/admins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        displayName: displayName.trim(),
        password,
        roles,
      }),
    });
    setBusy(false);
    if (!response.ok) {
      const data = await response.json().catch(() => null) as { title?: string } | null;
      setError(data?.title ?? "The administrator could not be created.");
      return;
    }
    setEmail("");
    setDisplayName("");
    setPassword("");
    setRoles([]);
    router.push("/team");
    router.refresh();
  }

  return (
    <form className="ops-stack" onSubmit={submit}>
      <TextField label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      <TextField label="Display name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
      <TextField label="Temporary password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
      <p className="ops-panel-copy">Password must be at least 12 characters.</p>
      <fieldset className="ops-check-list">
        <legend>Initial roles</legend>
        {sorted.map((role) => (
          <label key={role.slug} className="ops-check-row">
            <input type="checkbox" checked={roles.includes(role.slug)} onChange={() => toggle(role.slug)} />
            <span>
              <strong>{role.name}</strong>
              {role.slug.toLowerCase() !== role.name.trim().toLowerCase() ? (
                <small>{role.slug}</small>
              ) : null}
            </span>
          </label>
        ))}
      </fieldset>
      {error ? <p className="error-box">{error}</p> : null}
      <Button type="submit" loading={busy} disabled={!roles.length}>Create administrator</Button>
    </form>
  );
}
