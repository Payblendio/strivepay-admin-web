"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, TextField } from "@/components/ui/primitives";
import { PERMISSIONS } from "@/lib/admin-access";
import { adminFetch } from "@/lib/admin-session";

const PERMISSION_OPTIONS = Object.values(PERMISSIONS);

export function RoleCreateForm() {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function togglePermission(value: string) {
    setPermissions((current) => (
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    ));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await adminFetch("/api/admin/rbac/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: slug.trim(),
        name: name.trim(),
        permissions,
      }),
    });
    setBusy(false);
    if (!response.ok) {
      const data = await response.json().catch(() => null) as { title?: string } | null;
      setError(data?.title ?? "The role could not be created.");
      return;
    }
    setSlug("");
    setName("");
    setPermissions([]);
    router.push("/roles");
    router.refresh();
  }

  return (
    <form className="ops-stack" onSubmit={submit}>
      <TextField label="Slug" value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="risk-operator" required />
      <TextField label="Name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Risk operator" required />
      <fieldset className="ops-check-list">
        <legend>Permissions</legend>
        {PERMISSION_OPTIONS.map((permission) => (
          <label key={permission} className="ops-check-row">
            <input
              type="checkbox"
              checked={permissions.includes(permission)}
              onChange={() => togglePermission(permission)}
            />
            <span>
              <strong>{permission}</strong>
            </span>
          </label>
        ))}
      </fieldset>
      {error ? <p className="error-box">{error}</p> : null}
      <Button type="submit" loading={busy}>Create role</Button>
    </form>
  );
}
