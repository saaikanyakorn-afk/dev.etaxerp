import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { FolderArchive, Loader2, Eye, EyeOff } from "lucide-react";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useToast } from "@/hooks/use-toast";

export default function LegacyLoginPage() {
  const [, setLocation] = useLocation();
  const { user, login } = useAuth();
  const { colors: themeColors } = useThemeColor();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) setLocation("/legacy-import");
  }, [user, setLocation]);

  if (user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    setLoading(true);
    try {
      await login(username, password);
      setLocation("/legacy-import");
    } catch (err: any) {
      toast({ title: "เข้าสู่ระบบไม่สำเร็จ", description: err.message || "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-sm shadow-lg">
        <div
          className="rounded-t-lg px-6 py-5 flex items-center gap-3"
          style={{ background: themeColors.primary }}
        >
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white">
            <FolderArchive className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">TRCloud Archive</h1>
            <p className="text-xs text-white/70">Legacy Data Viewer</p>
          </div>
        </div>
        <CardContent className="pt-6 pb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">ชื่อผู้ใช้</label>
              <Input
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Username"
                autoComplete="username"
                data-testid="input-legacy-username"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">รหัสผ่าน</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Password"
                  autoComplete="current-password"
                  data-testid="input-legacy-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full text-white"
              style={{ background: themeColors.primary }}
              data-testid="button-legacy-login"
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />กำลังเข้าสู่ระบบ...</>
              ) : (
                "เข้าสู่ระบบ"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
