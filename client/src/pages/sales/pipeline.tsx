import { useState, useCallback, useMemo, useEffect } from "react";
import ThaiDateInput from "@/components/thai-date-input";
import { useDateSettings } from "@/hooks/use-date-settings";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import Layout from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/lib/company-context";
import { useDocDropdowns } from "@/hooks/use-doc-dropdowns";
import { apiRequest } from "@/lib/queryClient";
import {
  Plus, GripVertical, Phone, Mail, User, DollarSign,
  Calendar, TrendingUp, Target, Award, XCircle, BarChart3,
  FileText, Search, Filter, ArrowRight, Clock, Activity,
  Trash2, Edit, Eye, ChevronDown, ChevronUp, Send
} from "lucide-react";
import type { PipelineDeal, Contact, PipelineActivity } from "@shared/schema";

const STAGES = [
  { key: "lead", label: "Lead", color: "bg-slate-100 border-slate-300", textColor: "text-slate-700", badgeColor: "bg-slate-200 text-slate-800" },
  { key: "qualified", label: "Qualified", color: "bg-blue-50 border-blue-300", textColor: "text-blue-700", badgeColor: "bg-blue-100 text-blue-800" },
  { key: "proposal", label: "Proposal", color: "bg-amber-50 border-amber-300", textColor: "text-amber-700", badgeColor: "bg-amber-100 text-amber-800" },
  { key: "negotiation", label: "Negotiation", color: "bg-purple-50 border-purple-300", textColor: "text-purple-700", badgeColor: "bg-purple-100 text-purple-800" },
  { key: "won", label: "Won", color: "bg-green-50 border-green-300", textColor: "text-green-700", badgeColor: "bg-green-100 text-green-800" },
  { key: "lost", label: "Lost", color: "bg-red-50 border-red-300", textColor: "text-red-700", badgeColor: "bg-red-100 text-red-800" },
];

function fmt(val: string | number | null | undefined): string {
  const n = parseFloat(String(val || "0"));
  return n.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtCurrency(val: string | number | null | undefined): string {
  const n = parseFloat(String(val || "0"));
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function DealCard({
  deal,
  onEdit,
  onDragStart,
}: {
  deal: PipelineDeal;
  onEdit: (deal: PipelineDeal) => void;
  onDragStart: (e: React.DragEvent, deal: PipelineDeal) => void;
}) {
  const daysOpen = deal.createdAt
    ? Math.floor((Date.now() - new Date(deal.createdAt).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, deal)}
      className="bg-white rounded-lg border shadow-sm p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
      data-testid={`card-deal-${deal.id}`}
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-medium text-sm leading-tight flex-1 pr-2" data-testid={`text-deal-title-${deal.id}`}>
          {deal.title}
        </h4>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 shrink-0"
          onClick={() => onEdit(deal)}
          data-testid={`button-edit-deal-${deal.id}`}
        >
          <Edit className="h-3 w-3" />
        </Button>
      </div>

      {deal.contactName && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
          <User className="h-3 w-3" />
          <span data-testid={`text-deal-contact-${deal.id}`}>{deal.contactName}</span>
        </div>
      )}

      <div className="flex items-center justify-between mt-2">
        <span className="text-sm font-semibold text-primary" data-testid={`text-deal-value-${deal.id}`}>
          ฿{fmtCurrency(deal.dealValue)}
        </span>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{daysOpen}d</span>
        </div>
      </div>

      {deal.expectedCloseDate && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
          <Calendar className="h-3 w-3" />
          <span>{deal.expectedCloseDate}</span>
        </div>
      )}

      {deal.assignedTo && (
        <div className="mt-2">
          <Badge variant="outline" className="text-xs">
            {deal.assignedTo}
          </Badge>
        </div>
      )}
    </div>
  );
}

