import { useState, useEffect } from "react";
import { useParams, useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock, FileText, Building2, User, DollarSign } from "lucide-react";

export default function ApproveByTokenPage() {
  const params = useParams<{ token: string }>();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const action = searchParams.get("action");

  const [request, setRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(action === "reject");
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    fetch(`/api/approval-requests/by-token/${params.token}`)
      .then((r) => {
        if (!r.ok) throw new Error("ไม่พบคำขออนุมัติ หรือลิงก์ไม่ถูกต้อง");
        return r.json();
      })
      .then((data) => {
        setRequest(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [params.token]);

  const handleApprove = async () => {
    setProcessing(true);
    try {
      const r = await fetch(`/api/approval-requests/by-token/${params.token}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message);
      setResult({ success: true, message: data.message || "อนุมัติเรียบร้อยแล้ว" });
      setRequest((prev: any) => ({ ...prev, status: "approved" }));
    } catch (err: any) {
      setResult({ success: false, message: err.message });
    }
    setProcessing(false);
  };

  const handleReject = async () => {
    setProcessing(true);
    try {
      const r = await fetch(`/api/approval-requests/by-token/${params.token}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason: rejectReason }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message);
      setResult({ success: true, message: data.message || "ปฏิเสธคำขอเรียบร้อยแล้ว" });
      setRequest((prev: any) => ({ ...prev, status: "rejected" }));
    } catch (err: any) {
      setResult({ success: false, message: err.message });
    }
    setProcessing(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-[#fb9678] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-red-600 mb-2">เกิดข้อผิดพลาด</h2>
            <p className="text-gray-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusConfig: Record<string, { icon: any; color: string; label: string }> = {
    pending: { icon: Clock, color: "text-amber-500", label: "รออนุมัติ" },
    approved: { icon: CheckCircle2, color: "text-green-500", label: "อนุมัติแล้ว" },
    rejected: { icon: XCircle, color: "text-red-500", label: "ไม่อนุมัติ" },
  };

  const st = statusConfig[request.status] || statusConfig.pending;
  const StatusIcon = st.icon;
  const amountText = request.amount
    ? `฿${Number(request.amount).toLocaleString("th-TH", { minimumFractionDigits: 2 })}`
    : "-";

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-lg">
        <CardHeader className="bg-[#FFF5F2] border-b">
          <CardTitle className="flex items-center gap-2 text-[#fb9678]">
            <FileText className="w-5 h-5" />
            ขออนุมัติเอกสาร
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <Badge className={`${st.color} bg-transparent border text-sm`}>
              <StatusIcon className="w-4 h-4 mr-1" />
              {st.label}
            </Badge>
            <Badge variant="outline">{request.documentType}</Badge>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <FileText className="w-4 h-4 text-gray-400 mt-0.5" />
              <div>
                <p className="text-gray-500 text-xs">ประเภทเอกสาร / เลขที่</p>
                <p className="font-medium">{request.documentTypeLabel}</p>
                <p className="text-gray-700">{request.documentNumber || "-"}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Building2 className="w-4 h-4 text-gray-400 mt-0.5" />
              <div>
                <p className="text-gray-500 text-xs">บริษัท / คู่ค้า</p>
                <p className="font-medium">{request.companyName}</p>
                <p className="text-gray-700">{request.contactName || "-"}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <DollarSign className="w-4 h-4 text-gray-400 mt-0.5" />
              <div>
                <p className="text-gray-500 text-xs">จำนวนเงิน</p>
                <p className="font-medium text-lg">{amountText}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <User className="w-4 h-4 text-gray-400 mt-0.5" />
              <div>
                <p className="text-gray-500 text-xs">ผู้ขออนุมัติ</p>
                <p className="font-medium">{request.requesterName || "-"}</p>
                <p className="text-gray-500 text-xs mt-1">
                  {request.requestedAt ? new Date(request.requestedAt).toLocaleString("th-TH") : ""}
                </p>
              </div>
            </div>

            {request.status !== "pending" && request.approverName && (
              <div className="flex items-start gap-3">
                <UserCheck className="w-4 h-4 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-gray-500 text-xs">ผู้อนุมัติ</p>
                  <p className="font-medium">{request.approverName}</p>
                  {request.approvedAt && (
                    <p className="text-gray-500 text-xs mt-1">
                      {new Date(request.approvedAt).toLocaleString("th-TH")}
                    </p>
                  )}
                </div>
              </div>
            )}

            {request.rejectedReason && (
              <div className="bg-red-50 p-3 rounded text-red-700 text-xs">
                <p className="font-medium">เหตุผลที่ไม่อนุมัติ:</p>
                <p>{request.rejectedReason}</p>
              </div>
            )}
          </div>

          {result && (
            <div
              className={`p-3 rounded text-sm ${
                result.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
              }`}
            >
              {result.message}
            </div>
          )}

          {request.status === "pending" && !result && (
            <div className="space-y-3 pt-2">
              {showRejectForm ? (
                <>
                  <Textarea
                    placeholder="เหตุผลที่ไม่อนุมัติ (ไม่บังคับ)"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="text-sm"
                    data-testid="input-reject-reason"
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={handleReject}
                      disabled={processing}
                      className="flex-1 bg-red-500 hover:bg-red-600"
                      data-testid="btn-confirm-reject"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      {processing ? "กำลังดำเนินการ..." : "ยืนยันไม่อนุมัติ"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowRejectForm(false)}
                      disabled={processing}
                    >
                      ยกเลิก
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex gap-2">
                  <Button
                    onClick={handleApprove}
                    disabled={processing}
                    className="flex-1 bg-[#05b187] hover:bg-[#049a74]"
                    data-testid="btn-approve"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    {processing ? "กำลังดำเนินการ..." : "อนุมัติ"}
                  </Button>
                  <Button
                    onClick={() => setShowRejectForm(true)}
                    disabled={processing}
                    variant="outline"
                    className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
                    data-testid="btn-reject"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    ไม่อนุมัติ
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function UserCheck(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <polyline points="16 11 18 13 22 9" />
    </svg>
  );
}
