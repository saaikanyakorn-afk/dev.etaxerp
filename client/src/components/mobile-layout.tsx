import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import {
  LayoutDashboard,
  Camera,
  ArrowLeft,
  User,
} from "lucide-react";

interface MobileLayoutProps {
  children: React.ReactNode;
  title?: string;
  showBack?: boolean;
}

export default function MobileLayout({ children, title, showBack }: MobileLayoutProps) {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/m/dashboard" },
    { icon: Camera, label: "Expense Snap", path: "/m/expense-snap" },
    { icon: User, label: "โปรไฟล์", path: "/settings/profile" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col" data-testid="mobile-layout">
      {title && (
        <header className="sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center gap-3 shadow-sm">
          {showBack && (
            <button
              onClick={() => window.history.back()}
              className="p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-95 transition-all"
              data-testid="button-mobile-back"
            >
              <ArrowLeft className="h-5 w-5 text-gray-700 dark:text-gray-300" />
            </button>
          )}
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate" data-testid="text-mobile-title">
            {title}
          </h1>
          <div className="ml-auto flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#03c9d7] to-[#fb9678] flex items-center justify-center text-white text-xs font-bold">
              {(user?.fullName || user?.username || "U").charAt(0).toUpperCase()}
            </div>
          </div>
        </header>
      )}

      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 safe-area-bottom" data-testid="mobile-bottom-nav">
        <div className="flex items-center justify-around px-2 py-1">
          {navItems.map((item) => {
            const isActive = location.startsWith(item.path);
            return (
              <button
                key={item.path}
                onClick={() => setLocation(item.path)}
                className={`flex flex-col items-center justify-center py-2 px-4 rounded-xl min-w-[72px] transition-all active:scale-95 ${
                  isActive
                    ? "text-[#03c9d7]"
                    : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
                }`}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, "-")}`}
              >
                <item.icon className={`h-5 w-5 ${isActive ? "stroke-[2.5]" : ""}`} />
                <span className={`text-[10px] mt-0.5 font-medium ${isActive ? "font-bold" : ""}`}>
                  {item.label}
                </span>
                {isActive && (
                  <div className="w-1 h-1 rounded-full bg-[#03c9d7] mt-0.5" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
