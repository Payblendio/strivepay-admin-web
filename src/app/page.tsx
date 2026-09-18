import { redirect } from "next/navigation";
import { signedInHome } from "@/lib/admin-session.server";

export default async function Home() {
  redirect(await signedInHome());
}
