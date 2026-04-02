"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { Settings, LogOut, User, Building2, ChevronDown } from "lucide-react";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";
import { authClient, isCloud, clearAuthToken } from "@/lib/auth-client";

const navItems: { href: string; label: string; exact?: boolean }[] = [
  { href: "/app", label: "Home", exact: true },
  { href: "/app/universe", label: "Universe" },
  { href: "/app/video", label: "Video" },
  { href: "/app/carousel", label: "Carousel" },
  { href: "/app/image", label: "Image" },
];

/** User avatar dropdown with settings + logout */
function UserMenu({ name, email, onLogout }: { name?: string | null; email?: string | null; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative ml-2" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20 hover:bg-amber-500/30 transition-colors"
      >
        <User className="h-4 w-4 text-amber-500" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 rounded-lg border border-slate-700 bg-slate-900 py-1 shadow-xl z-50">
          <div className="px-3 py-2 border-b border-slate-800">
            <p className="text-xs font-medium text-white truncate">{name || "User"}</p>
            {email && <p className="text-[10px] text-slate-400 truncate">{email}</p>}
          </div>
          <Link
            href="/app/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 transition-colors"
          >
            <Settings className="h-3.5 w-3.5" />
            Settings
          </Link>
          <button
            onClick={() => { setOpen(false); onLogout(); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

/** Cloud-only: auth hooks + org switcher + user menu */
function CloudMenu() {
  const router = useRouter();
  const session = authClient.useSession();
  const activeOrg = authClient.useActiveOrganization();
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);
  const [showOrgMenu, setShowOrgMenu] = useState(false);

  const isLoggedIn = !!session.data?.user;

  useEffect(() => {
    if (!isLoggedIn) return;
    authClient.organization.list().then((res) => {
      if (res.data) setOrgs(res.data);
    }).catch(() => {});
  }, [isLoggedIn]);

  if (!isLoggedIn) return null;

  async function handleLogout() {
    await authClient.signOut();
    clearAuthToken();
    router.push("/login");
  }

  async function switchOrg(orgId: string) {
    await authClient.organization.setActive({ organizationId: orgId });
    setShowOrgMenu(false);
    window.location.reload();
  }

  return (
    <>
      <div className="ml-3 h-5 w-px bg-slate-800" />

      {/* Org switcher */}
      {orgs.length > 0 && (
        <div className="relative ml-2">
          <button
            onClick={() => setShowOrgMenu(!showOrgMenu)}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800 transition-colors"
          >
            <Building2 className="h-3.5 w-3.5 text-slate-400" />
            <span className="max-w-[100px] truncate">
              {activeOrg.data?.name || "Select org"}
            </span>
            <ChevronDown className="h-3 w-3 text-slate-500" />
          </button>
          {showOrgMenu && (
            <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-slate-700 bg-slate-900 py-1 shadow-xl z-50">
              {orgs.map((org) => (
                <button
                  key={org.id}
                  onClick={() => switchOrg(org.id)}
                  className={cn(
                    "w-full px-3 py-2 text-left text-xs transition-colors",
                    activeOrg.data?.id === org.id
                      ? "bg-amber-500/10 text-amber-400"
                      : "text-slate-300 hover:bg-slate-800"
                  )}
                >
                  {org.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* User menu */}
      <UserMenu
        name={session.data?.user?.name}
        email={session.data?.user?.email}
        onLogout={handleLogout}
      />
    </>
  );
}

export function Navbar() {
  const pathname = usePathname();

  // Hide navbar on project editor pages (full-screen editor has its own header)
  const isProjectEditor =
    /^\/app\/universe\/[^/]+\/projects\/[^/]+$/.test(pathname) &&
    !pathname.endsWith("/generate");
  if (isProjectEditor) return null;

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950">
      <div className="flex h-16 items-center justify-between px-6 py-3">
        {/* Logo */}
        <Link href="/app" className="flex items-center gap-2">
          <Logo size="xs" />
        </Link>

        {/* Nav pills */}
        <nav className="flex items-center gap-1.5">
          {navItems.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : item.href === "/app/universe"
                ? pathname.startsWith("/app/universe")
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-slate-700 text-white"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                )}
              >
                {item.label}
              </Link>
            );
          })}

          {/* Open-source: settings icon. Cloud: user dropdown with settings inside */}
          {!isCloud && (
            <Link
              href="/app/settings"
              className={cn(
                "ml-2 flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                pathname === "/app/settings"
                  ? "bg-slate-700 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              )}
            >
              <Settings className="h-4 w-4" />
            </Link>
          )}

          {/* Cloud mode only: org switcher + user menu */}
          {isCloud && <CloudMenu />}
        </nav>
      </div>
    </header>
  );
}
