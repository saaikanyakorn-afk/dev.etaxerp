import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Star, CheckCircle, Gift } from "lucide-react";
import LoyaltyMemberCard from "./loyalty-member-card";

export default function LoyaltySignup() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");

  if (mode === "card") {
    return <LoyaltyMemberCard />;
  }

  return <LoyaltySignupForm />;
}

function LoyaltySignupForm() {
  const params = new URLSearchParams(window.location.search);
  const companyId = params.get("companyId") || params.get("c");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  const { data: programData, isLoading } = useQuery({
    queryKey: ["/api/public/loyalty/program", companyId],
    queryFn: async () => {
      const r = await fetch(`/api/public/loyalty/program/${companyId}`);
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!companyId,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !companyId) return;
    setSubmitting(true);
    setError("");
    try {
      const r = await fetch(`/api/public/loyalty/signup/${companyId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() || undefined, email: email.trim() || undefined }),
      });
      const data = await r.json();
      if (r.status === 409) {
        setResult(data.member);
        setError("เบอร์โทรนี้เป็นสมาชิกอยู่แล้ว");
      } else if (!r.ok) {
        setError(data.message || "เกิดข้อผิดพลาด");
      } else {
        setResult(data.member);
      }
    } catch {
      setError("ไม่สามารถเชื่อมต่อได้");
    } finally {
      setSubmitting(false);
    }
  };

  if (!companyId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-amber-50 p-4">
        <p className="text-gray-500">ลิงก์ไม่ถูกต้อง</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-amber-50 p-4">
        <div className="animate-spin w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!programData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-amber-50 p-4">
        <Card className="p-6 text-center max-w-sm w-full">
          <p className="text-gray-500">ร้านนี้ยังไม่มีโปรแกรมสะสมแต้ม</p>
        </Card>
      </div>
    );
  }

  if (result && !error) {
    const cardUrl = `${window.location.origin}/loyalty/signup?mode=card&c=${companyId}&m=${result.memberCode}`;
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-amber-50 to-orange-50 p-4">
        <Card className="p-8 text-center max-w-sm w-full shadow-xl" data-testid="loyalty-signup-success">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-10 w-10 text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">สมัครสมาชิกสำเร็จ!</h2>
          <p className="text-gray-500 mb-4">{programData.companyName}</p>
          <div className="bg-amber-50 rounded-xl p-4 mb-4 border border-amber-200">
            <p className="text-sm text-gray-500">รหัสสมาชิก</p>
            <p className="text-3xl font-bold text-amber-600" data-testid="text-signup-member-code">{result.memberCode}</p>
            <p className="text-lg font-medium mt-1">{result.name}</p>
          </div>
          <div className="flex items-center justify-center gap-2 text-amber-600 mb-4">
            <Star className="h-5 w-5 fill-amber-400" />
            <span className="font-medium">{result.totalPoints || 0} แต้ม</span>
          </div>
          <Button
            className="w-full h-12 text-base bg-amber-500 hover:bg-amber-600"
            onClick={() => { window.location.href = cardUrl; }}
            data-testid="btn-open-card"
          >
            เปิดบัตรสมาชิก (QR Code)
          </Button>
          <p className="text-xs text-gray-400 mt-3">บันทึกลิงก์หรือ Bookmark หน้าบัตรสมาชิกไว้เพื่อใช้ตอนชำระเงิน</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-amber-50 to-orange-50 p-4">
      <Card className="p-6 max-w-sm w-full shadow-xl" data-testid="loyalty-signup-form">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Gift className="h-8 w-8 text-amber-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-800">สมัครสมาชิกสะสมแต้ม</h1>
          <p className="text-sm text-gray-500 mt-1">{programData.companyName}</p>
          <p className="text-xs text-amber-600 mt-2">
            <Star className="h-3 w-3 inline mr-1 fill-amber-400" />
            ทุก ฿{programData.program.spendAmount} ได้ {programData.program.pointsPerSpend} แต้ม
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">ชื่อ-นามสกุล *</label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="กรอกชื่อ-นามสกุล"
              required
              className="h-12 text-base"
              data-testid="input-signup-name"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">เบอร์โทรศัพท์</label>
            <Input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="08x-xxx-xxxx"
              type="tel"
              className="h-12 text-base"
              data-testid="input-signup-phone"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">อีเมล (ไม่บังคับ)</label>
            <Input
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="email@example.com"
              type="email"
              className="h-12 text-base"
              data-testid="input-signup-email"
            />
          </div>

          {error && (
            <div className="text-sm text-red-500 bg-red-50 p-3 rounded-lg" data-testid="text-signup-error">
              {error}
              {result && (
                <div className="mt-2 text-gray-600">
                  รหัสสมาชิก: <span className="font-bold text-amber-600">{result.memberCode}</span>
                  <br />แต้มสะสม: {result.totalPoints || 0} แต้ม
                  <Button
                    variant="link"
                    className="text-amber-600 p-0 h-auto text-sm"
                    onClick={() => {
                      window.location.href = `${window.location.origin}/loyalty/signup?mode=card&c=${companyId}&m=${result.memberCode}`;
                    }}
                  >
                    เปิดบัตรสมาชิก →
                  </Button>
                </div>
              )}
            </div>
          )}

          <Button
            type="submit"
            disabled={submitting || !name.trim()}
            className="w-full h-12 text-lg bg-amber-500 hover:bg-amber-600"
            data-testid="btn-signup-submit"
          >
            {submitting ? "กำลังสมัคร..." : "สมัครสมาชิก"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
