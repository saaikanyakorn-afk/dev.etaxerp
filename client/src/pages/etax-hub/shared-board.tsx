import { useState, useEffect } from "react";
import { Share2, UserPlus, LogIn, Shield, BarChart3, FileText, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";

interface SharedBoardMeta {
  board: { id: number; name: string; color: string };
  companyName: string;
}

export default function SharedBoardPage() {
  const token = window.location.pathname.split("/shared/board/")[1];
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [meta, setMeta] = useState<SharedBoardMeta | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { setError("ลิงก์ไม่ถูกต้อง"); setLoading(false); return; }
    fetch(`/api/shared/board/${token}`)
      .then(r => { if (!r.ok) throw new Error("ไม่พบบอร์ดหรือยกเลิกการแชร์แล้ว"); return r.json(); })
      .then(async (d) => {
        setMeta({ board: d.board, companyName: d.companyName });
        if (user && (user as any).role === "client_external") {
          try {
            await fetch("/api/etax-hub/relink-board", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ boardToken: token }),
            });
            navigate("/etax-hub/board");
            return;
          } catch {}
        }
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [token, user]);

  const handleNavigate = (path: string) => {
    sessionStorage.setItem("returnTo", "/external-board");
    sessionStorage.setItem("shared_board_token", token);
    navigate(path);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin w-8 h-8 border-4 border-[#fb9678] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !meta) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Share2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">ไม่สามารถเข้าถึงบอร์ดได้</h2>
          <p className="text-gray-500">{error || "บอร์ดไม่พบหรือยกเลิกการแชร์แล้ว"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full py-4 px-6" style={{ background: "#fb9678" }}>
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">E-Tax Center</h1>
            <p className="text-xs text-white/80">ระบบบัญชีดิจิทัลครบวงจร</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg" style={{ backgroundColor: meta.board.color || "#539BFF" }}>
            <Share2 className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            คุณได้รับเชิญเข้าร่วมบอร์ด
          </h2>
          <p className="text-lg font-semibold" style={{ color: meta.board.color || "#539BFF" }}>
            "{meta.board.name}"
          </p>
          <p className="text-sm text-gray-500 mt-1">
            จาก {meta.companyName}
          </p>
        </div>

        <Card className="max-w-lg mx-auto shadow-lg border-none mb-8">
          <CardContent className="p-8 text-center space-y-5">
            <p className="text-gray-600 text-sm">
              เข้าสู่ระบบหรือสมัครสมาชิกเพื่อเข้าใช้งานโปรแกรม E-Tax Center
              และดูรายละเอียดบอร์ดนี้ได้ทันที
            </p>
            <div className="flex flex-col gap-3">
              <Button
                data-testid="button-register-shared"
                className="w-full h-12 text-base font-semibold"
                style={{ background: "#fb9678" }}
                onClick={() => handleNavigate("/external-register")}
              >
                <UserPlus className="w-5 h-5 mr-2" />
                สมัครสมาชิก (ฟรี)
              </Button>
              <Button
                data-testid="button-login-shared"
                variant="outline"
                className="w-full h-12 text-base font-semibold border-[#fb9678] text-[#fb9678] hover:bg-[#fb9678]/5"
                onClick={() => handleNavigate("/login")}
              >
                <LogIn className="w-5 h-5 mr-2" />
                เข้าสู่ระบบ
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
          <div className="flex items-start gap-3 p-4 bg-white rounded-xl border">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#03c9d7" }}>
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-gray-800">ติดตามงานแบบเรียลไทม์</h3>
              <p className="text-xs text-gray-500 mt-0.5">ดูสถานะงานและความคืบหน้าได้ทันที</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 bg-white rounded-xl border">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#05b187" }}>
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-gray-800">ปลอดภัยและเชื่อถือได้</h3>
              <p className="text-xs text-gray-500 mt-0.5">ข้อมูลถูกเข้ารหัสและจัดเก็บอย่างปลอดภัย</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 bg-white rounded-xl border">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#fb9678" }}>
              <CheckCircle className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-gray-800">ใช้งานง่าย</h3>
              <p className="text-xs text-gray-500 mt-0.5">ออกแบบมาสำหรับสำนักงานบัญชี</p>
            </div>
          </div>
        </div>
      </div>

      <div className="text-center py-6 text-xs text-gray-400">
        © E-Tax Center — ระบบบัญชีดิจิทัลครบวงจร
      </div>
    </div>
  );
}
