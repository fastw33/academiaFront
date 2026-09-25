import { redirect } from "next/navigation";
import { serverApi } from "@/lib/server-api";

export default async function HomePage() {
  const response = await serverApi("/api/auth/me");
  redirect(response.ok ? "/dashboard" : "/login");
}
