import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { useLocation } from "wouter";
import Layout from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Search, Truck, MapPin, Pen, Trash2, Eye, Send, Copy, ExternalLink, CheckCircle, Clock, Package, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDateSettings } from "@/hooks/use-date-settings";
import { formatDate } from "@/lib/format";

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: "ร่าง", color: "bg-gray-100 text-gray-700", icon: Clock },
  dispatched: { label: "กำลังจัดส่ง", color: "bg-blue-100 text-blue-700", icon: Truck },
  delivered: { label: "ส่งสำเร็จ", color: "bg-green-100 text-green-700", icon: CheckCircle },
  cancelled: { label: "ยกเลิก", color: "bg-red-100 text-red-700", icon: XCircle },
};

const SOURCE_MAP: Record<string, string> = {
  standalone: "สร้างเอง",
  quotation: "ใบเสนอราคา (QO)",
  invoice: "ใบแจ้งหนี้ (IV)",
};

export default function DeliveryNotesPage(props: { Wrapper?: React.ComponentType<{ children: React.ReactNode }>; basePath?: string } & Record<string, any>) {
  const LayoutComponent = props.Wrapper || Layout;
  const dnBasePath = props.basePath ? `${props.basePath}/delivery-notes` : "/delivery-notes";
  const { selectedCompanyId } = useCompany();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { dateEra, dateFmt } = useDateSettings();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [linkDialog, setLinkDialog] = useState<{ token: string; no: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/delivery-notes", selectedCompanyId, search, statusFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        companyId: String(selectedCompanyId),
        page: String(page),
        limit: "50",
      });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      const r = await fetch(`/api/delivery-notes?${params}`, { credentials: "include" });
      if (!r.ok) throw new Error("โหลดข้อมูลไม่สำเร็จ");
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/delivery-notes/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message); }
    },
    onSuccess: () => {
      toast({ title: "ลบใบส่งของสำเร็จ" });
      queryClient.invalidateQueries({ queryKey: ["/api/delivery-notes"] });
      setDeleteId(null);
    },
    onError: (e: any) => toast({ title: "เกิดข้อผิดพลาด", description: e.message, variant: "destructive" }),
  });

  const dispatchMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/delivery-notes/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "dispatched" }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message); }
    },
    onSuccess: () => {
      toast({ title: "อัปเดตสถานะเป็น กำลังจัดส่ง" });
      queryClient.invalidateQueries({ queryKey: ["/api/delivery-notes"] });
    },
    onError: (e: any) => toast({ title: "เกิดข้อผิดพลาด", description: e.message, variant: "destructive" }),
  });

  const rows = data?.data || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 50);

  const copySignLink = (token: string) => {
    const url = `${window.location.origin}/delivery-sign/${token}`;
    navigator.clipboard.writeText(url);
    toast({ title: "คัดลอกลิงก์แล้ว" });
  };

  return (
    <LayoutComponent>
    <div className="p-4 w-full overflow-x-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Truck className="h-6 w-6" style={{ color: "#fb9678" }} />
          <h1 className="text-xl font-bold">ใบส่งของ (Delivery Note)</h1>
          {total > 0 && <Badge variant="secondary" className="ml-2">{total} รายการ</Badge>}
        </div>
        <Button onClick={() => navigate(`${dnBasePath}/new`)} style={{ background: "#fb9678" }} data-testid="btn-new-delivery-note">
          <Plus className="h-4 w-4 mr-1" /> สร้างใบส่งของ
        </Button>
      </div>

      <Card className="p-3 mb-4">
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="ค้นหาเลขที่, ลูกค้า, คนส่ง..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9"
              data-testid="input-search-delivery"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === "all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-[160px]" data-testid="select-status-filter">
              <SelectValue placeholder="ทุกสถานะ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกสถานะ</SelectItem>
              <SelectItem value="draft">ร่าง</SelectItem>
              <SelectItem value="dispatched">กำลังจัดส่ง</SelectItem>
              <SelectItem value="delivered">ส่งสำเร็จ</SelectItem>
              <SelectItem value="cancelled">ยกเลิก</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">กำลังโหลด...</div>
      ) : rows.length === 0 ? (
        <Card className="text-center py-12">
          <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500">ยังไม่มีใบส่งของ</p>
          <Button variant="outline" className="mt-3" onClick={() => navigate(`${dnBasePath}/new`)} style={{ borderColor: "#fb9678", color: "#fb9678" }}>
            <Plus className="h-4 w-4 mr-1" /> สร้างใบแรก
          </Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((row: any) => {
            const st = STATUS_MAP[row.status] || STATUS_MAP.draft;
            const StIcon = st.icon;
            return (
              <Card key={row.id} className="p-3 hover:shadow-md transition-shadow cursor-pointer" data-testid={`card-delivery-${row.id}`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1" onClick={() => navigate(`${dnBasePath}/${row.id}`)}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm" style={{ color: "#fb9678" }}>{row.deliveryNo}</span>
                      <Badge className={`${st.color} text-xs`}>
                        <StIcon className="h-3 w-3 mr-1" />{st.label}
                      </Badge>
                      <Badge variant="outline" className="text-xs">{SOURCE_MAP[row.sourceType] || row.sourceType}</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>{row.customerName}</span>
                      <span className="text-gray-400">|</span>
                      <span>{formatDate(row.deliveryDate, dateEra, dateFmt)}</span>
                      {row.driverName && (
                        <>
                          <span className="text-gray-400">|</span>
                          <span className="flex items-center gap-1"><Truck className="h-3 w-3" />{row.driverName}</span>
                        </>
                      )}
                    </div>
                    {row.deliveryAddress && (
                      <div className="text-xs text-gray-400 mt-1 flex items-center gap-1 truncate">
                        <MapPin className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{row.deliveryAddress}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    {row.status === "draft" && (
                      <Button size="sm" variant="outline" onClick={() => dispatchMutation.mutate(row.id)}
                        style={{ borderColor: "#539BFF", color: "#539BFF" }} title="จัดส่ง" data-testid={`btn-dispatch-${row.id}`}>
                        <Send className="h-4 w-4" />
                      </Button>
                    )}
                    {row.publicToken && row.status !== "delivered" && (
                      <Button size="sm" variant="outline" onClick={() => setLinkDialog({ token: row.publicToken, no: row.deliveryNo })}
                        style={{ borderColor: "#03c9d7", color: "#03c9d7" }} title="ลิงก์เซ็นรับของ" data-testid={`btn-sign-link-${row.id}`}>
                        <Pen className="h-4 w-4" />
                      </Button>
                    )}
                    {row.status === "delivered" && row.signatureDataUrl && (
                      <Button size="sm" variant="outline" onClick={() => navigate(`${dnBasePath}/${row.id}`)}
                        style={{ borderColor: "#05b187", color: "#05b187" }} title="ดูลายเซ็น">
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                    {row.status !== "delivered" && (
                      <Button size="sm" variant="ghost" onClick={() => setDeleteId(row.id)} className="text-red-400 hover:text-red-600" data-testid={`btn-delete-${row.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>ก่อนหน้า</Button>
          <span className="text-sm self-center">{page}/{totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>ถัดไป</Button>
        </div>
      )}

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>ยืนยันการลบ</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">คุณต้องการลบใบส่งของนี้ใช่หรือไม่?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>ยกเลิก</Button>
            <Button variant="destructive" onClick={() => deleteId && deleteMutation.mutate(deleteId)} data-testid="btn-confirm-delete">ลบ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!linkDialog} onOpenChange={() => setLinkDialog(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>ลิงก์เซ็นรับของ — {linkDialog?.no}</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600 mb-2">ส่งลิงก์นี้ให้คนขับรถส่งของ เพื่อให้ลูกค้าเซ็นรับสินค้าบนมือถือ</p>
          <div className="flex gap-2">
            <Input readOnly value={linkDialog ? `${window.location.origin}/delivery-sign/${linkDialog.token}` : ""} className="text-xs" />
            <Button size="sm" onClick={() => linkDialog && copySignLink(linkDialog.token)} style={{ background: "#03c9d7" }}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" size="sm" onClick={() => linkDialog && window.open(`/delivery-sign/${linkDialog.token}`, "_blank")}
              style={{ borderColor: "#03c9d7", color: "#03c9d7" }}>
              <ExternalLink className="h-4 w-4 mr-1" /> เปิดหน้าเซ็น
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </LayoutComponent>
  );
}
