import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";

/**
 * Auth guard for /app routes.
 *
 * Cloud mode (BETTER_AUTH_SECRET set): checks session, redirects to /login.
 * Open source mode (no secret): passes through, no auth check.
 */
async function checkAuth() {
  // Open source mode — no auth required
  if (!process.env.BETTER_AUTH_SECRET) {
    return null;
  }

  // Cloud mode — verify session via Better Auth
  try {
    const { auth } = await import("@/lib/auth");
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session) {
      redirect("/login");
    }
    return session;
  } catch {
    redirect("/login");
  }
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await checkAuth();

  return (
    <>
      <Navbar />
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </>
  );
}
