import { useState, useEffect, useCallback } from "react";
import EcommerceLayout from "@/components/ecommerce-layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Gift, Plus, Pencil, Trash2, Trophy, Users, Star, Sparkles, RotateCcw, Loader2, UserPlus, Target, Dices, PartyPopper, Crown } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/format";

type Prize = { id?: number; name: string; description: string; quantity: number };
type CampaignForm = {
  title: string; description: string; conditionType: string;
  conditionValue: string; sessionId: string;
  prizes: Prize[];
};
const emptyCampaignForm: CampaignForm = {
  title: "", description: "", conditionType: "min_spending",
  conditionValue: "5000", sessionId: "", prizes: [{ name: "", description: "", quantity: 1 }],
};

type ManualEntryForm = { customerName: string; customerPhone: string; customerSocial: string; totalSpending: string; tickets: string };
const emptyManualEntry: ManualEntryForm = { customerName: "", customerPhone: "", customerSocial: "", totalSpending: "0", tickets: "1" };

const CONDITION_TYPES = [
  { value: "min_spending", label: "ยอดซื้อขั้นต่ำ (1 สิทธิ/คน)" },
  { value: "per_amount", label: "ทุก X บาท ได้ 1 สิทธิ" },
];

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  draft: { label: "แบบร่าง", cls: "bg-gray-100 text-gray-700" },
  active: { label: "เปิดรับสิทธิ", cls: "bg-green-100 text-green-700" },
  drawn: { label: "จับรางวัลแล้ว", cls: "bg-purple-100 text-purple-700" },
  closed: { label: "ปิดแล้ว", cls: "bg-red-100 text-red-700" },
};

