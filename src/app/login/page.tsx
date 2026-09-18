import type { Metadata } from "next";
import Image from "next/image";
import { LoginForm } from "@/components/login-form";
import { safeReturnTo } from "@/lib/admin-access";

export const metadata: Metadata = { title: "Sign in" };

type LoginPageProps = {
  searchParams: Promise<{ returnTo?: string | string[]; reason?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const returnTo = safeReturnTo(params.returnTo);
  const reason = Array.isArray(params.reason) ? params.reason[0] : params.reason;

  return (
    <main className="ops-login">
      <div className="ops-login-inner">
        <Image
          className="ops-login-brand"
          src="/branding/strivepay-logo-dark.svg"
          alt="StrivePay"
          width={1937}
          height={621}
          priority
        />
        <LoginForm returnTo={returnTo} sessionExpired={reason === "session-expired"} />
        <p className="access-safety-note">
          Never share your administrator password. Session activity is audited.
        </p>
      </div>
    </main>
  );
}