function StageColumn({
  stage,
  deals,
  onEdit,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  stage: typeof STAGES[number];
  deals: PipelineDeal[];
  onEdit: (deal: PipelineDeal) => void;
  onDragStart: (e: React.DragEvent, deal: PipelineDeal) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, targetStage: string) => void;
}) {
  const totalValue = deals.reduce((sum, d) => sum + parseFloat(String(d.dealValue || "0")), 0);

  return (
    <div
      className={`flex flex-col min-w-[280px] w-[280px] rounded-lg border-2 ${stage.color}`}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, stage.key)}
      data-testid={`column-stage-${stage.key}`}
    >
      <div className="p-3 border-b">
        <div className="flex items-center justify-between">
          <h3 className={`font-semibold text-sm ${stage.textColor}`}>{stage.label}</h3>
          <Badge className={`${stage.badgeColor} text-xs`}>{deals.length}</Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          ฿{fmt(totalValue)}
        </p>
      </div>

      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-320px)] min-h-[100px]">
        {deals.map((deal) => (
          <DealCard
            key={deal.id}
            deal={deal}
            onEdit={onEdit}
            onDragStart={onDragStart}
          />
        ))}
        {deals.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-8">
            ลากการ์ดมาวางที่นี่
          </div>
        )}
      </div>
    </div>
  );
}

