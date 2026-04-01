import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  TrendingUp, DollarSign, MousePointer, Eye, Target, Plus,
  Trash2, Edit, BarChart3, Megaphone, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import ThaiDateInput from "@/components/thai-date-input";
import { useDateSettings } from "@/hooks/use-date-settings";
import { toLocalDateStr } from "@/lib/utils";

const AD_PLATFORMS = [
  { value: "facebook", label: "Facebook Ads", color: "bg-blue-100 text-blue-700" },
  { value: "google", label: "Google Ads", color: "bg-red-100 text-red-700" },
  { value: "tiktok", label: "TikTok Ads", color: "bg-gray-800 text-white" },
  { value: "line", label: "LINE Ads", color: "bg-green-100 text-green-700" },
  { value: "shopee", label: "Shopee Ads", color: "bg-orange-100 text-orange-700" },
  { value: "lazada", label: "Lazada Ads", color: "bg-purple-100 text-purple-700" },
  { value: "instagram", label: "Instagram Ads", color: "bg-pink-100 text-pink-700" },
  { value: "other", label: "อื่นๆ", color: "bg-gray-100 text-gray-700" },
];

export default function AdTracking() {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { dateEra, dateFmt } = useDateSettings();
  const [activeTab, setActiveTab] = useState<"dashboard" | "campaigns" | "spend">("dashboard");
  const [showCampaignDialog, setShowCampaignDialog] = useState(false);
  const [showSpendDialog, setShowSpendDialog] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<any>(null);
  const [newCampaign, setNewCampaign] = useState({ name: "", platform: "facebook", notes: "" });
  const [newSpend, setNewSpend] = useState({ campaignId: "", platform: "facebook", spendDate: toLocalDateStr(new Date()), amount: "", impressions: "", clicks: "", conversions: "", revenue: "", notes: "" });

  const now = new Date();
  const [startDate, setStartDate] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`);
  const [endDate, setEndDate] = useState(toLocalDateStr(now));

  const { data: summary } = useQuery({
    queryKey: ["/api/ads/summary", selectedCompanyId, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({ companyId: String(selectedCompanyId), startDate, endDate });
      const r = await fetch(`/api/ads/summary?${params}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: campaigns } = useQuery({
    queryKey: ["/api/ads/campaigns", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/ads/campaigns?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: spendEntries } = useQuery({
    queryKey: ["/api/ads/spend", selectedCompanyId, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({ companyId: String(selectedCompanyId), startDate, endDate });
      const r = await fetch(`/api/ads/spend?${params}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const addCampaignMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = editingCampaign ? `/api/ads/campaigns/${editingCampaign.id}` : "/api/ads/campaigns";
      const method = editingCampaign ? "PUT" : "POST";
      const r = await fetch(url, {
        method, credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, companyId: selectedCompanyId }),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: editingCampaign ? "แก้ไขสำเร็จ" : "เพิ่มแคมเปญสำเร็จ" });
      setShowCampaignDialog(false);
      setEditingCampaign(null);
      setNewCampaign({ name: "", platform: "facebook", notes: "" });
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/ads") });
    },
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/ads/campaigns/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      toast({ title: "ลบแคมเปญสำเร็จ" });
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/ads") });
    },
  });

  const addSpendMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/ads/spend", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, companyId: selectedCompanyId }),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "บันทึกค่าโฆษณาสำเร็จ" });
      setShowSpendDialog(false);
      setNewSpend({ campaignId: "", platform: "facebook", spendDate: toLocalDateStr(new Date()), amount: "", impressions: "", clicks: "", conversions: "", revenue: "", notes: "" });
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/ads") });
    },
  });

  const deleteSpendMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/ads/spend/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      toast({ title: "ลบรายการสำเร็จ" });
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/ads") });
    },
  });

  const fmt = (n: any) => parseFloat(String(n || "0")).toLocaleString("th-TH", { minimumFractionDigits: 2 });
  const fmtInt = (n: any) => parseInt(String(n || "0")).toLocaleString("th-TH");
  const getPlatformInfo = (p: string) => AD_PLATFORMS.find(a => a.value === p) || AD_PLATFORMS[AD_PLATFORMS.length - 1];

  const maxSpend = useMemo(() => {
    if (!summary?.byPlatform?.length) return 1;
    return Math.max(...summary.byPlatform.map((p: any) => parseFloat(p.totalSpend || "0")), 1);
  }, [summary]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-800" data-testid="text-ads-title">ต้นทุนโฆษณา & ROAS</h1>
          <p className="text-sm text-gray-500">ติดตามค่าโฆษณา วิเคราะห์ผลตอบแทน เปรียบเทียบแพลตฟอร์ม</p>
        </div>
        <div className="flex gap-2">
          <ThaiDateInput value={startDate} onChange={setStartDate} dateEra={dateEra} dateFmt={dateFmt} className="w-[160px]" data-testid="input-start-date" />
          <ThaiDateInput value={endDate} onChange={setEndDate} dateEra={dateEra} dateFmt={dateFmt} className="w-[160px]" data-testid="input-end-date" />
        </div>
      </div>

      <div className="flex gap-1 border-b">
        {[
          { key: "dashboard", label: "ภาพรวม", icon: BarChart3 },
          { key: "campaigns", label: "แคมเปญ", icon: Megaphone },
          { key: "spend", label: "รายการค่าโฆษณา", icon: DollarSign },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center gap-1 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key ? "border-[#fb9678] text-[#fb9678]" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            data-testid={`tab-${tab.key}`}>
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "dashboard" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "ค่าโฆษณารวม", value: `฿${fmt(summary?.totalSpend)}`, icon: DollarSign, color: "text-[#f94d4d]", bg: "bg-red-50" },
              { label: "ROAS", value: `${summary?.roas || "0.00"}x`, icon: TrendingUp, color: parseFloat(summary?.roas || "0") >= 3 ? "text-[#05b187]" : "text-[#fec90f]", bg: parseFloat(summary?.roas || "0") >= 3 ? "bg-green-50" : "bg-yellow-50" },
              { label: "รายได้จากออเดอร์", value: `฿${fmt(summary?.totalRevenue)}`, icon: DollarSign, color: "text-[#05b187]", bg: "bg-green-50" },
              { label: "ออเดอร์ทั้งหมด", value: fmtInt(summary?.totalOrders), icon: Target, color: "text-[var(--theme-primary)]", bg: "bg-blue-50" },
            ].map((kpi, i) => (
              <div key={i} className={`flexy-card p-3 ${kpi.bg} border rounded-xl`} data-testid={`card-ads-kpi-${i}`}>
                <div className="flex items-center gap-2 mb-1">
                  <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                  <span className="text-xs text-gray-500">{kpi.label}</span>
                </div>
                <p className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Impressions", value: fmtInt(summary?.totalImpressions), icon: Eye },
              { label: "Clicks", value: fmtInt(summary?.totalClicks), icon: MousePointer },
              { label: "CTR", value: `${summary?.ctr || "0.00"}%`, icon: MousePointer },
              { label: "CPC", value: `฿${fmt(summary?.cpc)}`, icon: DollarSign },
            ].map((kpi, i) => (
              <div key={i} className="flexy-card p-3 border rounded-xl" data-testid={`card-ads-metric-${i}`}>
                <div className="flex items-center gap-2 mb-1">
                  <kpi.icon className="w-4 h-4 text-gray-400" />
                  <span className="text-xs text-gray-500">{kpi.label}</span>
                </div>
                <p className="text-lg font-bold text-gray-700">{kpi.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flexy-card p-4 border rounded-xl">
              <h3 className="font-semibold text-gray-700 mb-3">ค่าโฆษณาตามแพลตฟอร์ม</h3>
              {(summary?.byPlatform || []).length === 0 ? (
                <div className="text-center py-6 text-gray-400 text-sm">ยังไม่มีข้อมูล</div>
              ) : (
                <div className="space-y-3">
                  {(summary?.byPlatform || []).map((p: any) => {
                    const info = getPlatformInfo(p.platform);
                    const spend = parseFloat(p.totalSpend || "0");
                    const pctWidth = (spend / maxSpend) * 100;
                    const platformRoas = spend > 0 ? (parseFloat(p.totalRevenue || "0") / spend) : 0;
                    return (
                      <div key={p.platform}>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded ${info.color}`}>{info.label}</span>
                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-gray-500">ROAS: <span className={platformRoas >= 3 ? "text-green-600 font-bold" : "text-yellow-600 font-bold"}>{platformRoas.toFixed(2)}x</span></span>
                            <span className="font-medium">฿{fmt(p.totalSpend)}</span>
                          </div>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-[#fb9678] rounded-full" style={{ width: `${pctWidth}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flexy-card p-4 border rounded-xl">
              <h3 className="font-semibold text-gray-700 mb-3">ค่าโฆษณารายเดือน</h3>
              {(summary?.byMonth || []).length === 0 ? (
                <div className="text-center py-6 text-gray-400 text-sm">ยังไม่มีข้อมูล</div>
              ) : (
                <div className="space-y-2">
                  {(summary?.byMonth || []).map((m: any) => {
                    const [year, month] = m.month.split("-");
                    const thaiYear = parseInt(year) + 543;
                    const monthNames = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
                    return (
                      <div key={m.month} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                        <span className="text-sm font-medium">{monthNames[parseInt(month) - 1]} {thaiYear}</span>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-gray-500">{fmtInt(m.totalClicks)} clicks</span>
                          <span className="font-bold text-[#fb9678]">฿{fmt(m.totalSpend)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "campaigns" && (
        <div className="flexy-card p-4 border rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-700">แคมเปญโฆษณา</h3>
            <Button size="sm" className="bg-[#fb9678] hover:bg-[#e8856a] text-white" onClick={() => { setEditingCampaign(null); setNewCampaign({ name: "", platform: "facebook", notes: "" }); setShowCampaignDialog(true); }} data-testid="button-add-campaign">
              <Plus className="w-4 h-4 mr-1" /> เพิ่มแคมเปญ
            </Button>
          </div>
          {(campaigns || []).length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              <Megaphone className="w-10 h-10 mx-auto mb-2 opacity-30" />
              ยังไม่มีแคมเปญ กดปุ่มเพิ่มเพื่อเริ่มต้น
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="p-2">ชื่อแคมเปญ</th>
                    <th className="p-2">แพลตฟอร์ม</th>
                    <th className="p-2">สถานะ</th>
                    <th className="p-2">หมายเหตุ</th>
                    <th className="p-2 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {(campaigns || []).map((c: any) => {
                    const info = getPlatformInfo(c.platform);
                    return (
                      <tr key={c.id} className="border-b hover:bg-gray-50" data-testid={`row-campaign-${c.id}`}>
                        <td className="p-2 font-medium">{c.name}</td>
                        <td className="p-2"><span className={`text-xs px-2 py-0.5 rounded ${info.color}`}>{info.label}</span></td>
                        <td className="p-2">
                          <Badge variant="outline" className={c.status === "active" ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-500"}>{c.status === "active" ? "ใช้งาน" : "หยุด"}</Badge>
                        </td>
                        <td className="p-2 text-gray-500 text-xs">{c.notes || "-"}</td>
                        <td className="p-2 text-right">
                          <Button size="sm" variant="ghost" onClick={() => { setEditingCampaign(c); setNewCampaign({ name: c.name, platform: c.platform, notes: c.notes || "" }); setShowCampaignDialog(true); }}>
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-red-500" onClick={() => { if (confirm("ลบแคมเปญนี้?")) deleteCampaignMutation.mutate(c.id); }}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "spend" && (
        <div className="flexy-card p-4 border rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-700">รายการค่าโฆษณา</h3>
            <Button size="sm" className="bg-[#fb9678] hover:bg-[#e8856a] text-white" onClick={() => setShowSpendDialog(true)} data-testid="button-add-spend">
              <Plus className="w-4 h-4 mr-1" /> บันทึกค่าโฆษณา
            </Button>
          </div>
          {(spendEntries || []).length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              <DollarSign className="w-10 h-10 mx-auto mb-2 opacity-30" />
              ยังไม่มีรายการค่าโฆษณาในช่วงเวลาที่เลือก
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="p-2">วันที่</th>
                    <th className="p-2">แพลตฟอร์ม</th>
                    <th className="p-2">แคมเปญ</th>
                    <th className="p-2 text-right">ค่าโฆษณา</th>
                    <th className="p-2 text-right">Impressions</th>
                    <th className="p-2 text-right">Clicks</th>
                    <th className="p-2 text-right">Conversions</th>
                    <th className="p-2 text-right">รายได้</th>
                    <th className="p-2 text-right">ROAS</th>
                    <th className="p-2 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {(spendEntries || []).map((s: any) => {
                    const info = getPlatformInfo(s.platform);
                    const spend = parseFloat(s.amount || "0");
                    const rev = parseFloat(s.revenue || "0");
                    const roas = spend > 0 ? rev / spend : 0;
                    const campaign = (campaigns || []).find((c: any) => c.id === s.campaignId);
                    return (
                      <tr key={s.id} className="border-b hover:bg-gray-50" data-testid={`row-spend-${s.id}`}>
                        <td className="p-2 text-xs">{new Date(s.spendDate).toLocaleDateString("th-TH")}</td>
                        <td className="p-2"><span className={`text-xs px-2 py-0.5 rounded ${info.color}`}>{info.label}</span></td>
                        <td className="p-2 text-xs">{campaign?.name || "-"}</td>
                        <td className="p-2 text-right font-medium text-[#f94d4d]">฿{fmt(s.amount)}</td>
                        <td className="p-2 text-right">{fmtInt(s.impressions)}</td>
                        <td className="p-2 text-right">{fmtInt(s.clicks)}</td>
                        <td className="p-2 text-right">{fmtInt(s.conversions)}</td>
                        <td className="p-2 text-right text-[#05b187]">฿{fmt(s.revenue)}</td>
                        <td className="p-2 text-right">
                          <span className={`font-bold ${roas >= 3 ? "text-green-600" : roas >= 1 ? "text-yellow-600" : "text-red-600"}`}>{roas.toFixed(2)}x</span>
                        </td>
                        <td className="p-2 text-right">
                          <Button size="sm" variant="ghost" className="text-red-500" onClick={() => { if (confirm("ลบรายการนี้?")) deleteSpendMutation.mutate(s.id); }}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Dialog open={showCampaignDialog} onOpenChange={setShowCampaignDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingCampaign ? "แก้ไขแคมเปญ" : "เพิ่มแคมเปญใหม่"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="ชื่อแคมเปญ *" value={newCampaign.name} onChange={e => setNewCampaign(p => ({ ...p, name: e.target.value }))} data-testid="input-campaign-name" />
            <select value={newCampaign.platform} onChange={e => setNewCampaign(p => ({ ...p, platform: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" data-testid="select-campaign-platform">
              {AD_PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <Input placeholder="หมายเหตุ" value={newCampaign.notes} onChange={e => setNewCampaign(p => ({ ...p, notes: e.target.value }))} data-testid="input-campaign-notes" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCampaignDialog(false)}>ยกเลิก</Button>
            <Button className="bg-[#fb9678] hover:bg-[#e8856a] text-white" onClick={() => addCampaignMutation.mutate(newCampaign)} disabled={!newCampaign.name || addCampaignMutation.isPending} data-testid="button-confirm-campaign">
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSpendDialog} onOpenChange={setShowSpendDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>บันทึกค่าโฆษณา</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500">วันที่ *</label>
                <ThaiDateInput value={newSpend.spendDate} onChange={(v: string) => setNewSpend(p => ({ ...p, spendDate: v }))} dateEra={dateEra} dateFmt={dateFmt} className="w-[160px]" data-testid="input-spend-date" />
              </div>
              <div>
                <label className="text-xs text-gray-500">แพลตฟอร์ม *</label>
                <select value={newSpend.platform} onChange={e => setNewSpend(p => ({ ...p, platform: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" data-testid="select-spend-platform">
                  {AD_PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500">แคมเปญ</label>
              <select value={newSpend.campaignId} onChange={e => setNewSpend(p => ({ ...p, campaignId: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" data-testid="select-spend-campaign">
                <option value="">-- ไม่ระบุ --</option>
                {(campaigns || []).filter((c: any) => c.platform === newSpend.platform).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500">ค่าโฆษณา (บาท) *</label>
                <Input type="number" placeholder="0.00" value={newSpend.amount} onChange={e => setNewSpend(p => ({ ...p, amount: e.target.value }))} data-testid="input-spend-amount" />
              </div>
              <div>
                <label className="text-xs text-gray-500">รายได้ (บาท)</label>
                <Input type="number" placeholder="0.00" value={newSpend.revenue} onChange={e => setNewSpend(p => ({ ...p, revenue: e.target.value }))} data-testid="input-spend-revenue" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-500">Impressions</label>
                <Input type="number" placeholder="0" value={newSpend.impressions} onChange={e => setNewSpend(p => ({ ...p, impressions: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-gray-500">Clicks</label>
                <Input type="number" placeholder="0" value={newSpend.clicks} onChange={e => setNewSpend(p => ({ ...p, clicks: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-gray-500">Conversions</label>
                <Input type="number" placeholder="0" value={newSpend.conversions} onChange={e => setNewSpend(p => ({ ...p, conversions: e.target.value }))} />
              </div>
            </div>
            <Input placeholder="หมายเหตุ" value={newSpend.notes} onChange={e => setNewSpend(p => ({ ...p, notes: e.target.value }))} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSpendDialog(false)}>ยกเลิก</Button>
            <Button className="bg-[#fb9678] hover:bg-[#e8856a] text-white" onClick={() => {
              const payload: any = {
                platform: newSpend.platform,
                spendDate: newSpend.spendDate,
                amount: newSpend.amount || "0",
                impressions: parseInt(newSpend.impressions) || 0,
                clicks: parseInt(newSpend.clicks) || 0,
                conversions: parseInt(newSpend.conversions) || 0,
                revenue: newSpend.revenue || "0",
                notes: newSpend.notes,
              };
              if (newSpend.campaignId) payload.campaignId = parseInt(newSpend.campaignId);
              addSpendMutation.mutate(payload);
            }} disabled={!newSpend.amount || !newSpend.spendDate || addSpendMutation.isPending} data-testid="button-confirm-spend">
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}