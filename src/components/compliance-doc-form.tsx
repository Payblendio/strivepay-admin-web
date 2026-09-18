"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, TextField } from "@/components/ui/primitives";
import { adminFetch } from "@/lib/admin-session";

export function ComplianceDocForm() {
  const router = useRouter();
  const [documentType, setDocumentType] = useState("TERMS_AND_CONDITIONS");
  const [version, setVersion] = useState("1.0");
  const [documentUrl, setDocumentUrl] = useState("https://");
  const [contentSha256Base64, setContentSha256Base64] = useState("");
  const [effectiveAt, setEffectiveAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await adminFetch("/api/admin/compliance/legal-documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentType,
        version,
        documentUrl,
        contentSha256Base64,
        effectiveAt: effectiveAt.trim() || null,
      }),
    });
    setBusy(false);
    if (!response.ok) {
      const data = await response.json().catch(() => null) as { title?: string } | null;
      setError(data?.title ?? "Document could not be configured.");
      return;
    }
    setVersion("1.0");
    setDocumentUrl("https://");
    setContentSha256Base64("");
    setEffectiveAt("");
    router.push("/compliance");
    router.refresh();
  }

  return (
    <form className="ops-stack" onSubmit={submit}>
      <label className="sp-field"><span>Type</span>
        <select value={documentType} onChange={(event) => setDocumentType(event.target.value)}>
          <option value="TERMS_AND_CONDITIONS">TERMS_AND_CONDITIONS</option>
          <option value="PRIVACY_POLICY">PRIVACY_POLICY</option>
          <option value="TERMS_OF_SERVICE">TERMS_OF_SERVICE</option>
          <option value="THIRD_PARTY_AGREEMENT">THIRD_PARTY_AGREEMENT</option>
        </select>
      </label>
      <TextField label="Version" value={version} onChange={(event) => setVersion(event.target.value)} required />
      <TextField label="Document URL (https)" value={documentUrl} onChange={(event) => setDocumentUrl(event.target.value)} required />
      <TextField label="Content SHA-256 (base64)" value={contentSha256Base64} onChange={(event) => setContentSha256Base64(event.target.value)} required />
      <TextField label="Effective at (ISO optional)" value={effectiveAt} onChange={(event) => setEffectiveAt(event.target.value)} />
      {error ? <p className="error-box">{error}</p> : null}
      <Button type="submit" loading={busy}>Save legal document</Button>
    </form>
  );
}
