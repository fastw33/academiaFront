import { cookies } from "next/headers";

const backendUrl = process.env.BACKEND_INTERNAL_URL || "http://localhost:4100";

export async function serverApi(path: string, init: RequestInit = {}) {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map(({ name, value }) => `${name}=${value}`).join("; ");
  const headers = new Headers(init.headers);
  if (cookieHeader) headers.set("cookie", cookieHeader);

  return fetch(`${backendUrl}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
}
