import { useState } from "react";
import { useShowMore } from "@/hooks/use-show-more";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Search, Users, Crown, ShoppingCart, DollarSign, RefreshCw,
  Plus, Send, Tag, ChevronDown, UserPlus,
} from "lucide-react";

const TAG_COLORS: Record<string, string> = {
  VIP: "bg-yellow-100 text-yellow-800 border-yellow-300",
  "ลูกค้าประจำ": "bg-green-100 text-green-800 border-green-300",
  "ลูกค้าใหม่": "bg-blue-100 text-blue-800 border-blue-300",
  "ลูกค้าเก่า": "bg-gray-100 text-gray-800 border-gray-300",
  "ซื้อซ้ำ": "bg-purple-100 text-purple-800 border-purple-300",
};

export default function CustomerList() {
  const { selectedCompanyId } = useCompany();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [sortBy, setSortBy] = useState("totalSpend");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showLineDialog, setShowLineDialog] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [lineMessage, setLineMessage] = useState("");
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", email: "", notes: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["/api/crm/customers", selectedCompanyId, search, tagFilter, sortBy],
    queryFn: async () => {
      const params = new URLSearchParams({ companyId: String(selectedCompanyId) });
      if (search) params.set("search", search);
      if (tagFilter) params.set("tag", tagFilter);
      params.set("sortBy", sortBy);
      params.set("limit", "100");
      const r = await fetch(`/api/crm/customers?${params}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: summary } = useQuery({
    queryKey: ["/api/crm/summary", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/crm/summary?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: allTags } = useQuery({
    queryKey: ["/api/crm/tags", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/crm/tags?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/crm/sync-from-orders", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: selectedCompanyId }),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: (data) => {
      toast({ title: "ซิงค์สำเร็จ", description: `สร้างใหม่ ${data.created} อัปเดต ${data.updated} รายการ` });
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/crm") });
    },
    onError: () => toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" }),
  });

  const addMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/crm/customers", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, companyId: selectedCompanyId }),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "เพิ่มลูกค้าสำเร็จ" });
      setShowAddDialog(false);
      setNewCustomer({ name: "", phone: "", email: "", notes: "" });
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/crm") });
    },
  });

  const lineMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/crm/send-line", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: selectedCompanyId, customerIds: selectedIds, message: lineMessage }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.message); }
      return r.json();
    },
    onSuccess: (data) => {
      toast({ title: "ส่ง LINE สำเร็จ", description: `ส่งได้ ${data.sent} จาก ${data.total} ราย` });
      setShowLineDialog(false);
      setLineMessage("");
      setSelectedIds([]);
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    if (data?.customers?.length && selectedIds.length === data.customers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(data?.customers?.map((c: any) => c.id) || []);
    }
  };

  const fmt = (n: any) => parseFloat(String(n || "0")).toLocaleString("th-TH", { minimumFractionDigits: 2 });

  const customers = data?.customers || [];
  const total = data?.total || 0;
  const { visibleItems, hasMore, remainingCount, totalCount, showMore } = useShowMore(customers);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-800" data-testid="text-crm-title">CRM ลูกค้า</h1>
          <p className="text-sm text-gray-500">จัดการข้อมูลลูกค้า แท็ก และส่งโปรโมชันผ่าน LINE</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending} data-testid="button-sync-orders">
            <RefreshCw className={`w-4 h-4 mr-1 ${syncMutation.isPending ? "animate-spin" : ""}`} />
            ซิงค์จากออเดอร์
          </Button>
          <Button size="sm" className="bg-[#fb9678] hover:bg-[#e8856a] text-white" onClick={() => setShowAddDialog(true)} data-testid="button-add-customer">
            <UserPlus className="w-4 h-4 mr-1" /> เพิ่มลูกค้า
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "ลูกค้าทั้งหมด", value: summary?.totalCustomers || 0, icon: Users, color: "text-[var(--theme-primary)]", bg: "bg-blue-50" },
          { label: "ลูกค้า VIP", value: summary?.vipCustomers || 0, icon: Crown, color: "text-[#fec90f]", bg: "bg-yellow-50" },
          { label: "ยอดสั่งซื้อทั้งหมด", value: summary?.totalOrders || 0, icon: ShoppingCart, color: "text-[#05b187]", bg: "bg-green-50" },
          { label: "รายได้รวม", value: `฿${fmt(summary?.totalRevenue)}`, icon: DollarSign, color: "text-[#fb9678]", bg: "bg-orange-50" },
          { label: "ค่าเฉลี่ยต่อออเดอร์", value: `฿${fmt(summary?.avgOrderValue)}`, icon: ShoppingCart, color: "text-[#03c9d7]", bg: "bg-cyan-50" },
        ].map((kpi, i) => (
          <div key={i} className={`flexy-card p-3 ${kpi.bg} border rounded-xl`} data-testid={`card-kpi-${i}`}>
            <div className="flex items-center gap-2 mb-1">
              <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
              <span className="text-xs text-gray-500">{kpi.label}</span>
            </div>
            <p className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="flexy-card p-4 rounded-xl border">
        <div className="flex flex-wrap gap-2 mb-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <Input placeholder="ค้นหาชื่อ, เบอร์โทร, อีเมล..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" data-testid="input-search" />
          </div>
          <select value={tagFilter} onChange={e => setTagFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" data-testid="select-tag-filter">
            <option value="">แท็กทั้งหมด</option>
            {(allTags || []).map((t: string) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" data-testid="select-sort">
            <option value="totalSpend">ยอดซื้อสูงสุด</option>
            <option value="orderCount">จำนวนออเดอร์</option>
            <option value="lastOrderDate">ซื้อล่าสุด</option>
            <option value="name">ชื่อ ก-ฮ</option>
          </select>
        </div>

        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2 mb-3 bg-[#fb9678]/10 p-2 rounded-lg">
            <span className="text-sm font-medium">เลือก {selectedIds.length} รายการ</span>
            <Button size="sm" variant="outline" className="border-[#03c9d7] text-[#03c9d7]" onClick={() => setShowLineDialog(true)} data-testid="button-send-line">
              <Send className="w-3 h-3 mr-1" /> ส่ง LINE
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-8 text-gray-400">กำลังโหลด...</div>
        ) : customers.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>ยังไม่มีข้อมูลลูกค้า</p>
            <p className="text-xs mt-1">กดปุ่ม "ซิงค์จากออเดอร์" เพื่อดึงข้อมูลจากออเดอร์ e-commerce</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="p-2 w-8">
                    <input type="checkbox" checked={selectedIds.length === customers.length && customers.length > 0} onChange={toggleAll} data-testid="checkbox-select-all" />
                  </th>
                  <th className="p-2">ชื่อลูกค้า</th>
                  <th className="p-2">เบอร์โทร</th>
                  <th className="p-2">แพลตฟอร์ม</th>
                  <th className="p-2">แท็ก</th>
                  <th className="p-2 text-right">ออเดอร์</th>
                  <th className="p-2 text-right">ยอดซื้อรวม</th>
                  <th className="p-2 text-right">เฉลี่ย/ออเดอร์</th>
                  <th className="p-2">ซื้อล่าสุด</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((c: any) => (
                  <tr key={c.id} className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/crm/customers/${c.id}`)} data-testid={`row-customer-${c.id}`}>
                    <td className="p-2" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => toggleSelect(c.id)} />
                    </td>
                    <td className="p-2 font-medium">{c.name}</td>
                    <td className="p-2 text-gray-500">{c.phone || "-"}</td>
                    <td className="p-2">
                      {c.platform && <Badge variant="outline" className="text-xs">{c.platform}</Badge>}
                    </td>
                    <td className="p-2">
                      <div className="flex gap-1 flex-wrap">
                        {(c.tags || []).map((tag: string) => (
                          <span key={tag} className={`text-xs px-1.5 py-0.5 rounded border ${TAG_COLORS[tag] || "bg-gray-100 text-gray-600 border-gray-300"}`}>{tag}</span>
                        ))}
                      </div>
                    </td>
                    <td className="p-2 text-right">{c.orderCount || 0}</td>
                    <td className="p-2 text-right font-medium text-[#05b187]">฿{fmt(c.totalSpend)}</td>
                    <td className="p-2 text-right">฿{fmt(c.averageOrderValue)}</td>
                    <td className="p-2 text-xs text-gray-500">
                      {c.lastOrderDate ? new Date(c.lastOrderDate).toLocaleDateString("th-TH") : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {hasMore && (
              <div className="text-center py-3 border-t">
                <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); showMore(); }} className="text-sm font-medium hover:opacity-80 hover:underline cursor-pointer py-1 px-3" style={{ color: "var(--theme-primary)" }} data-testid="button-show-more">
                  แสดงเพิ่มเติม ({remainingCount} รายการ)
                </button>
              </div>
            )}
            {!hasMore && totalCount > 50 && (
              <div className="text-center py-2 text-xs text-muted-foreground">
                แสดงทั้งหมด {totalCount} รายการ
              </div>
            )}
            <div className="text-xs text-gray-400 mt-2 text-right">แสดง {visibleItems.length} จาก {total} รายการ</div>
          </div>
        )}
      </div>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>เพิ่มลูกค้าใหม่</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="ชื่อลูกค้า *" value={newCustomer.name} onChange={e => setNewCustomer(p => ({ ...p, name: e.target.value }))} data-testid="input-new-name" />
            <Input placeholder="เบอร์โทร" value={newCustomer.phone} onChange={e => setNewCustomer(p => ({ ...p, phone: e.target.value }))} data-testid="input-new-phone" />
            <Input placeholder="อีเมล" value={newCustomer.email} onChange={e => setNewCustomer(p => ({ ...p, email: e.target.value }))} data-testid="input-new-email" />
            <Input placeholder="หมายเหตุ" value={newCustomer.notes} onChange={e => setNewCustomer(p => ({ ...p, notes: e.target.value }))} data-testid="input-new-notes" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>ยกเลิก</Button>
            <Button className="bg-[#fb9678] hover:bg-[#e8856a] text-white" onClick={() => addMutation.mutate(newCustomer)} disabled={!newCustomer.name || addMutation.isPending} data-testid="button-confirm-add">
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showLineDialog} onOpenChange={setShowLineDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>ส่งข้อความ LINE</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-500">ส่งถึงลูกค้า {selectedIds.length} รายที่เลือก (เฉพาะที่มี LINE User ID)</p>
          <textarea className="w-full border rounded-lg p-3 text-sm min-h-[100px]" placeholder="พิมพ์ข้อความโปรโมชัน..." value={lineMessage} onChange={e => setLineMessage(e.target.value)} data-testid="textarea-line-message" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLineDialog(false)}>ยกเลิก</Button>
            <Button className="bg-[#05b187] hover:bg-[#049a75] text-white" onClick={() => lineMutation.mutate()} disabled={!lineMessage || lineMutation.isPending} data-testid="button-confirm-send-line">
              <Send className="w-4 h-4 mr-1" /> ส่ง LINE
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}