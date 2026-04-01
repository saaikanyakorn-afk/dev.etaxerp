import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, Plus, X, Tag } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useParams } from "wouter";
import ThaiDateInput from "@/components/thai-date-input";

import { useDateSettings } from "@/hooks/use-date-settings";
type PromotionType = "buy_x_get_y" | "percentage" | "fixed_amount";
type PromotionStatus = "active" | "inactive" | "scheduled";
type Rule = Record<string, any>;

const TYPE_LABELS: Record<PromotionType, string> = { buy_x_get_y: "ซื้อ X แถม Y", percentage: "ส่วนลด %", fixed_amount: "ส่วนลดคงที่" };
const STATUS_LABELS: Record<PromotionStatus, string> = { active: "ใช้งาน", inactive: "ปิดใช้งาน", scheduled: "ตั้งเวลา" };

const emptyForm = { name: "", description: "", type: "percentage" as PromotionType, status: "active" as PromotionStatus, startDate: "", endDate: "" };
const emptyBxyRule = (): Rule => ({ buyProductId: "", buyQty: "1", getProductId: "", getQty: "1" });
const emptyPctRule = (): Rule => ({ discountPercent: "", minAmount: "", maxDiscount: "", applyToProductId: "" });
const emptyFixRule = (): Rule => ({ discountAmount: "", minAmount: "", applyToProductId: "" });

function newRule(type: PromotionType): Rule {
  if (type === "buy_x_get_y") return emptyBxyRule();
  if (type === "percentage") return emptyPctRule();
  return emptyFixRule();
}