function formatCurrency(v: string | number | null | undefined) {
  return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function SpinWheel({ entries, onFinish, isSpinning }: { entries: any[]; onFinish: (winner: any) => void; isSpinning: boolean }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [speed, setSpeed] = useState(50);
  const [spinning, setSpinning] = useState(false);

  useEffect(() => {
    if (!isSpinning || entries.length === 0) return;
    setSpinning(true);
    setSpeed(50);

    const pool: any[] = [];
    for (const e of entries) {
      for (let t = 0; t < (e.tickets || 1); t++) pool.push(e);
    }

    let elapsed = 0;
    let currentSpeed = 50;
    const totalDuration = 4000;
    let idx = 0;

    const interval = setInterval(() => {
      elapsed += currentSpeed;
      idx = (idx + 1) % pool.length;
      setCurrentIdx(idx % entries.length);

      if (elapsed > totalDuration * 0.6) {
        currentSpeed = Math.min(currentSpeed * 1.08, 500);
      }

      if (elapsed >= totalDuration) {
        clearInterval(interval);
        const winnerIdx = Math.floor(Math.random() * pool.length);
        const winner = pool[winnerIdx];
        const realIdx = entries.findIndex((e: any) => e.id === winner.id);
        setCurrentIdx(realIdx >= 0 ? realIdx : 0);
        setSpinning(false);
        setTimeout(() => onFinish(winner), 500);
      }
    }, currentSpeed);

    return () => clearInterval(interval);
  }, [isSpinning]);

  if (entries.length === 0) {
    return <div className="text-center text-gray-400 py-8">ไม่มีผู้มีสิทธิ</div>;
  }

  return (
    <div className="relative">
      <div className="max-h-[320px] overflow-hidden relative">
        <div className="absolute inset-0 z-10 pointer-events-none" style={{
          background: "transparent"
        }} />
        <div className="space-y-1 py-2">
          {entries.map((entry: any, i: number) => (
            <div
              key={entry.id}
              data-testid={`draw-entry-${entry.id}`}
              className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-all duration-150 ${
                i === currentIdx && spinning
                  ? "bg-[#fb9678]/20 scale-105 shadow-md border-2 border-[#fb9678]"
                  : i === currentIdx && !spinning && isSpinning === false
                  ? "bg-[#fec90f]/30 scale-105 shadow-lg border-2 border-[#fec90f]"
                  : "bg-white border border-gray-100"
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-[#fb9678] text-white flex items-center justify-center text-sm font-bold">
                {i + 1}
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm">{entry.customerName}</div>
                <div className="text-xs text-gray-500">{formatCurrency(entry.totalSpending)} บาท • {entry.tickets} สิทธิ</div>
              </div>
              {entry.isWinner && (
                <Crown className="w-5 h-5 text-[#fec90f]" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function LiveSellingLuckyDraw() {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<CampaignForm>(emptyCampaignForm);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualForm, setManualForm] = useState<ManualEntryForm>(emptyManualEntry);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawPrizeId, setDrawPrizeId] = useState<number | null>(null);
  const [drawCount, setDrawCount] = useState(1);
  const [showDrawDialog, setShowDrawDialog] = useState(false);
  const [latestWinners, setLatestWinners] = useState<any[]>([]);
  const [showWinnerCelebration, setShowWinnerCelebration] = useState(false);

  const { data: campaigns = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/lucky-draw/campaigns", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/lucky-draw/campaigns?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: campaignDetail } = useQuery<any>({
    queryKey: ["/api/lucky-draw/campaigns", selectedCampaignId],
    queryFn: async () => {
      const r = await fetch(`/api/lucky-draw/campaigns/${selectedCampaignId}`, { credentials: "include" });
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!selectedCampaignId,
  });

  const { data: sessions = [] } = useQuery<any[]>({
    queryKey: ["/api/live/sessions", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/live/sessions?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const saveCampaign = useMutation({
    mutationFn: async (data: any) => {
      const url = editingId ? `/api/lucky-draw/campaigns/${editingId}` : "/api/lucky-draw/campaigns";
      const method = editingId ? "PATCH" : "POST";
      const r = await fetch(url, {
        method, credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lucky-draw/campaigns"] });
      toast({ title: editingId ? "อัปเดตแคมเปญแล้ว" : "สร้างแคมเปญแล้ว" });
      setShowForm(false);
      setEditingId(null);
      setForm(emptyCampaignForm);
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const deleteCampaign = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/lucky-draw/campaigns/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error("ลบไม่สำเร็จ");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lucky-draw/campaigns"] });
      setSelectedCampaignId(null);
      toast({ title: "ลบแคมเปญแล้ว" });
    },
  });

  const autoQualify = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/lucky-draw/campaigns/${id}/auto-qualify`, { method: "POST", credentials: "include" });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/lucky-draw/campaigns"] });
      toast({ title: `คัดกรองแล้ว: ${data.qualified} คนผ่านเกณฑ์ จาก ${data.total} คน` });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const addManualEntry = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch(`/api/lucky-draw/campaigns/${selectedCampaignId}/add-entry`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lucky-draw/campaigns"] });
      setShowManualEntry(false);
      setManualForm(emptyManualEntry);
      toast({ title: "เพิ่มผู้มีสิทธิแล้ว" });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const removeEntry = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/lucky-draw/entries/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error("ลบไม่สำเร็จ");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lucky-draw/campaigns"] });
    },
  });

  const drawWinners = useMutation({
    mutationFn: async ({ id, prizeId, count }: { id: number; prizeId: number | null; count: number }) => {
      const r = await fetch(`/api/lucky-draw/campaigns/${id}/draw`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prizeId, count }),
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: (data) => {
      setLatestWinners(data.winners);
      setShowWinnerCelebration(true);
      setIsDrawing(false);
      queryClient.invalidateQueries({ queryKey: ["/api/lucky-draw/campaigns"] });
    },
    onError: (err: any) => {
      setIsDrawing(false);
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  const resetDraw = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/lucky-draw/campaigns/${id}/reset`, { method: "POST", credentials: "include" });
      if (!r.ok) throw new Error("รีเซ็ตไม่สำเร็จ");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lucky-draw/campaigns"] });
      toast({ title: "รีเซ็ตการจับรางวัลแล้ว" });
    },
  });

  const handleSubmit = () => {
    const payload: any = {
      companyId: selectedCompanyId,
      title: form.title,
      description: form.description || null,
      conditionType: form.conditionType,
      conditionValue: form.conditionValue,
      sessionId: form.sessionId ? Number(form.sessionId) : null,
      status: "active",
      prizes: form.prizes.filter(p => p.name.trim()),
    };
    saveCampaign.mutate(payload);
  };

  const handleEdit = (c: any) => {
    setEditingId(c.id);
    setForm({
      title: c.title,
      description: c.description || "",
      conditionType: c.conditionType,
      conditionValue: String(c.conditionValue),
      sessionId: c.sessionId ? String(c.sessionId) : "",
      prizes: [],
    });
    setShowForm(true);
  };

  const startDraw = () => {
    if (!selectedCampaignId) return;
    setIsDrawing(true);
    setTimeout(() => {
      drawWinners.mutate({ id: selectedCampaignId, prizeId: drawPrizeId, count: drawCount });
    }, 4200);
  };

  const entries = campaignDetail?.entries || [];
  const prizes = campaignDetail?.prizes || [];
  const nonWinnerEntries = entries.filter((e: any) => !e.isWinner);
  const winnerEntries = entries.filter((e: any) => e.isWinner);

  return (
    <EcommerceLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#fec90f] flex items-center justify-center">
              <Gift className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800" data-testid="text-page-title">Lucky Draw จับรางวัล</h1>
              <p className="text-sm text-gray-500">สร้างแคมเปญจับรางวัลระหว่างไลฟ์ขาย</p>
            </div>
          </div>
          <Button
            data-testid="button-create-campaign"
            onClick={() => { setEditingId(null); setForm(emptyCampaignForm); setShowForm(true); }}
            className="bg-[#fb9678] hover:bg-[#fb9678]/90 text-white"
          >
            <Plus className="w-4 h-4 mr-1" /> สร้างแคมเปญ
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1 space-y-3">
            <Card className="border shadow-sm">
              <CardHeader className="pb-2">
                <h3 className="font-semibold text-sm text-gray-600">แคมเปญทั้งหมด</h3>
              </CardHeader>
              <CardContent className="space-y-2">
                {isLoading ? (
                  <div className="text-center py-4"><Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" /></div>
                ) : campaigns.length === 0 ? (
                  <div className="text-center py-6 text-gray-400 text-sm">ยังไม่มีแคมเปญ</div>
                ) : campaigns.map((c: any) => (
                  <div
                    key={c.id}
                    data-testid={`card-campaign-${c.id}`}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedCampaignId === c.id
                        ? "border-[#fb9678] bg-[#fb9678]/5 shadow-sm"
                        : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"
                    }`}
                    onClick={() => setSelectedCampaignId(c.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{c.title}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {c.conditionType === "min_spending" ? "ซื้อขั้นต่ำ" : "ทุก"} {formatCurrency(c.conditionValue)} บาท
                        </div>
                      </div>
                      <Badge className={`${STATUS_MAP[c.status]?.cls || "bg-gray-100 text-gray-700"} text-[10px] ml-2`}>
                        {STATUS_MAP[c.status]?.label || c.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            {!selectedCampaignId || !campaignDetail ? (
              <Card className="border shadow-sm">
                <CardContent className="py-16 text-center text-gray-400">
                  <Gift className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>เลือกแคมเปญเพื่อดูรายละเอียด</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <Card className="border shadow-sm">
                  <CardContent className="pt-5">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h2 className="text-lg font-bold">{campaignDetail.title}</h2>
                        {campaignDetail.description && <p className="text-sm text-gray-500 mt-1">{campaignDetail.description}</p>}
                        <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Target className="w-4 h-4" />
                            {campaignDetail.conditionType === "min_spending" ? "ซื้อขั้นต่ำ" : "ทุก"} {formatCurrency(campaignDetail.conditionValue)} บาท
                          </span>
                          {campaignDetail.session && (
                            <span className="flex items-center gap-1">
                              <Sparkles className="w-4 h-4" />
                              เซสชัน: {campaignDetail.session.title}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={`${STATUS_MAP[campaignDetail.status]?.cls} text-xs`}>
                          {STATUS_MAP[campaignDetail.status]?.label}
                        </Badge>
                        <Button data-testid="button-edit-campaign" size="sm" variant="outline" onClick={() => handleEdit(campaignDetail)}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button data-testid="button-delete-campaign" size="sm" variant="outline" className="text-red-500 hover:bg-red-50"
                          onClick={() => { if (confirm("ลบแคมเปญนี้?")) deleteCampaign.mutate(campaignDetail.id); }}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-3">
                      <div className="p-3 rounded-lg bg-blue-50 text-center">
                        <div className="text-xl font-bold text-blue-600">{entries.length}</div>
                        <div className="text-xs text-blue-500">ผู้มีสิทธิ</div>
                      </div>
                      <div className="p-3 rounded-lg bg-green-50 text-center">
                        <div className="text-xl font-bold text-green-600">{entries.reduce((s: number, e: any) => s + (e.tickets || 1), 0)}</div>
                        <div className="text-xs text-green-500">สิทธิรวม</div>
                      </div>
                      <div className="p-3 rounded-lg bg-purple-50 text-center">
                        <div className="text-xl font-bold text-purple-600">{prizes.length}</div>
                        <div className="text-xs text-purple-500">รางวัล</div>
                      </div>
                      <div className="p-3 rounded-lg bg-[#fec90f]/10 text-center">
                        <div className="text-xl font-bold text-[#fb9678]">{winnerEntries.length}</div>
                        <div className="text-xs text-[#fb9678]">ผู้โชคดี</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Tabs defaultValue="entries">
                  <TabsList>
                    <TabsTrigger value="entries"><Users className="w-4 h-4 mr-1" /> ผู้มีสิทธิ ({entries.length})</TabsTrigger>
                    <TabsTrigger value="prizes"><Gift className="w-4 h-4 mr-1" /> รางวัล ({prizes.length})</TabsTrigger>
                    <TabsTrigger value="draw"><Dices className="w-4 h-4 mr-1" /> จับรางวัล</TabsTrigger>
                    <TabsTrigger value="winners"><Trophy className="w-4 h-4 mr-1" /> ผู้โชคดี ({winnerEntries.length})</TabsTrigger>
                  </TabsList>

                  <TabsContent value="entries">
                    <Card className="border shadow-sm">
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold text-sm">รายชื่อผู้มีสิทธิ</h3>
                          <div className="flex gap-2">
                            <Button
                              data-testid="button-auto-qualify"
                              size="sm"
                              className="bg-[#03c9d7] hover:bg-[#03c9d7]/90 text-white"
                              onClick={() => autoQualify.mutate(selectedCampaignId!)}
                              disabled={autoQualify.isPending}
                            >
                              {autoQualify.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Target className="w-4 h-4 mr-1" />}
                              คัดกรองจาก CF อัตโนมัติ
                            </Button>
                            <Button
                              data-testid="button-add-manual"
                              size="sm"
                              variant="outline"
                              className="border-[#fb9678] text-[#fb9678]"
                              onClick={() => setShowManualEntry(true)}
                            >
                              <UserPlus className="w-4 h-4 mr-1" /> เพิ่มมือ
                            </Button>
                          </div>
                        </div>
                        {entries.length === 0 ? (
                          <div className="text-center py-8 text-gray-400 text-sm">
                            <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                            กด "คัดกรองจาก CF อัตโนมัติ" เพื่อดึงลูกค้าที่มียอดซื้อถึงเกณฑ์
                          </div>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-sm w-10">#</TableHead>
                                <TableHead className="text-sm">ชื่อลูกค้า</TableHead>
                                <TableHead className="text-sm">ช่องทาง</TableHead>
                                <TableHead className="text-sm text-right">ยอดซื้อ</TableHead>
                                <TableHead className="text-sm text-center">สิทธิ</TableHead>
                                <TableHead className="text-sm text-center">สถานะ</TableHead>
                                <TableHead className="text-sm w-10"></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {entries.map((e: any, idx: number) => (
                                <TableRow key={e.id} data-testid={`row-entry-${e.id}`}>
                                  <TableCell className="text-sm">{idx + 1}</TableCell>
                                  <TableCell className="text-sm font-medium">{e.customerName}</TableCell>
                                  <TableCell className="text-sm text-gray-500">{e.customerSocial || e.customerPhone || "-"}</TableCell>
                                  <TableCell className="text-sm text-right">{formatCurrency(e.totalSpending)}</TableCell>
                                  <TableCell className="text-sm text-center">
                                    <Badge className="bg-[#fec90f]/20 text-[#fec90f] hover:bg-[#fec90f]/20">{e.tickets}</Badge>
                                  </TableCell>
                                  <TableCell className="text-sm text-center">
                                    {e.isWinner ? (
                                      <Badge className="bg-[#fec90f]/20 text-[#fb9678] hover:bg-[#fec90f]/20">
                                        <Crown className="w-3 h-3 mr-1" /> ผู้โชคดี
                                      </Badge>
                                    ) : (
                                      <Badge className="bg-gray-100 text-gray-500 hover:bg-gray-100">รอจับ</Badge>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <Button size="sm" variant="ghost" className="text-red-400 h-7 w-7 p-0"
                                      onClick={() => removeEntry.mutate(e.id)}>
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="prizes">
                    <Card className="border shadow-sm">
                      <CardContent className="pt-4">
                        <h3 className="font-semibold text-sm mb-3">รายการรางวัล</h3>
                        {prizes.length === 0 ? (
                          <div className="text-center py-8 text-gray-400 text-sm">
                            <Gift className="w-8 h-8 mx-auto mb-2 opacity-30" />
                            ยังไม่มีรางวัล — แก้ไขแคมเปญเพื่อเพิ่มรางวัล
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {prizes.map((p: any, i: number) => (
                              <div key={p.id} data-testid={`card-prize-${p.id}`}
                                className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 bg-[#fec90f]/5">
                                <div className="w-8 h-8 rounded-full bg-[#fec90f] text-white flex items-center justify-center text-sm font-bold">
                                  {i + 1}
                                </div>
                                <div className="flex-1">
                                  <div className="font-medium text-sm">{p.name}</div>
                                  {p.description && <div className="text-xs text-gray-500">{p.description}</div>}
                                </div>
                                <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">{p.quantity} รางวัล</Badge>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="draw">
                    <Card className="border shadow-sm">
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-semibold text-sm flex items-center gap-2">
                            <Dices className="w-4 h-4 text-[#fb9678]" /> จับรางวัล
                          </h3>
                          {campaignDetail.status === "drawn" && (
                            <Button
                              data-testid="button-reset-draw"
                              size="sm"
                              variant="outline"
                              onClick={() => { if (confirm("รีเซ็ตการจับรางวัลทั้งหมด?")) resetDraw.mutate(selectedCampaignId!); }}
                            >
                              <RotateCcw className="w-4 h-4 mr-1" /> รีเซ็ต
                            </Button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <div className="space-y-3 mb-4">
                              {prizes.length > 0 && (
                                <div>
                                  <Label className="text-sm">เลือกรางวัล</Label>
                                  <Select value={drawPrizeId ? String(drawPrizeId) : "none"} onValueChange={v => setDrawPrizeId(v === "none" ? null : Number(v))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">ไม่ระบุรางวัล</SelectItem>
                                      {prizes.map((p: any) => (
                                        <SelectItem key={p.id} value={String(p.id)}>{p.name} ({p.quantity} รางวัล)</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                              <div>
                                <Label className="text-sm">จำนวนผู้โชคดี</Label>
                                <Input
                                  data-testid="input-draw-count"
                                  type="number" min="1" max={nonWinnerEntries.length || 1}
                                  value={drawCount}
                                  onChange={e => setDrawCount(Number(e.target.value))}
                                />
                              </div>
                            </div>
                            <Button
                              data-testid="button-start-draw"
                              className="w-full bg-[#fec90f] text-white hover:opacity-90 h-12 text-lg font-bold"
                              onClick={startDraw}
                              disabled={isDrawing || nonWinnerEntries.length === 0}
                            >
                              {isDrawing ? (
                                <><Loader2 className="w-5 h-5 animate-spin mr-2" /> กำลังสุ่ม...</>
                              ) : (
                                <><Dices className="w-5 h-5 mr-2" /> จับรางวัล!</>
                              )}
                            </Button>
                            {nonWinnerEntries.length === 0 && entries.length > 0 && (
                              <p className="text-xs text-gray-400 text-center mt-2">ไม่มีผู้มีสิทธิที่ยังไม่ได้รับรางวัล</p>
                            )}
                          </div>

                          <div>
                            <SpinWheel
                              entries={nonWinnerEntries}
                              isSpinning={isDrawing}
                              onFinish={() => {}}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="winners">
                    <Card className="border shadow-sm">
                      <CardContent className="pt-4">
                        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                          <Trophy className="w-4 h-4 text-[#fec90f]" /> ผู้โชคดีทั้งหมด
                        </h3>
                        {winnerEntries.length === 0 ? (
                          <div className="text-center py-8 text-gray-400 text-sm">
                            <Trophy className="w-8 h-8 mx-auto mb-2 opacity-30" />
                            ยังไม่มีผู้โชคดี — ไปที่แท็บ "จับรางวัล" เพื่อเริ่ม
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {winnerEntries.map((w: any, i: number) => {
                              const prize = prizes.find((p: any) => p.id === w.prizeId);
                              return (
                                <div key={w.id} data-testid={`card-winner-${w.id}`}
                                  className="flex items-center gap-3 p-3 rounded-lg border bg-[#fec90f]/10">
                                  <div className="w-10 h-10 rounded-full bg-[#fec90f] text-white flex items-center justify-center font-bold">
                                    <Crown className="w-5 h-5" />
                                  </div>
                                  <div className="flex-1">
                                    <div className="font-medium">{w.customerName}</div>
                                    <div className="text-xs text-gray-500">
                                      ยอดซื้อ {formatCurrency(w.totalSpending)} บาท
                                      {w.customerSocial && ` • ${w.customerSocial}`}
                                    </div>
                                  </div>
                                  {prize && (
                                    <Badge className="bg-[#fec90f]/20 text-[#fb9678] hover:bg-[#fec90f]/20">
                                      <Gift className="w-3 h-3 mr-1" /> {prize.name}
                                    </Badge>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "แก้ไขแคมเปญ" : "สร้างแคมเปญจับรางวัล"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm">ชื่อแคมเปญ *</Label>
              <Input data-testid="input-campaign-title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="เช่น Lucky Draw ไลฟ์วันที่ 21 ก.พ." />
            </div>
            <div>
              <Label className="text-sm">รายละเอียด</Label>
              <Textarea data-testid="input-campaign-desc" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="รายละเอียดเพิ่มเติม" rows={2} />
            </div>
            <div>
              <Label className="text-sm">เซสชันไลฟ์ (ไม่บังคับ)</Label>
              <Select value={form.sessionId || "none"} onValueChange={v => setForm({ ...form, sessionId: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="เลือกเซสชัน" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">ทุกเซสชัน</SelectItem>
                  {sessions.map((s: any) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">ประเภทเงื่อนไข</Label>
              <Select value={form.conditionType} onValueChange={v => setForm({ ...form, conditionType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONDITION_TYPES.map(ct => (
                    <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">
                {form.conditionType === "min_spending" ? "ยอดซื้อขั้นต่ำ (บาท)" : "ทุกกี่บาทได้ 1 สิทธิ"}
              </Label>
              <Input data-testid="input-condition-value" type="number" value={form.conditionValue} onChange={e => setForm({ ...form, conditionValue: e.target.value })} />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm">รางวัล</Label>
                <Button type="button" size="sm" variant="outline" onClick={() => setForm({ ...form, prizes: [...form.prizes, { name: "", description: "", quantity: 1 }] })}>
                  <Plus className="w-3 h-3 mr-1" /> เพิ่มรางวัล
                </Button>
              </div>
              <div className="space-y-2">
                {form.prizes.map((p, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <div className="flex-1">
                      <Input
                        data-testid={`input-prize-name-${i}`}
                        placeholder="ชื่อรางวัล"
                        value={p.name}
                        onChange={e => {
                          const newPrizes = [...form.prizes];
                          newPrizes[i] = { ...p, name: e.target.value };
                          setForm({ ...form, prizes: newPrizes });
                        }}
                      />
                    </div>
                    <Input
                      data-testid={`input-prize-qty-${i}`}
                      type="number" min="1" className="w-20"
                      placeholder="จำนวน"
                      value={p.quantity}
                      onChange={e => {
                        const newPrizes = [...form.prizes];
                        newPrizes[i] = { ...p, quantity: Number(e.target.value) };
                        setForm({ ...form, prizes: newPrizes });
                      }}
                    />
                    {form.prizes.length > 1 && (
                      <Button type="button" size="sm" variant="ghost" className="text-red-400 px-2"
                        onClick={() => setForm({ ...form, prizes: form.prizes.filter((_, j) => j !== i) })}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <Button data-testid="button-save-campaign" className="w-full bg-[#fb9678] hover:bg-[#fb9678]/90 text-white" onClick={handleSubmit} disabled={!form.title.trim() || saveCampaign.isPending}>
              {saveCampaign.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {editingId ? "บันทึก" : "สร้างแคมเปญ"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showManualEntry} onOpenChange={setShowManualEntry}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>เพิ่มผู้มีสิทธิ (มือ)</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-sm">ชื่อลูกค้า *</Label>
              <Input data-testid="input-manual-name" value={manualForm.customerName} onChange={e => setManualForm({ ...manualForm, customerName: e.target.value })} />
            </div>
            <div>
              <Label className="text-sm">เบอร์โทร</Label>
              <Input data-testid="input-manual-phone" value={manualForm.customerPhone} onChange={e => setManualForm({ ...manualForm, customerPhone: e.target.value })} />
            </div>
            <div>
              <Label className="text-sm">Social / FB / IG</Label>
              <Input data-testid="input-manual-social" value={manualForm.customerSocial} onChange={e => setManualForm({ ...manualForm, customerSocial: e.target.value })} />
            </div>
            <div>
              <Label className="text-sm">ยอดซื้อ (บาท)</Label>
              <Input data-testid="input-manual-spending" type="number" value={manualForm.totalSpending} onChange={e => setManualForm({ ...manualForm, totalSpending: e.target.value })} />
            </div>
            <div>
              <Label className="text-sm">จำนวนสิทธิ</Label>
              <Input data-testid="input-manual-tickets" type="number" min="1" value={manualForm.tickets} onChange={e => setManualForm({ ...manualForm, tickets: e.target.value })} />
            </div>
            <Button data-testid="button-save-manual-entry" className="w-full bg-[#fb9678] hover:bg-[#fb9678]/90 text-white"
              onClick={() => addManualEntry.mutate({
                customerName: manualForm.customerName,
                customerPhone: manualForm.customerPhone || null,
                customerSocial: manualForm.customerSocial || null,
                totalSpending: manualForm.totalSpending,
                tickets: Number(manualForm.tickets) || 1,
                isWinner: false,
                prizeId: null,
              })}
              disabled={!manualForm.customerName.trim() || addManualEntry.isPending}>
              {addManualEntry.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <UserPlus className="w-4 h-4 mr-1" />}
              เพิ่มผู้มีสิทธิ
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showWinnerCelebration} onOpenChange={setShowWinnerCelebration}>
        <DialogContent className="max-w-md text-center">
          <div className="py-4">
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold mb-2 text-[#fec90f]">
              ขอแสดงความยินดี!
            </h2>
            <p className="text-gray-500 mb-4">ผู้โชคดีในการจับรางวัลครั้งนี้</p>
            <div className="space-y-3">
              {latestWinners.filter((w: any) => w.isWinner).map((w: any, i: number) => (
                <div key={w.id} className="flex items-center gap-3 p-4 rounded-xl bg-[#fec90f]/10 border border-[#fec90f]/30">
                  <div className="w-10 h-10 rounded-full bg-[#fec90f] text-white flex items-center justify-center font-bold text-lg">
                    <Crown className="w-5 h-5" />
                  </div>
                  <div className="text-left flex-1">
                    <div className="font-bold text-lg">{w.customerName}</div>
                    <div className="text-sm text-gray-500">ยอดซื้อ {formatCurrency(w.totalSpending)} บาท</div>
                  </div>
                </div>
              ))}
            </div>
            <Button className="mt-6 bg-[#fb9678] hover:bg-[#fb9678]/90 text-white" onClick={() => setShowWinnerCelebration(false)}>
              <PartyPopper className="w-4 h-4 mr-1" /> เยี่ยม!
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </EcommerceLayout>
  );
}
