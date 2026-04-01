import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { useLocation } from "wouter";
import {
  FileText, Package, Users, ChevronRight, CheckCircle2, XCircle,
  Clock, ArrowUpRight, Filter, AlertCircle, Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/layout";

const CATEGORY_ICONS: Record<string, any> = {
  sales: FileText,
  purchases: Package,
  hr: Users,
};

const CATEGORY_COLORS: Record<string, string> = {
  sales: "bg-amber-50 text-amber-600 border-amber-200",
  purchases: "bg-violet-50 text-violet-600 border-violet-200",
  hr: "bg-teal-50 text-teal-600 border-teal-200",
};

const CATEGORY_BADGE_COLORS: Record<string, string> = {
  sales: "bg-amber-500",
  purchases: "bg-violet-500",
  hr: "bg-teal-500",
};

const CODE_COLORS: Record<string, string> = {
  QO: "bg-yellow-100 text-yellow-700",
  SO: "bg-orange-100 text-orange-700",
  IV: "bg-green-100 text-green-700",
  TIV: "bg-blue-100 text-blue-700",
  RC: "bg-cyan-100 text-cyan-700",
  PR: "bg-purple-100 text-purple-700",
  PO: "bg-indigo-100 text-indigo-700",
  AP: "bg-rose-100 text-rose-700",
  EXP: "bg-pink-100 text-pink-700",
  LEAVE: "bg-teal-100 text-teal-700",
  OT: "bg-emerald-100 text-emerald-700",
};

const LEAVE_TYPE_MAP: Record<string, string> = {
  sick: "ลาป่วย",
  vacation: "ลาพักร้อน",
  personal: "ลากิจ",
  maternity: "ลาคลอด",
  ordination: "ลาบวช",
  military: "ลาทหาร",
  other: "อื่นๆ",
};

const OT_TYPE_MAP: Record<string, string> = {
  regular: "วันปกติ",
  holiday: "วันหยุด",
  special: "พิเศษ",
};

function formatDate(d: string | null | undefined) {
  if (!d) return "-";
  const dt = new Date(d);
  const day = dt.getDate().toString().padStart(2, "0");
  const month = (dt.getMonth() + 1).toString().padStart(2, "0");
  const year = dt.getFullYear() + 543;
  return `${day}/${month}/${year}`;
}

function formatMoney(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ApprovalCenter() {
  const { selectedCompanyId } = useCompany();
  const [, setLocation] = useLocation();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery<any>({
    queryKey: ["/api/approval-center", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/approval-center?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: !!selectedCompanyId,
    refetchInterval: 60000,
  });

  const approveMutation = useMutation({
    mutationFn: async (params: { type: string; id: number; action: "approve" | "reject" }) => {
      let url = "";
      let method = "PATCH";
      let body: any = undefined;

      if (params.type === "LEAVE") {
        url = `/api/leaves/${params.id}/${params.action}`;
      } else if (params.type === "OT") {
        url = `/api/ot/${params.id}/${params.action}`;
      } else {
        const docRouteMap: Record<string, string> = {
          QO: "/api/quotations",
          SO: "/api/sales-orders",
          IV: "/api/invoices",
          TIV: "/api/tax-invoices",
          RC: "/api/receipts",
          PR: "/api/purchase-requests",
          PO: "/api/purchase-orders",
          AP: "/api/purchase-invoices",
          EXP: "/api/expenses",
        };
        const statusMap: Record<string, { approve: string; reject: string }> = {
          QO: { approve: "approved", reject: "rejected" },
          SO: { approve: "confirmed", reject: "cancelled" },
          IV: { approve: "sent", reject: "cancelled" },
          TIV: { approve: "issued", reject: "cancelled" },
          RC: { approve: "issued", reject: "cancelled" },
          PR: { approve: "approved", reject: "cancelled" },
          PO: { approve: "sent", reject: "cancelled" },
          AP: { approve: "approved", reject: "cancelled" },
          EXP: { approve: "approved", reject: "cancelled" },
        };
        url = `${docRouteMap[params.type]}/${params.id}`;
        body = JSON.stringify({ status: statusMap[params.type]?.[params.action] || "approved" });
      }

      const r = await fetch(url, {
        method,
        credentials: "include",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body,
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/approval-center"] });
      toast({ title: "สำเร็จ", description: "อัปเดตสถานะเรียบร้อย" });
    },
    onError: () => {
      toast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถอัปเดตสถานะได้", variant: "destructive" });
    },
  });

  const categories = data?.categories || [];
  const totalPending = data?.totalPending || 0;
  const visibleCategories = activeCategory
    ? categories.filter((c: any) => c.key === activeCategory)
    : categories;

  if (isLoading) {
    return (
      <Layout>
      <div className="flex flex-col items-center justify-center py-32" data-testid="approval-center-loading">
        <Loader2 className="h-8 w-8 animate-spin text-[#fb9678]" />
        <p className="mt-3 text-sm text-gray-400">กำลังโหลดข้อมูลการอนุมัติ...</p>
      </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
      <div className="flex flex-col items-center justify-center py-32 text-red-500" data-testid="approval-center-error">
        <AlertCircle className="h-8 w-8 mb-2" />
        <p className="text-sm">ไม่สามารถโหลดข้อมูลได้</p>
      </div>
      </Layout>
    );
  }

  return (
    <Layout>
    <div className="space-y-6" data-testid="approval-center-page">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800" data-testid="text-approval-title">ศูนย์อนุมัติ</h1>
          <p className="text-sm text-gray-500 mt-1">รวมทุกเรื่องที่รอการอนุมัติไว้ที่เดียว</p>
        </div>
        {totalPending > 0 && (
          <Badge className="bg-red-500 text-white text-base px-4 py-1.5" data-testid="badge-total-pending">
            <Clock className="h-4 w-4 mr-1.5" />
            รอดำเนินการ {totalPending} รายการ
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {categories.map((cat: any) => {
          const Icon = CATEGORY_ICONS[cat.key] || FileText;
          const isActive = activeCategory === cat.key;
          return (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(isActive ? null : cat.key)}
              className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                isActive ? "border-[#fb9678] bg-[#fff3ef] shadow-md" : "border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm"
              }`}
              data-testid={`filter-category-${cat.key}`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${CATEGORY_COLORS[cat.key]}`}>
                <Icon className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-500">{cat.label}</p>
                <p className="text-2xl font-bold text-gray-800">{cat.count}</p>
              </div>
              {cat.count > 0 && (
                <div className={`w-3 h-3 rounded-full animate-pulse ${CATEGORY_BADGE_COLORS[cat.key]}`} />
              )}
            </button>
          );
        })}
      </div>

      {totalPending === 0 && (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-gray-100" data-testid="approval-empty">
          <CheckCircle2 className="h-16 w-16 text-green-400 mb-4" />
          <p className="text-lg font-semibold text-gray-600">ไม่มีรายการรออนุมัติ</p>
          <p className="text-sm text-gray-400 mt-1">ทุกเรื่องได้รับการดำเนินการแล้ว</p>
        </div>
      )}

      {visibleCategories.map((cat: any) => {
        if (cat.count === 0) return null;
        const Icon = CATEGORY_ICONS[cat.key] || FileText;
        return (
          <div key={cat.key} className="bg-white rounded-2xl border border-gray-100 overflow-hidden" data-testid={`category-section-${cat.key}`}>
            <div className={`flex items-center gap-3 px-5 py-3.5 border-b ${CATEGORY_COLORS[cat.key]}`}>
              <Icon className="h-5 w-5" />
              <h2 className="text-base font-bold">{cat.label}</h2>
              <Badge className={`${CATEGORY_BADGE_COLORS[cat.key]} text-white text-xs ml-auto`}>{cat.count}</Badge>
            </div>

            <div className="divide-y divide-gray-50">
              {cat.docs.map((doc: any) => {
                if (doc.count === 0) return null;
                const isHR = cat.key === "hr";

                return (
                  <div key={doc.code} className="p-4" data-testid={`doc-group-${doc.code}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Badge className={`${CODE_COLORS[doc.code] || "bg-gray-100 text-gray-700"} font-mono text-xs`}>{doc.code}</Badge>
                        <span className="text-sm font-semibold text-gray-700">{doc.label}</span>
                        <span className="text-xs text-gray-400">({doc.count} รายการ)</span>
                      </div>
                      <button
                        onClick={() => setLocation(doc.href)}
                        className="text-xs text-[#fb9678] hover:underline flex items-center gap-1"
                        data-testid={`link-view-all-${doc.code}`}
                      >
                        ดูทั้งหมด <ArrowUpRight className="h-3 w-3" />
                      </button>
                    </div>

                    <div className="space-y-2">
                      {doc.items.slice(0, 10).map((item: any) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group"
                          data-testid={`approval-item-${doc.code}-${item.id}`}
                        >
                          <div className="flex-1 min-w-0">
                            {isHR ? (
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-gray-800">{item.employeeName}</span>
                                {doc.code === "LEAVE" && (
                                  <>
                                    <Badge variant="outline" className="text-xs">{LEAVE_TYPE_MAP[item.leaveType] || item.leaveType}</Badge>
                                    <span className="text-xs text-gray-500">{formatDate(item.startDate)} - {formatDate(item.endDate)} ({item.days} วัน)</span>
                                  </>
                                )}
                                {doc.code === "OT" && (
                                  <>
                                    <Badge variant="outline" className="text-xs">{OT_TYPE_MAP[item.otType] || item.otType}</Badge>
                                    <span className="text-xs text-gray-500">{formatDate(item.date)} • {item.hours} ชม. • ฿{formatMoney(item.amount)}</span>
                                  </>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-mono font-medium text-gray-800">{item.docNumber}</span>
                                <span className="text-xs text-gray-400">{formatDate(item.date)}</span>
                                {item.totalAmount > 0 && (
                                  <span className="text-sm font-semibold text-gray-700">฿{formatMoney(item.totalAmount)}</span>
                                )}
                              </div>
                            )}
                            {isHR && item.reason && (
                              <p className="text-xs text-gray-400 mt-0.5 truncate">เหตุผล: {item.reason}</p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 opacity-70 group-hover:opacity-100 transition-opacity">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-3 text-xs border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600"
                              onClick={() => approveMutation.mutate({ type: doc.code, id: item.id, action: "reject" })}
                              disabled={approveMutation.isPending}
                              data-testid={`btn-reject-${doc.code}-${item.id}`}
                            >
                              <XCircle className="h-3.5 w-3.5 mr-1" />
                              ปฏิเสธ
                            </Button>
                            <Button
                              size="sm"
                              className="h-8 px-3 text-xs bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => approveMutation.mutate({ type: doc.code, id: item.id, action: "approve" })}
                              disabled={approveMutation.isPending}
                              data-testid={`btn-approve-${doc.code}-${item.id}`}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                              อนุมัติ
                            </Button>
                          </div>
                        </div>
                      ))}

                      {doc.count > 10 && (
                        <button
                          onClick={() => setLocation(doc.href)}
                          className="w-full text-center py-2 text-xs text-[#fb9678] hover:underline"
                        >
                          ดูเพิ่มเติม {doc.count - 10} รายการ →
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
    </Layout>
  );
}