export default function PromotionFormPage(props: { Wrapper?: React.ComponentType<{ children: React.ReactNode }>; basePath?: string } & Record<string, any>) {
  const LayoutComponent = props.Wrapper || Layout;
  const promoBasePath = props.basePath ? `${props.basePath}/promotions` : "/inventory/promotions";
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const params = useParams<{ id: string }>();
  const editingId = params.id ? Number(params.id) : null;

  const { dateEra, dateFmt } = useDateSettings();
  const { data: docSettings } = useQuery<any>({
    queryKey: ["/api/document-settings", selectedCompanyId],
    queryFn: async () => {
      if (!selectedCompanyId) return null;
      const res = await fetch(`/api/document-settings?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!selectedCompanyId,
  });
  const [form, setForm] = useState(emptyForm);
  const [rules, setRules] = useState<Rule[]>([]);

  useEffect(() => {
    if (editingId) {
      fetch(`/api/promotions/${editingId}`, { credentials: "include" })
        .then(r => { if (!r.ok) throw new Error(); return r.json(); })
        .then(full => {
          setForm({ name: full.name, description: full.description || "", type: full.type, status: full.status, startDate: full.startDate || "", endDate: full.endDate || "" });
          setRules(full.rules || []);
        })
        .catch(() => toast({ title: "ไม่สามารถโหลดข้อมูลได้", variant: "destructive" }));
    }
  }, [editingId]);

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const url = editingId ? `/api/promotions/${editingId}` : "/api/promotions";
      const method = editingId ? "PATCH" : "POST";
      const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(payload) });
      if (!r.ok) throw new Error((await r.json()).message || "เกิดข้อผิดพลาด");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/promotions"] });
      toast({ title: editingId ? "แก้ไขโปรโมชันสำเร็จ" : "สร้างโปรโมชันสำเร็จ", variant: "success" as any });
      navigate(promoBasePath);
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  function handleTypeChange(type: PromotionType) {
    setForm(f => ({ ...f, type }));
    setRules([]);
  }

  function handleSubmit() {
    if (!form.name.trim()) { toast({ title: "กรุณากรอกชื่อโปรโมชัน", variant: "destructive" }); return; }
    saveMutation.mutate({ companyId: selectedCompanyId, ...form, startDate: form.startDate || null, endDate: form.endDate || null, rules });
  }

  function updateRule(idx: number, key: string, val: string) {
    setRules(prev => prev.map((r, i) => i === idx ? { ...r, [key]: val } : r));
  }

  function removeRule(idx: number) {
    setRules(prev => prev.filter((_, i) => i !== idx));
  }

  return (
    <LayoutComponent>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button data-testid="button-back" variant="ghost" size="icon" onClick={() => navigate(promoBasePath)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Tag className="h-5 w-5 text-primary" />
            <h1 data-testid="text-page-title" className="text-xl font-heading font-bold">
              {editingId ? "แก้ไขโปรโมชัน" : "สร้างโปรโมชัน"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button data-testid="button-cancel" variant="outline" onClick={() => navigate(promoBasePath)}>ยกเลิก</Button>
            <Button data-testid="button-save" className="gap-2" onClick={handleSubmit} disabled={saveMutation.isPending}>
              <Save className="h-4 w-4" />
              {saveMutation.isPending ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">ข้อมูลโปรโมชัน</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>ชื่อโปรโมชัน *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} data-testid="input-name" placeholder="ชื่อโปรโมชัน" />
              </div>
              <div>
                <Label>ประเภท</Label>
                <Select value={form.type} onValueChange={v => handleTypeChange(v as PromotionType)}>
                  <SelectTrigger data-testid="select-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TYPE_LABELS) as PromotionType[]).map(t => <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>รายละเอียด</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} data-testid="input-description" rows={2} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>สถานะ</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as PromotionStatus }))}>
                  <SelectTrigger data-testid="select-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_LABELS) as PromotionStatus[]).map(s => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>วันเริ่มต้น</Label>
                <ThaiDateInput value={form.startDate} onChange={v => setForm(f => ({ ...f, startDate: v }))} dateEra={dateEra} dateFmt={dateFmt} data-testid="input-start-date" />
              </div>
              <div>
                <Label>วันสิ้นสุด (ถ้ามี)</Label>
                <ThaiDateInput value={form.endDate} onChange={v => setForm(f => ({ ...f, endDate: v }))} dateEra={dateEra} dateFmt={dateFmt} data-testid="input-end-date" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">เงื่อนไขโปรโมชัน</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setRules(prev => [...prev, newRule(form.type)])} data-testid="button-add-rule">
                <Plus className="h-3 w-3 mr-1" />เพิ่มเงื่อนไข
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {rules.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-8 border rounded-md bg-gray-50" data-testid="text-no-rules">
                ยังไม่มีเงื่อนไข กดเพิ่มเงื่อนไขเพื่อเริ่มต้น
              </div>
            ) : (
              <Table data-testid="table-rules">
                <TableHeader>
                  <TableRow>
                    {form.type === "buy_x_get_y" ? (
                      <><TableHead>รหัสสินค้าซื้อ</TableHead><TableHead>จำนวนซื้อ</TableHead><TableHead>รหัสสินค้าแถม</TableHead><TableHead>จำนวนแถม</TableHead></>
                    ) : form.type === "percentage" ? (
                      <><TableHead>ส่วนลด (%)</TableHead><TableHead>ยอดขั้นต่ำ</TableHead><TableHead>ส่วนลดสูงสุด</TableHead><TableHead>รหัสสินค้า</TableHead></>
                    ) : (
                      <><TableHead>ส่วนลด (บาท)</TableHead><TableHead>ยอดขั้นต่ำ</TableHead><TableHead>รหัสสินค้า</TableHead></>
                    )}
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((rule, idx) => (
                    <TableRow key={idx} data-testid={`row-rule-${idx}`}>
                      {form.type === "buy_x_get_y" ? (<>
                        <TableCell><Input value={rule.buyProductId} onChange={e => updateRule(idx, "buyProductId", e.target.value)} data-testid={`input-buyProductId-${idx}`} placeholder="รหัสสินค้า" /></TableCell>
                        <TableCell><Input type="number" value={rule.buyQty} onChange={e => updateRule(idx, "buyQty", e.target.value)} data-testid={`input-buyQty-${idx}`} /></TableCell>
                        <TableCell><Input value={rule.getProductId} onChange={e => updateRule(idx, "getProductId", e.target.value)} data-testid={`input-getProductId-${idx}`} placeholder="รหัสสินค้า" /></TableCell>
                        <TableCell><Input type="number" value={rule.getQty} onChange={e => updateRule(idx, "getQty", e.target.value)} data-testid={`input-getQty-${idx}`} /></TableCell>
                      </>) : form.type === "percentage" ? (<>
                        <TableCell><Input type="number" value={rule.discountPercent} onChange={e => updateRule(idx, "discountPercent", e.target.value)} data-testid={`input-discountPercent-${idx}`} /></TableCell>
                        <TableCell><Input type="number" value={rule.minAmount} onChange={e => updateRule(idx, "minAmount", e.target.value)} data-testid={`input-minAmount-${idx}`} placeholder="ไม่บังคับ" /></TableCell>
                        <TableCell><Input type="number" value={rule.maxDiscount} onChange={e => updateRule(idx, "maxDiscount", e.target.value)} data-testid={`input-maxDiscount-${idx}`} placeholder="ไม่บังคับ" /></TableCell>
                        <TableCell><Input value={rule.applyToProductId} onChange={e => updateRule(idx, "applyToProductId", e.target.value)} data-testid={`input-applyToProductId-${idx}`} placeholder="ไม่บังคับ" /></TableCell>
                      </>) : (<>
                        <TableCell><Input type="number" value={rule.discountAmount} onChange={e => updateRule(idx, "discountAmount", e.target.value)} data-testid={`input-discountAmount-${idx}`} /></TableCell>
                        <TableCell><Input type="number" value={rule.minAmount} onChange={e => updateRule(idx, "minAmount", e.target.value)} data-testid={`input-minAmount-${idx}`} placeholder="ไม่บังคับ" /></TableCell>
                        <TableCell><Input value={rule.applyToProductId} onChange={e => updateRule(idx, "applyToProductId", e.target.value)} data-testid={`input-applyToProductId-${idx}`} placeholder="ไม่บังคับ" /></TableCell>
                      </>)}
                      <TableCell><Button variant="ghost" size="icon" onClick={() => removeRule(idx)} data-testid={`button-remove-rule-${idx}`}><X className="h-4 w-4 text-red-500" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-2 pb-4">
          <Button data-testid="button-cancel-bottom" variant="outline" onClick={() => navigate(promoBasePath)}>ยกเลิก</Button>
          <Button data-testid="button-save-bottom" className="gap-2" onClick={handleSubmit} disabled={saveMutation.isPending}>
            <Save className="h-4 w-4" />
            {saveMutation.isPending ? "กำลังบันทึก..." : "บันทึก"}
          </Button>
        </div>
      </div>
    </LayoutComponent>
  );
}
