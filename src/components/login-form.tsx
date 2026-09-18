"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  IconAlertCircle,
  IconArrowRight,
  IconEye,
  IconEyeOff,
  IconLoader2,
} from "@tabler/icons-react";
import { z } from "zod";
import { loginSchema } from "@/lib/admin-access";
import { AccessField } from "./access-field";
import { useToast } from "@/components/ui/toast";

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm({ returnTo, sessionExpired = false }: { returnTo: string; sessionExpired?: boolean }) {
  const router = useRouter();
  const { show } = useToast();
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  useEffect(() => {
    if (sessionExpired) show({ tone: "warning", title: "Session expired", message: "Sign in to continue." });
  }, [sessionExpired, show]);

  async function submit(values: LoginValues) {
    setError("");
    const email = values.email.trim().toLowerCase();

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: values.password }),
      });
      const data = await response.json().catch(() => ({})) as { authenticated?: boolean; title?: string };

      if (!response.ok) {
        setError(response.status === 429
          ? "Too many sign-in attempts. Wait a few minutes and try again."
          : "We couldn’t sign you in with those details.");
        return;
      }
      if (!data.authenticated) {
        setError("We couldn’t sign you in with those details.");
        return;
      }
      router.replace(returnTo);
      router.refresh();
    } catch {
      setError("We couldn’t reach StrivePay. Check your connection and try again.");
    }
  }

  return (
    <section className="access-card" aria-labelledby="login-title">
      <header className="access-card-heading">
        <span>Operations cockpit</span>
        <h2 id="login-title">Sign in</h2>
        <p>Use your StrivePay admin account to continue.</p>
      </header>

      {error ? (
        <div className="access-alert access-alert-error" role="alert">
          <IconAlertCircle size={20} aria-hidden="true" />
          <p>{error}</p>
        </div>
      ) : null}

      <form className="access-form" method="post" onSubmit={handleSubmit(submit)} noValidate>
        <AccessField id="login-email" label="Email address" error={errors.email?.message}>
          <input
            id="login-email"
            type="email"
            inputMode="email"
            autoCapitalize="none"
            autoComplete="username"
            spellCheck={false}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "login-email-error" : undefined}
            placeholder="admin@strivepay.local"
            {...register("email")}
          />
        </AccessField>

        <AccessField id="login-password" label="Password" error={errors.password?.message}>
          <div className="access-password-input">
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? "login-password-error" : undefined}
              placeholder="Enter your password"
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
            >
              {showPassword ? <IconEyeOff size={20} /> : <IconEye size={20} />}
            </button>
          </div>
        </AccessField>

        <button className="access-primary-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <><IconLoader2 className="access-spinner" size={20} /> Signing in…</>
          ) : (
            <>Sign in <IconArrowRight size={20} /></>
          )}
        </button>
      </form>
    </section>
  );
}
