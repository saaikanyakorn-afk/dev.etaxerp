import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, ShoppingCart, DollarSign, Calendar, Tag, Plus, X,
  Send, Edit, Save, User, Phone, Mail, MessageSquare,
} from "lucide-react";

const PRESET_TAGS = ["VIP", "ลูกค้าประจำ", "ลูกค้าใหม่", "ลูกค้าเก่า", "ซื้อซ้ำ", "ขายส่ง", "ขายปลีก"];
const TAG_COLORS: Record<string, string> = {
  VIP: "bg-yellow-100 text-yellow-800 border-yellow-300",
  "ลูกค้าประจำ": "bg-green-100 text-green-800 border-green-300",
  "ลูกค้าใหม่": "bg-blue-100 text-blue-800 border-blue-300",
  "ลูกค้าเก่า": "bg-gray-100 text-gray-800 border-gray-300",
  "ซื้อซ้ำ": "bg-purple-100 text-purple-800 border-purple-300",
};

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<any>({});
  const [newTag, setNewTag] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["/api/crm/customers", id],
    queryFn: async () => {
      const r = await fetch(`/api/crm/customers/${id}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: any) => {
      const r = await fetch(`/api/crm/customers/${id}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "บันทึกสำเร็จ" });
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["/api/crm/customers", id] });
    },
  });

  const tagMutation = useMutation({
    mutationFn: async (tags: string[]) => {
      const r = await fetch(`/api/crm/customers/${id}/tags`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags }),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/customers", id] });
    },
  });

  const customer = data?.customer;
  const orders = data?.orders || [];
  const fmt = (n: any) => parseFloat(String(n || "0")).toLocaleString("th-TH", { minimumFractionDigits: 2 });

  if (isLoading) return <div className="p-6 text-center text-gray-400">กำลังโหลด...</div>;
  if (!customer) return <div className="p-6 text-center text-gray-400">ไม่พบข้อมูลลูกค้า</div>;

  const addTag = (tag: string) => {
    if (!tag.trim()) return;
    const currentTags = customer.tags || [];
    if (!currentTags.includes(tag)) {
      tagMutation.mutate([...currentTags, tag]);
    }
    setNewTag("");
  };

  const removeTag = (tag: string) => {
    const currentTags = (customer.tags || []).filter((t: string) => t !== tag);
    tagMutation.mutate(currentTags);
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/crm/customers")} data-testid="button-back">
          <ArrowLeft className="w-4 h-4 mr-1" /> กลับ
        </Button>
        <h1 className="text-xl font-bold text-gray-800" data-testid="text-customer-name">{customer.name}</h1>
        {(customer.tags || []).includes("VIP") && <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">VIP</Badge>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flexy-card p-4 rounded-xl border space-y-3 md:col-span-1">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-700">ข้อมูลลูกค้า</h3>
            {editing ? (
              <Button size="sm" className="bg-[#05b187] text-white" onClick={() => updateMutation.mutate(editData)} data-testid="button-save">
                <Save className="w-3 h-3 mr-1" /> บันทึก
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => { setEditing(true); setEditData({ name: customer.name, phone: customer.phone, email: customer.email, notes: customer.notes, lineUserId: customer.lineUserId }); }} data-testid="button-edit">
                <Edit className="w-3 h-3 mr-1" /> แก้ไข
              </Button>
            )}
          </div>

          {editing ? (
            <div className="space-y-2">
              <Input value={editData.name || ""} onChange={e => setEditData((p: any) => ({ ...p, name: e.target.value }))} placeholder="ชื่อ" />
              <Input value={editData.phone || ""} onChange={e => setEditData((p: any) => ({ ...p, phone: e.target.value }))} placeholder="เบอร์โทร" />
              <Input value={editData.email || ""} onChange={e => setEditData((p: any) => ({ ...p, email: e.target.value }))} placeholder="อีเมล" />
              <Input value={editData.lineUserId || ""} onChange={e => setEditData((p: any) => ({ ...p, lineUserId: e.target.value }))} placeholder="LINE User ID" />
              <textarea className="w-full border rounded-lg p-2 text-sm" value={editData.notes || ""} onChange={e => setEditData((p: any) => ({ ...p, notes: e.target.value }))} placeholder="หมายเหตุ" />
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2"><User className="w-4 h-4 text-gray-400" /> {customer.name}</div>
              <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-gray-400" /> {customer.phone || "-"}</div>
              <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-gray-400" /> {customer.email || "-"}</div>
              <div className="flex items-center gap-2"><MessageSquare className="w-4 h-4 text-gray-400" /> LINE: {customer.lineUserId || "-"}</div>
              {customer.notes && <div className="text-gray-500 text-xs mt-2 border-t pt-2">{customer.notes}</div>}
            </div>
          )}

          <div className="border-t pt-3">
            <h4 className="text-sm font-medium text-gray-600 mb-2 flex items-center gap-1"><Tag className="w-3 h-3" /> แท็ก</h4>
            <div className="flex flex-wrap gap-1 mb-2">
              {(customer.tags || []).map((tag: string) => (
                <span key={tag} className={`text-xs px-2 py-0.5 rounded border flex items-center gap-1 ${TAG_COLORS[tag] || "bg-gray-100 text-gray-600 border-gray-300"}`}>
                  {tag}
                  <button onClick={() => removeTag(tag)} className="hover:text-red-500"><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              {PRESET_TAGS.filter(t => !(customer.tags || []).includes(t)).map(t => (
                <button key={t} onClick={() => addTag(t)} className="text-xs px-2 py-0.5 rounded border border-dashed border-gray-300 text-gray-400 hover:text-gray-600 hover:border-gray-400">
                  + {t}
                </button>
              ))}
            </div>
            <div className="flex gap-1 mt-2">
              <Input size={1} placeholder="แท็กใหม่..." value={newTag} onChange={e => setNewTag(e.target.value)} className="text-xs h-7" onKeyDown={e => e.key === "Enter" && addTag(newTag)} />
              <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => addTag(newTag)} disabled={!newTag.trim()}>
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          </div>

          <div className="border-t pt-3 grid grid-cols-2 gap-2 text-center">
            <div className="bg-orange-50 rounded-lg p-2">
              <p className="text-xs text-gray-500">ยอดซื้อรวม</p>
              <p className="font-bold text-[#fb9678]">฿{fmt(customer.totalSpend)}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-2">
              <p className="text-xs text-gray-500">ออเดอร์</p>
              <p className="font-bold text-[#05b187]">{customer.orderCount || 0}</p>
            </div>
            <div className="bg-cyan-50 rounded-lg p-2">
              <p className="text-xs text-gray-500">เฉลี่ย/ออเดอร์</p>
              <p className="font-bold text-[#03c9d7]">฿{fmt(customer.averageOrderValue)}</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-2">
              <p className="text-xs text-gray-500">ซื้อล่าสุด</p>
              <p className="font-bold text-[var(--theme-primary)] text-xs">{customer.lastOrderDate ? new Date(customer.lastOrderDate).toLocaleDateString("th-TH") : "-"}</p>
            </div>
          </div>
        </div>

        <div className="flexy-card p-4 rounded-xl border md:col-span-2">
          <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" /> ประวัติการสั่งซื้อ ({orders.length})
          </h3>
          {orders.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">ยังไม่มีประวัติการสั่งซื้อ</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="p-2">เลขออเดอร์</th>
                    <th className="p-2">วันที่</th>
                    <th className="p-2">แพลตฟอร์ม</th>
                    <th className="p-2">สถานะ</th>
                    <th className="p-2 text-right">ยอดรวม</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o: any) => (
                    <tr key={o.id} className="border-b hover:bg-gray-50" data-testid={`row-order-${o.id}`}>
                      <td className="p-2 font-mono text-xs">{o.platformOrderId || o.id}</td>
                      <td className="p-2 text-xs">{o.orderDate ? new Date(o.orderDate).toLocaleDateString("th-TH") : "-"}</td>
                      <td className="p-2"><Badge variant="outline" className="text-xs">{o.platform}</Badge></td>
                      <td className="p-2">
                        <Badge variant="outline" className={`text-xs ${o.status === "shipped" || o.status === "delivered" ? "bg-green-50 text-green-700" : o.status === "cancelled" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"}`}>
                          {o.status}
                        </Badge>
                      </td>
                      <td className="p-2 text-right font-medium">฿{fmt(o.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}