import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  Shield,
  LogOut,
  UserCog,
  Network,
  ArrowLeftRight,
  Database,
  Wrench,
  Download,
  FolderArchive,
  Settings,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const SYSADMIN_NAV = [
  { icon: UserCog, label: "จัดการ SysAdmin", href: "/sys-k7x9/users" },
  { icon: Network, label: "โครงสร้างพื้นฐาน", href: "/sys-k7x9/infrastructure" },
  { icon: ArrowLeftRight, label: "สลับฐานข้อมูล", href: "/sys-k7x9/db-switch" },
  { icon: Database, label: "Clone ข้อมูล", href: "/sys-k7x9/clone-data" },
  { icon: Wrench, label: "Maintenance Schedule", href: "/sys-k7x9/maintenance" },
  { icon: Download, label: "Github Push & Pull", href: "/sys-k7x9/github" },
];

interface SysAdminMe {
  id: number;
  username: string;
  fullName: string;
  isMaster: boolean;
  mustChangePassword: boolean;
}

export default function SysAdminLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();

  const { data: me, isLoading, isError } = useQuery<SysAdminMe>({
    queryKey: ["/api/sysadmin/me"],
    retry: false,
  });

  useEffect(() => {
    if (!isLoading && (isError || !me)) {
      setLocation("/sys-k7x9");
    }
  }, [isLoading, isError, me, setLocation]);

  const handleLogout = async () => {
    await fetch("/api/sysadmin/logout", { method: "POST", credentials: "include" });
    setLocation("/sys-k7x9");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400">กำลังตรวจสอบสิทธิ์...</div>
      </div>
    );
  }

  if (!me) return null;

  return (
    <div className="min-h-screen bg-gray-50/50 flex font-sans">
      <aside className="w-64 bg-gray-900 text-white border-r border-gray-700 hidden md:flex flex-col fixed h-full z-10 overflow-y-auto">
        <div className="h-16 flex items-center px-6 border-b border-gray-700 shrink-0">
          <div className="flex items-center gap-3 font-semibold text-lg">
            <div className="w-9 h-9 rounded-xl bg-red-600 flex items-center justify-center text-white shadow-lg shadow-red-900/30">
              <Shield className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-heading tracking-tight text-white leading-none">System Admin</span>
              <span className="text-[9px] font-medium text-red-400 uppercase tracking-widest mt-1">
                {me.isMaster ? "Master" : "Technician"}
              </span>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {SYSADMIN_NAV.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <span
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer",
                    isActive
                      ? "bg-red-600/20 text-red-300 border border-red-500/30"
                      : "text-gray-300 hover:bg-gray-700/50 hover:text-white"
                  )}
                  data-testid={`nav-sys-${item.href.split("/").pop()}`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-700 shrink-0">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="h-8 w-8 rounded-full bg-red-600/20 flex items-center justify-center">
              <UserCog className="h-5 w-5 text-red-400" />
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium truncate" data-testid="text-sysadmin-user">{me.fullName}</p>
              <p className="text-xs text-red-400/70 truncate font-mono">@{me.username}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="text-gray-400 hover:text-white hover:bg-gray-700"
              data-testid="btn-sysadmin-logout"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      <main className="flex-1 md:ml-64 flex flex-col min-h-screen">
        <div className="flex-1 p-4 w-full animate-in fade-in duration-500 overflow-x-hidden">
          {children}
        </div>
      </main>
    </div>
  );
}
