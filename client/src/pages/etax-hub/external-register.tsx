import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Eye, EyeOff, FileText, ArrowLeft, Share2 } from "lucide-react";

export default function ExternalRegisterPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [boardToken, setBoardToken] = useState("");
  const [boardMeta, setBoardMeta] = useState<{ boardName: string; companyName: string } | null>(null);

  useEffect(() => {
    const token = sessionStorage.getItem("shared_board_token") || "";
    setBoardToken(token);
    if (token) {
      fetch(`/api/shared/board/${token}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d) setBoardMeta({ boardName: d.board.name, companyName: d.companyName });
        })
        .catch(() => {});
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: "รหัสผ่านไม่ตรงกัน", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const r = await fetch("/api/auth/register-external", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, username, password, boardToken }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message);
      if (data.autoLogin) {
        toast({ title: "สมัครสมาชิกสำเร็จ" });
        window.location.href = "/etax-hub/board";
      } else {
        toast({ title: "สมัครสมาชิกสำเร็จ", description: "กรุณาเข้าสู่ระบบ" });
        sessionStorage.setItem("returnTo", "/etax-hub/board");
        navigate("/login");
      }
    } catch (err: any) {
      toast({ title: "สมัครไม่สำเร็จ", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#f6f6f6" }}>
      <div className="w-full py-4 px-6" style={{ background: "#fb9678" }}>
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">E-Tax Center</h1>
            <p className="text-xs text-white/80">สมัครสมาชิกเพื่อเข้าดูบอร์ด</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center py-8 px-4">
        <Card className="w-full max-w-lg border-none shadow-xl rounded-2xl">
          <CardHeader className="text-center pb-4 pt-6">
            {boardMeta && (
              <div className="mb-4 p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Share2 className="w-4 h-4 text-gray-400" />
                  <span className="text-xs text-gray-500">คุณได้รับเชิญเข้าร่วมบอร์ด</span>
                </div>
                <p className="font-semibold text-gray-800">{boardMeta.boardName}</p>
                <p className="text-xs text-gray-500">จาก {boardMeta.companyName}</p>
              </div>
            )}
            <h2 className="text-xl font-bold text-gray-800">สมัครสมาชิก</h2>
            <p className="text-sm text-gray-500">กรอกข้อมูลเพื่อเข้าใช้งาน</p>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="fullName">ชื่อ-นามสกุล</Label>
                <Input
                  data-testid="input-fullname"
                  id="fullName"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="ชื่อ นามสกุล"
                  required
                />
              </div>
              <div>
                <Label htmlFor="username">ชื่อผู้ใช้</Label>
                <Input
                  data-testid="input-username"
                  id="username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="username"
                  required
                  minLength={3}
                />
              </div>
              <div>
                <Label htmlFor="password">รหัสผ่าน</Label>
                <div className="relative">
                  <Input
                    data-testid="input-password"
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="อย่างน้อย 6 ตัวอักษร"
                    required
                    minLength={6}
                  />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                    onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <Label htmlFor="confirmPassword">ยืนยันรหัสผ่าน</Label>
                <Input
                  data-testid="input-confirm-password"
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="กรอกรหัสผ่านอีกครั้ง"
                  required
                />
              </div>
              <Button
                data-testid="button-register"
                type="submit"
                className="w-full h-11 text-base font-semibold"
                style={{ background: "#fb9678" }}
                disabled={isLoading}
              >
                {isLoading ? "กำลังสมัคร..." : <><UserPlus className="w-4 h-4 mr-2" /> สมัครสมาชิก</>}
              </Button>
            </form>
            <div className="text-center mt-4">
              <button
                data-testid="button-back-login"
                className="text-sm text-[#fb9678] hover:underline inline-flex items-center gap-1"
                onClick={() => {
                  sessionStorage.setItem("returnTo", "/external-board");
                  navigate("/login");
                }}
              >
                <ArrowLeft className="w-3 h-3" /> มีบัญชีอยู่แล้ว? เข้าสู่ระบบ
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
