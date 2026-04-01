import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { WhtCertContent } from "./wht-cert-print";

export default function WhtCertShare() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/share/wht-cert/${token}`);
        if (res.ok) {
          setData(await res.json());
        } else {
          const err = await res.json();
          setError(err.message || "ไม่พบเอกสาร");
        }
      } catch {
        setError("เกิดข้อผิดพลาด");
      }
      setLoading(false);
    })();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" style={{ fontFamily: "Sarabun, sans-serif" }}>
        <div className="text-gray-500">กำลังโหลด...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" style={{ fontFamily: "Sarabun, sans-serif" }}>
        <div className="bg-white rounded-xl shadow p-8 text-center max-w-md">
          <div className="text-red-500 text-xl mb-2">ไม่พบเอกสาร</div>
          <p className="text-gray-500 text-sm">{error || "ลิงก์อาจหมดอายุหรือไม่ถูกต้อง"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8" style={{ fontFamily: "Sarabun, sans-serif" }}>
      <div className="max-w-3xl mx-auto px-4">
        <div className="text-center mb-4 print:hidden">
          <h1 className="text-lg font-bold text-gray-700">หนังสือรับรองการหักภาษี ณ ที่จ่าย (50 ทวิ)</h1>
          <p className="text-sm text-gray-400 mt-1">{data.company?.name || ""}</p>
          <button
            onClick={() => window.print()}
            className="mt-3 px-6 py-2 bg-purple-500 text-white rounded-full text-sm hover:bg-purple-600"
          >
            พิมพ์เอกสาร
          </button>
        </div>
        <WhtCertContent data={data} />
      </div>
    </div>
  );
}