function DealFormDialog({
  open,
  onClose,
  deal,
  companyId,
  contacts,
  employeeNames,
  onSave,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  deal: PipelineDeal | null;
  companyId: number;
  contacts: Contact[];
  employeeNames: string[];
  onSave: (data: any) => void;
  onDelete?: (id: number) => void;
}) {
  const { dateEra, dateFmt } = useDateSettings();
  const [form, setForm] = useState({
    title: "",
    contactId: undefined as number | undefined,
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    dealValue: "0",
    stage: "lead",
    expectedCloseDate: "",
    assignedTo: "",
    source: "",
    notes: "",
    lostReason: "",
  });

  useEffect(() => {
    if (deal) {
      setForm({
        title: deal.title || "",
        contactId: deal.contactId ?? undefined,
        contactName: deal.contactName || "",
        contactPhone: deal.contactPhone || "",
        contactEmail: deal.contactEmail || "",
        dealValue: String(deal.dealValue || "0"),
        stage: deal.stage || "lead",
        expectedCloseDate: deal.expectedCloseDate || "",
        assignedTo: deal.assignedTo || "",
        source: deal.source || "",
        notes: deal.notes || "",
        lostReason: deal.lostReason || "",
      });
    } else {
      setForm({
        title: "",
        contactId: undefined,
        contactName: "",
        contactPhone: "",
        contactEmail: "",
        dealValue: "0",
        stage: "lead",
        expectedCloseDate: "",
        assignedTo: "",
        source: "",
        notes: "",
        lostReason: "",
      });
    }
  }, [deal, open]);

  function handleContactSelect(contactId: string) {
    const c = contacts.find((ct) => ct.id === Number(contactId));
    if (c) {
      setForm((prev) => ({
        ...prev,
        contactId: c.id,
        contactName: c.name,
        contactPhone: c.phone || "",
        contactEmail: c.email || "",
      }));
    }
  }

  function handleSubmit() {
    if (!form.title.trim()) return;
    onSave({
      ...form,
      companyId,
      dealValue: form.dealValue || "0",
    });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{deal ? "แก้ไข Deal" : "เพิ่ม Deal ใหม่"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>ชื่อ Deal *</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="เช่น ขายระบบ ERP ให้บริษัท ABC"
              data-testid="input-deal-title"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>เลือกคู่ค้า</Label>
              <Select onValueChange={handleContactSelect} value={form.contactId ? String(form.contactId) : ""}>
                <SelectTrigger data-testid="select-deal-contact">
                  <SelectValue placeholder="เลือกคู่ค้า" />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>ชื่อลูกค้า</Label>
              <Input
                value={form.contactName}
                onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                data-testid="input-deal-contact-name"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>โทรศัพท์</Label>
              <Input
                value={form.contactPhone}
                onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                data-testid="input-deal-phone"
              />
            </div>
            <div>
              <Label>อีเมล</Label>
              <Input
                value={form.contactEmail}
                onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                data-testid="input-deal-email"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>มูลค่า Deal (฿)</Label>
              <Input
                type="number"
                value={form.dealValue}
                onChange={(e) => setForm({ ...form, dealValue: e.target.value })}
                data-testid="input-deal-value"
              />
            </div>
            <div>
              <Label>Stage</Label>
              <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v })}>
                <SelectTrigger data-testid="select-deal-stage">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGES.map((s) => (
                    <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>วันที่คาดว่าจะปิด</Label>
              <ThaiDateInput
                value={form.expectedCloseDate}
                onChange={(v: string) => setForm({ ...form, expectedCloseDate: v })}
                dateEra={dateEra} dateFmt={dateFmt}
                data-testid="input-deal-expected-close"
              />
            </div>
            <div>
              <Label>ผู้รับผิดชอบ</Label>
              <Select value={form.assignedTo || "__none__"} onValueChange={(v) => setForm({ ...form, assignedTo: v === "__none__" ? "" : v })}>
                <SelectTrigger data-testid="select-deal-assigned">
                  <SelectValue placeholder="เลือกผู้ขาย" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">ไม่ระบุ</SelectItem>
                  {employeeNames.map((n) => (
                    <SelectItem key={n} value={n}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>แหล่งที่มา</Label>
            <Select value={form.source || "__none__"} onValueChange={(v) => setForm({ ...form, source: v === "__none__" ? "" : v })}>
              <SelectTrigger data-testid="select-deal-source">
                <SelectValue placeholder="เลือกแหล่งที่มา" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">ไม่ระบุ</SelectItem>
                <SelectItem value="website">Website</SelectItem>
                <SelectItem value="referral">การแนะนำ</SelectItem>
                <SelectItem value="cold_call">Cold Call</SelectItem>
                <SelectItem value="social_media">Social Media</SelectItem>
                <SelectItem value="event">Event/งานแสดงสินค้า</SelectItem>
                <SelectItem value="other">อื่นๆ</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>หมายเหตุ</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              data-testid="input-deal-notes"
            />
          </div>

          {form.stage === "lost" && (
            <div>
              <Label>เหตุผลที่แพ้</Label>
              <Textarea
                value={form.lostReason}
                onChange={(e) => setForm({ ...form, lostReason: e.target.value })}
                rows={2}
                data-testid="input-deal-lost-reason"
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between">
          <div>
            {deal && onDelete && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => onDelete(deal.id)}
                data-testid="button-delete-deal"
              >
                <Trash2 className="h-4 w-4 mr-1" /> ลบ
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} data-testid="button-cancel-deal">
              ยกเลิก
            </Button>
            <Button onClick={handleSubmit} data-testid="button-save-deal">
              {deal ? "บันทึก" : "สร้าง Deal"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DealDetailDialog({
  open,
  onClose,
  deal,
  companyId,
  onCreateQuotation,
  onEdit,
}: {
  open: boolean;
  onClose: () => void;
  deal: PipelineDeal | null;
  companyId: number;
  onCreateQuotation: (dealId: number) => void;
  onEdit: (deal: PipelineDeal) => void;
}) {
  const { data: activities = [] } = useQuery<PipelineActivity[]>({
    queryKey: ["/api/pipeline/deals", deal?.id, "activities", companyId],
    queryFn: async () => {
      if (!deal?.id || !companyId) return [];
      const res = await fetch(`/api/pipeline/deals/${deal.id}/activities?companyId=${companyId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!deal?.id && open && !!companyId,
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [activityNote, setActivityNote] = useState("");

  const addActivityMutation = useMutation({
    mutationFn: async (data: { description: string }) => {
      const res = await apiRequest("POST", `/api/pipeline/deals/${deal!.id}/activities?companyId=${companyId}`, {
        type: "note",
        description: data.description,
        companyId,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/deals", deal?.id, "activities"] });
      setActivityNote("");
      toast({ title: "เพิ่มบันทึกสำเร็จ" });
    },
  });

  if (!deal) return null;

  const stageInfo = STAGES.find((s) => s.key === deal.stage);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{deal.title}</span>
            {stageInfo && (
              <Badge className={stageInfo.badgeColor}>{stageInfo.label}</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold">฿{fmtCurrency(deal.dealValue)}</span>
            </div>
            {deal.contactName && (
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{deal.contactName}</span>
              </div>
            )}
            {deal.contactPhone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{deal.contactPhone}</span>
              </div>
            )}
            {deal.contactEmail && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{deal.contactEmail}</span>
              </div>
            )}
          </div>
          <div className="space-y-2">
            {deal.expectedCloseDate && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>คาดปิด: {deal.expectedCloseDate}</span>
              </div>
            )}
            {deal.assignedTo && (
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>ผู้ดูแล: {deal.assignedTo}</span>
              </div>
            )}
            {deal.source && (
              <div className="flex items-center gap-2 text-sm">
                <Target className="h-4 w-4 text-muted-foreground" />
                <span>แหล่งที่มา: {deal.source}</span>
              </div>
            )}
          </div>
        </div>

        {deal.notes && (
          <div className="bg-muted/50 rounded-lg p-3 mb-4">
            <p className="text-sm">{deal.notes}</p>
          </div>
        )}

        <div className="flex gap-2 mb-4">
          <Button
            variant="outline"
            onClick={() => {
              onClose();
              onEdit(deal);
            }}
            data-testid="button-edit-deal-from-detail"
          >
            <Edit className="h-4 w-4 mr-2" />
            แก้ไข Deal
          </Button>
          {deal.stage !== "won" && deal.stage !== "lost" && (
            <Button
              variant="outline"
              onClick={() => onCreateQuotation(deal.id)}
              data-testid="button-create-quotation-from-deal"
            >
              <FileText className="h-4 w-4 mr-2" />
              สร้างใบเสนอราคา
            </Button>
          )}
        </div>

        <div className="border-t pt-4">
          <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Activity Timeline
          </h4>

          <div className="flex gap-2 mb-4">
            <Input
              placeholder="เพิ่มบันทึก..."
              value={activityNote}
              onChange={(e) => setActivityNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && activityNote.trim()) {
                  addActivityMutation.mutate({ description: activityNote.trim() });
                }
              }}
              data-testid="input-activity-note"
            />
            <Button
              size="sm"
              onClick={() => {
                if (activityNote.trim()) {
                  addActivityMutation.mutate({ description: activityNote.trim() });
                }
              }}
              data-testid="button-add-activity"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {activities.map((act) => (
              <div key={act.id} className="flex gap-3 text-sm">
                <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                <div>
                  <p>{act.description}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {act.userName} • {act.createdAt ? new Date(act.createdAt).toLocaleString("th-TH") : ""}
                  </p>
                </div>
              </div>
            ))}
            {activities.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">ยังไม่มี activity</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AnalyticsDashboard({
  analytics,
}: {
  analytics: any;
}) {
  if (!analytics) return null;

  const cards = [
    { label: "Deal ทั้งหมด", value: analytics.totalDeals, icon: Target, color: "text-blue-600" },
    { label: "มูลค่า Pipeline", value: `฿${fmt(analytics.totalPipelineValue)}`, icon: DollarSign, color: "text-green-600" },
    { label: "Win Rate", value: `${analytics.winRate}%`, icon: Award, color: "text-amber-600" },
    { label: "Avg. Deal Cycle", value: `${analytics.avgDealCycleDays} วัน`, icon: Clock, color: "text-purple-600" },
    { label: "Won", value: analytics.wonCount, icon: TrendingUp, color: "text-green-600" },
    { label: "Lost", value: analytics.lostCount, icon: XCircle, color: "text-red-600" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
      {cards.map((c) => (
        <Card key={c.label} className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <c.icon className={`h-4 w-4 ${c.color}`} />
            <span className="text-xs text-muted-foreground">{c.label}</span>
          </div>
          <p className="text-lg font-bold" data-testid={`text-analytics-${c.label}`}>{c.value}</p>
        </Card>
      ))}
    </div>
  );
}

export default function SalesPipeline() {
  const [, navigate] = useLocation();
  const { selectedCompany } = useCompany();
  const { dateEra, dateFmt } = useDateSettings();
  const { employeeNames: rawEmployeeNames } = useDocDropdowns();
  const employeeNames = useMemo(() => rawEmployeeNames.map((e: any) => typeof e === "string" ? e : e.name), [rawEmployeeNames]);
  const companyId = selectedCompany?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<PipelineDeal | null>(null);
  const [detailDeal, setDetailDeal] = useState<PipelineDeal | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(true);

  const [filterAssigned, setFilterAssigned] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterMinValue, setFilterMinValue] = useState("");
  const [filterMaxValue, setFilterMaxValue] = useState("");

  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ["/api/contacts", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const res = await fetch(`/api/contacts?companyId=${companyId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!companyId,
  });

  const { data: allDeals = [] } = useQuery<PipelineDeal[]>({
    queryKey: ["/api/pipeline/deals", companyId, filterAssigned, filterDateFrom, filterDateTo, filterMinValue, filterMaxValue],
    queryFn: async () => {
      if (!companyId) return [];
      let url = `/api/pipeline/deals?companyId=${companyId}`;
      if (filterAssigned) url += `&assignedTo=${encodeURIComponent(filterAssigned)}`;
      if (filterDateFrom) url += `&dateFrom=${filterDateFrom}`;
      if (filterDateTo) url += `&dateTo=${filterDateTo}`;
      if (filterMinValue) url += `&minValue=${filterMinValue}`;
      if (filterMaxValue) url += `&maxValue=${filterMaxValue}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!companyId,
  });

  const { data: analytics } = useQuery({
    queryKey: ["/api/pipeline/analytics", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const res = await fetch(`/api/pipeline/analytics?companyId=${companyId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!companyId,
  });

  const filteredDeals = useMemo(() => {
    if (!filterSearch) return allDeals;
    const q = filterSearch.toLowerCase();
    return allDeals.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        (d.contactName && d.contactName.toLowerCase().includes(q)) ||
        (d.assignedTo && d.assignedTo.toLowerCase().includes(q))
    );
  }, [allDeals, filterSearch]);

  const dealsByStage = useMemo(() => {
    const grouped: Record<string, PipelineDeal[]> = {};
    for (const s of STAGES) {
      grouped[s.key] = [];
    }
    for (const d of filteredDeals) {
      const stage = d.stage || "lead";
      if (grouped[stage]) {
        grouped[stage].push(d);
      }
    }
    return grouped;
  }, [filteredDeals]);

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/pipeline/deals", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/deals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/analytics"] });
      setFormOpen(false);
      setEditingDeal(null);
      toast({ title: "สร้าง Deal สำเร็จ" });
    },
    onError: (err: Error) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      const res = await apiRequest("PATCH", `/api/pipeline/deals/${id}?companyId=${companyId}`, { ...data, companyId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/deals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/analytics"] });
      setFormOpen(false);
      setEditingDeal(null);
      toast({ title: "อัพเดท Deal สำเร็จ" });
    },
    onError: (err: Error) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/pipeline/deals/${id}?companyId=${companyId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/deals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/analytics"] });
      setFormOpen(false);
      setEditingDeal(null);
      toast({ title: "ลบ Deal สำเร็จ" });
    },
  });

  const handleDragStart = useCallback((e: React.DragEvent, deal: PipelineDeal) => {
    e.dataTransfer.setData("dealId", String(deal.id));
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetStage: string) => {
      e.preventDefault();
      const dealId = Number(e.dataTransfer.getData("dealId"));
      if (!dealId) return;

      const deal = allDeals.find((d) => d.id === dealId);
      if (!deal || deal.stage === targetStage) return;

      updateMutation.mutate({ id: dealId, data: { stage: targetStage } });
    },
    [allDeals, updateMutation]
  );

  function handleSave(data: any) {
    if (editingDeal) {
      updateMutation.mutate({ id: editingDeal.id, data });
    } else {
      createMutation.mutate(data);
    }
  }

  function handleEdit(deal: PipelineDeal) {
    setEditingDeal(deal);
    setFormOpen(true);
  }

  function handleOpenDetail(deal: PipelineDeal) {
    setDetailDeal(deal);
    setDetailOpen(true);
  }

  function handleCreateQuotation(dealId: number) {
    const deal = allDeals.find((d) => d.id === dealId);
    if (!deal) return;
    const params = new URLSearchParams();
    if (deal.contactName) params.set("customerName", deal.contactName);
    if (deal.contactPhone) params.set("contactPhone", deal.contactPhone);
    if (deal.contactEmail) params.set("contactEmail", deal.contactEmail);
    if (deal.assignedTo) params.set("salesperson", deal.assignedTo);
    params.set("pipelineDealId", String(deal.id));
    params.set("notes", `จาก Pipeline Deal: ${deal.title}`);
    navigate(`/sales/quote/new?${params.toString()}`);
  }

  const assignedToOptions = useMemo(() => {
    const set = new Set<string>();
    for (const d of allDeals) {
      if (d.assignedTo) set.add(d.assignedTo);
    }
    return Array.from(set).sort();
  }, [allDeals]);

  return (
    <Layout>
      <div>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Sales Pipeline</h1>
            <p className="text-sm text-muted-foreground">จัดการ Lead และโอกาสทางการขาย</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAnalytics(!showAnalytics)}
              data-testid="button-toggle-analytics"
            >
              <BarChart3 className="h-4 w-4 mr-1" />
              {showAnalytics ? "ซ่อน" : "แสดง"} Analytics
            </Button>
            <Button
              onClick={() => {
                setEditingDeal(null);
                setFormOpen(true);
              }}
              data-testid="button-add-deal"
            >
              <Plus className="h-4 w-4 mr-1" />
              เพิ่ม Deal
            </Button>
          </div>
        </div>

        {showAnalytics && <AnalyticsDashboard analytics={analytics} />}

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="ค้นหา deal, ลูกค้า..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search-deals"
            />
          </div>
          <Select value={filterAssigned || "__all__"} onValueChange={(v) => setFilterAssigned(v === "__all__" ? "" : v)}>
            <SelectTrigger className="w-[180px]" data-testid="select-filter-assigned">
              <SelectValue placeholder="ทุกผู้ขาย" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">ทุกผู้ขาย</SelectItem>
              {(employeeNames.length > 0 ? employeeNames : assignedToOptions).map((n: string) => (
                <SelectItem key={n} value={n}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1">
            <ThaiDateInput
              value={filterDateFrom}
              onChange={setFilterDateFrom}
              dateEra={dateEra} dateFmt={dateFmt}
              className="w-[150px] text-xs"
              data-testid="input-filter-date-from"
            />
            <span className="text-xs text-muted-foreground">-</span>
            <ThaiDateInput
              value={filterDateTo}
              onChange={setFilterDateTo}
              dateEra={dateEra} dateFmt={dateFmt}
              className="w-[150px] text-xs"
              data-testid="input-filter-date-to"
            />
          </div>
          <div className="flex items-center gap-1">
            <Input
              type="number"
              value={filterMinValue}
              onChange={(e) => setFilterMinValue(e.target.value)}
              className="w-[110px] text-xs"
              placeholder="มูลค่าขั้นต่ำ"
              data-testid="input-filter-min-value"
            />
            <span className="text-xs text-muted-foreground">-</span>
            <Input
              type="number"
              value={filterMaxValue}
              onChange={(e) => setFilterMaxValue(e.target.value)}
              className="w-[110px] text-xs"
              placeholder="มูลค่าสูงสุด"
              data-testid="input-filter-max-value"
            />
          </div>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-4">
          {STAGES.map((stage) => (
            <StageColumn
              key={stage.key}
              stage={stage}
              deals={dealsByStage[stage.key] || []}
              onEdit={(deal) => {
                handleOpenDetail(deal);
              }}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            />
          ))}
        </div>

        <DealFormDialog
          open={formOpen}
          onClose={() => {
            setFormOpen(false);
            setEditingDeal(null);
          }}
          deal={editingDeal}
          companyId={companyId || 0}
          contacts={contacts}
          employeeNames={employeeNames}
          onSave={handleSave}
          onDelete={(id) => {
            if (confirm("ต้องการลบ Deal นี้หรือไม่?")) {
              deleteMutation.mutate(id);
            }
          }}
        />

        <DealDetailDialog
          open={detailOpen}
          onClose={() => {
            setDetailOpen(false);
            setDetailDeal(null);
          }}
          deal={detailDeal}
          companyId={companyId || 0}
          onCreateQuotation={handleCreateQuotation}
          onEdit={(deal) => {
            setDetailOpen(false);
            setDetailDeal(null);
            setEditingDeal(deal);
            setFormOpen(true);
          }}
        />
      </div>
    </Layout>
  );
}
