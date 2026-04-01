import Layout from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calculator, Pencil, RotateCcw, Plus, Trash2, ArrowUpDown, ChevronRight, Search, BookOpen } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/lib/company-context";
import { DEFAULT_FORMULAS, DOCUMENT_TYPES, type DefaultFormulaTemplate } from "@shared/accounting-formulas";

const BIZ_TYPE_MAP: Record<string, string> = {
  service: "service",
  trading: "trading",
  ecommerce: "ecommerce",
  mixed: "mixed",
  accounting: "accounting",
  accounting_firm: "accounting",
  online_shop: "ecommerce",
  company: "mixed",
};

const BIZ_TYPE_LABELS: Record<string, string> = {
  service: "ธุรกิจบริการ",
  trading: "ซื้อมา-ขายไป",
  ecommerce: "E-Commerce",
  mixed: "ธุรกิจผสม",
  accounting: "สำนักงานบัญชี",
  ecommerce_commission: "กลับประมาณการค่าคอมมิชชั่น",
};

const DOC_TYPE_COLORS: Record<string, string> = {
  invoice: "bg-blue-100 text-blue-700",
  tax_invoice: "bg-emerald-100 text-emerald-700",
  receipt: "bg-purple-100 text-purple-700",
  purchase: "bg-orange-100 text-orange-700",
  purchase_tax: "bg-amber-100 text-amber-700",
  payment: "bg-cyan-100 text-cyan-700",
  deposit: "bg-indigo-100 text-indigo-700",
  credit_note: "bg-pink-100 text-pink-700",
  debit_note: "bg-rose-100 text-rose-700",
  purchase_deposit: "bg-teal-100 text-teal-700",
  ecommerce_import: "bg-violet-100 text-violet-700",
  ecommerce_settlement: "bg-lime-100 text-lime-700",
  expense: "bg-red-100 text-red-700",
};

interface FormulaLine {
  accountCode: string;
  accountName: string;
  direction: "debit" | "credit";
  sortOrder: number;
}

interface MergedFormula {
  id: number | null;
  documentType: string;
  businessType: string;
  name: string;
  nameTh: string;
  description: string;
  noJournalEntry: boolean;
  lines: FormulaLine[];
  isCustom: boolean;
  companyId: number | null;
}

export default function AccountingFormulas() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { selectedCompanyId, selectedCompany } = useCompany();
  const [editOpen, setEditOpen] = useState(false);
  const [editingFormula, setEditingFormula] = useState<MergedFormula | null>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetFormulaKey, setResetFormulaKey] = useState("");
  const [selectedDocType, setSelectedDocType] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const rawBusinessType = selectedCompany?.businessType || "mixed";
  const mappedBusinessType = BIZ_TYPE_MAP[rawBusinessType] || "mixed";

  const { data: customFormulas = [] } = useQuery<any[]>({
    queryKey: ["/api/accounting-formulas", selectedCompanyId],
    queryFn: async () => {
      if (!selectedCompanyId) return [];
      const r = await fetch(`/api/accounting-formulas?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: companyAccounts = [] } = useQuery<any[]>({
    queryKey: ["/api/accounts", selectedCompanyId],
    queryFn: async () => {
      if (!selectedCompanyId) return [];
      const r = await fetch(`/api/accounts?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const mergedFormulas: MergedFormula[] = useMemo(() => {
    const defaults = DEFAULT_FORMULAS.filter(f =>
      f.businessType === mappedBusinessType ||
      f.businessType === rawBusinessType ||
      f.businessType === "mixed"
    );

    const customMap = new Map<string, any>();
    customFormulas.forEach(f => customMap.set(`${f.documentType}|${f.businessType}`, f));

    const result: MergedFormula[] = [];
    const addedKeys = new Set<string>();

    for (const custom of customFormulas) {
      const key = `${custom.documentType}|${custom.businessType}`;
      if (!addedKeys.has(key)) {
        addedKeys.add(key);
        result.push({
          id: custom.id,
          documentType: custom.documentType,
          businessType: custom.businessType,
          name: custom.name,
          nameTh: custom.nameTh || custom.name,
          description: custom.description || "",
          noJournalEntry: custom.noJournalEntry || false,
          lines: custom.lines || [],
          isCustom: true,
          companyId: custom.companyId,
        });
      }
    }

    for (const def of defaults) {
      const key = `${def.documentType}|${def.businessType}`;
      if (!addedKeys.has(key)) {
        addedKeys.add(key);
        result.push({
          id: null,
          documentType: def.documentType,
          businessType: def.businessType,
          name: def.name,
          nameTh: def.nameTh,
          description: def.description || "",
          noJournalEntry: def.noJournalEntry || false,
          lines: [...def.lines],
          isCustom: false,
          companyId: null,
        });
      }
    }

    return result;
  }, [customFormulas, mappedBusinessType, rawBusinessType]);

  const docTypesWithFormulas = useMemo(() => {
    const types = new Set(mergedFormulas.map(f => f.documentType));
    return Array.from(types);
  }, [mergedFormulas]);

  const filteredFormulas = useMemo(() => {
    let list = mergedFormulas;
    if (selectedDocType) {
      list = list.filter(f => f.documentType === selectedDocType);
    }
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      list = list.filter(f =>
        f.nameTh.toLowerCase().includes(q) ||
        f.name.toLowerCase().includes(q) ||
        f.documentType.includes(q) ||
        f.businessType.includes(q) ||
        f.lines.some(l => l.accountCode.includes(q) || l.accountName.toLowerCase().includes(q))
      );
    }
    return list;
  }, [mergedFormulas, selectedDocType, searchText]);

  const openEdit = async (formula: MergedFormula) => {
    if (formula.isCustom && formula.id) {
      const r = await fetch(`/api/accounting-formulas/${formula.id}`, { credentials: "include" });
      if (r.ok) {
        const data = await r.json();
        setEditingFormula({ ...data, isCustom: true, companyId: data.companyId });
      }
    } else {
      setEditingFormula({ ...formula });
    }
    setEditOpen(true);
  };

  const saveFormulaMutation = useMutation({
    mutationFn: async (formula: MergedFormula) => {
      if (formula.isCustom && formula.id) {
        const r = await fetch(`/api/accounting-formulas/${formula.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formula.name,
            nameTh: formula.nameTh,
            description: formula.description,
            noJournalEntry: formula.noJournalEntry,
            lines: formula.noJournalEntry ? [] : formula.lines,
          }),
          credentials: "include",
        });
        if (!r.ok) throw new Error((await r.json()).message);
        return r.json();
      } else {
        const r = await fetch("/api/accounting-formulas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyId: selectedCompanyId,
            documentType: formula.documentType,
            businessType: formula.businessType,
            name: formula.name,
            nameTh: formula.nameTh,
            description: formula.description,
            noJournalEntry: formula.noJournalEntry,
            lines: formula.noJournalEntry ? [] : formula.lines,
          }),
          credentials: "include",
        });
        if (!r.ok) throw new Error((await r.json()).message);
        return r.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounting-formulas"] });
      setEditOpen(false);
      setEditingFormula(null);
      toast({ title: "บันทึกสูตรบัญชีสำเร็จ", variant: "success" as any });
    },
    onError: (err: any) => {
      toast({ title: "ไม่สำเร็จ", description: err.message, variant: "destructive" });
    },
  });

  const resetFormulaMutation = useMutation({
    mutationFn: async (formulaId: number) => {
      const r = await fetch(`/api/accounting-formulas/${formulaId}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounting-formulas"] });
      setResetConfirmOpen(false);
      toast({ title: "ลบสูตรบัญชีสำเร็จ", description: "กลับไปใช้สูตรเริ่มต้นแล้ว", variant: "success" as any });
    },
    onError: (err: any) => {
      toast({ title: "ไม่สำเร็จ", description: err.message, variant: "destructive" });
    },
  });

  const addLine = () => {
    if (!editingFormula) return;
    setEditingFormula({
      ...editingFormula,
      lines: [
        ...editingFormula.lines,
        { accountCode: "", accountName: "", direction: "debit", sortOrder: editingFormula.lines.length + 1 },
      ],
    });
  };

  const updateLine = (index: number, field: string, value: string | number) => {
    if (!editingFormula) return;
    const lines = [...editingFormula.lines];
    lines[index] = { ...lines[index], [field]: value };
    if (field === "accountCode") {
      const acct = companyAccounts.find((a: any) => a.code === value);
      if (acct) {
        lines[index].accountName = acct.nameTh || acct.name || "";
      }
    }
    setEditingFormula({ ...editingFormula, lines });
  };

  const removeLine = (index: number) => {
    if (!editingFormula) return;
    const lines = editingFormula.lines.filter((_, i) => i !== index);
    setEditingFormula({ ...editingFormula, lines });
  };

  const docTypeLabel = (key: string) => DOCUMENT_TYPES.find(d => d.key === key)?.label || key;

  const [newDocType, setNewDocType] = useState("purchase");
  const [newBizType, setNewBizType] = useState(mappedBusinessType);

  const openCreate = () => {
    setNewDocType("purchase");
    setNewBizType(mappedBusinessType);
    setCreateOpen(true);
  };

  const confirmCreate = () => {
    setCreateOpen(false);
    setEditingFormula({
      id: null,
      documentType: newDocType,
      businessType: newBizType,
      name: "",
      nameTh: "",
      description: "",
      noJournalEntry: false,
      lines: [],
      isCustom: false,
      companyId: null,
    });
    setEditOpen(true);
  };

  if (!selectedCompanyId) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
          <Calculator className="h-16 w-16 text-muted-foreground/30 mb-4" />
          <h2 className="text-xl font-semibold text-muted-foreground">กรุณาเลือกบริษัท</h2>
          <p className="text-sm text-muted-foreground/70 mt-1">เลือกบริษัทจากเมนูด้านบนเพื่อดูสูตรบัญชี</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex gap-6 h-[calc(100vh-120px)]">
        <div className="w-64 shrink-0 flex flex-col border-r pr-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-lg text-white" style={{ background: "#03c9d7" }}>
              <Calculator className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold" data-testid="text-formulas-title">สูตรบัญชี</h1>
              <p className="text-[11px] text-muted-foreground">ตั้งค่าบันทึกบัญชีอัตโนมัติ</p>
            </div>
          </div>

          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="ค้นหาสูตร..."
              className="pl-8 h-9 text-sm"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              data-testid="input-search-formula"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-0.5">
            <button
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                !selectedDocType ? "bg-[#fb9678]/10 text-[#fb9678] font-medium" : "hover:bg-muted"
              }`}
              onClick={() => setSelectedDocType(null)}
              data-testid="button-filter-all"
            >
              <div className="flex items-center justify-between">
                <span>ทั้งหมด</span>
                <Badge variant="secondary" className="text-[10px] h-5">{mergedFormulas.length}</Badge>
              </div>
            </button>

            {docTypesWithFormulas.map(dt => {
              const count = mergedFormulas.filter(f => f.documentType === dt).length;
              return (
                <button
                  key={dt}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    selectedDocType === dt ? "bg-[#fb9678]/10 text-[#fb9678] font-medium" : "hover:bg-muted"
                  }`}
                  onClick={() => setSelectedDocType(dt)}
                  data-testid={`button-filter-${dt}`}
                >
                  <div className="flex items-center justify-between">
                    <span>{docTypeLabel(dt)}</span>
                    <Badge variant="secondary" className="text-[10px] h-5">{count}</Badge>
                  </div>
                </button>
              );
            })}
          </div>

          <Button
            className="mt-3 w-full bg-[#fb9678] hover:bg-[#e8856a] text-white"
            onClick={openCreate}
            data-testid="button-create-formula"
          >
            <Plus className="h-4 w-4 mr-1" /> สร้างสูตรใหม่
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredFormulas.map((formula, idx) => (
              <Card
                key={`${formula.documentType}-${formula.businessType}-${idx}`}
                className={`relative overflow-hidden transition-all hover:shadow-md cursor-pointer ${
                  formula.isCustom ? "border-amber-300 ring-1 ring-amber-200" : "border-border"
                }`}
                onClick={() => openEdit(formula)}
                data-testid={`card-formula-${formula.documentType}-${formula.businessType}`}
              >
                {formula.isCustom && (
                  <div className="absolute top-0 right-0">
                    <div className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-lg">
                      กำหนดเอง
                    </div>
                  </div>
                )}
                <CardContent className="p-4">
                  <div className="flex items-start gap-2 mb-2">
                    <Badge className={`text-[10px] shrink-0 ${DOC_TYPE_COLORS[formula.documentType] || "bg-gray-100 text-gray-700"}`}>
                      {docTypeLabel(formula.documentType)}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {BIZ_TYPE_LABELS[formula.businessType] || formula.businessType}
                    </Badge>
                  </div>
                  <h3 className="font-semibold text-sm mb-1 truncate">{formula.nameTh || formula.name}</h3>
                  {formula.description && (
                    <p className="text-[11px] text-muted-foreground mb-2 line-clamp-2">{formula.description}</p>
                  )}

                  {formula.noJournalEntry ? (
                    <div className="py-1.5 px-2 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-600 font-medium">
                      ไม่ลงบัญชี — ออกเอกสารอย่างเดียว
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {formula.lines.map((line, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-xs">
                          <span className={`inline-flex items-center justify-center w-9 text-[10px] font-bold rounded py-0.5 ${
                            line.direction === "debit" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                          }`}>
                            {line.direction === "debit" ? "Dr" : "Cr"}
                          </span>
                          <span className="text-muted-foreground font-mono text-[11px] w-16">{line.accountCode}</span>
                          <span className="flex-1 truncate">{line.accountName}</span>
                        </div>
                      ))}
                      {formula.lines.length === 0 && (
                        <p className="text-[11px] text-muted-foreground italic">ยังไม่มีรายการ</p>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 mt-3 pt-2 border-t">
                    <Button
                      variant="outline" size="sm"
                      className="flex-1 h-7 text-xs border-[#03c9d7]/30 hover:bg-[#e5f9fa]"
                      style={{ color: "#03c9d7" }}
                      onClick={e => { e.stopPropagation(); openEdit(formula); }}
                      data-testid={`button-edit-${formula.documentType}-${formula.businessType}`}
                    >
                      <Pencil className="h-3 w-3 mr-1" /> แก้ไข
                    </Button>
                    {formula.isCustom && formula.id && (
                      <Button
                        variant="outline" size="sm"
                        className="h-7 text-xs text-amber-600 border-amber-200 hover:bg-amber-50"
                        onClick={e => {
                          e.stopPropagation();
                          setResetFormulaKey(`${formula.id}`);
                          setResetConfirmOpen(true);
                        }}
                        data-testid={`button-reset-${formula.documentType}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredFormulas.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">ไม่พบสูตรบัญชี</p>
              <p className="text-sm text-muted-foreground/70 mt-1">กดปุ่ม "สร้างสูตรใหม่" เพื่อเริ่มต้น</p>
            </div>
          )}
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>สร้างสูตรบัญชีใหม่</DialogTitle>
            <DialogDescription>เลือกประเภทเอกสารและประเภทธุรกิจสำหรับสูตรใหม่</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>ประเภทเอกสาร</Label>
              <Select value={newDocType} onValueChange={setNewDocType}>
                <SelectTrigger data-testid="select-new-doc-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map(dt => (
                    <SelectItem key={dt.key} value={dt.key}>{dt.label}</SelectItem>
                  ))}
                  <SelectItem value="expense">ค่าใช้จ่าย</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>ประเภทธุรกิจ / สูตร</Label>
              <Select value={newBizType} onValueChange={setNewBizType}>
                <SelectTrigger data-testid="select-new-biz-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="service">ธุรกิจบริการ</SelectItem>
                  <SelectItem value="trading">ซื้อมา-ขายไป</SelectItem>
                  <SelectItem value="ecommerce">E-Commerce</SelectItem>
                  <SelectItem value="mixed">ผสม</SelectItem>
                  <SelectItem value="accounting">สำนักงานบัญชี</SelectItem>
                  <SelectItem value="ecommerce_commission">กลับประมาณการค่าคอมมิชชั่น</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>ยกเลิก</Button>
              <Button className="bg-[#fb9678] hover:bg-[#e8856a] text-white" onClick={confirmCreate} data-testid="button-confirm-create">
                <Plus className="h-4 w-4 mr-1" /> สร้าง
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Badge className={`text-xs ${DOC_TYPE_COLORS[editingFormula?.documentType || ""] || "bg-gray-100"}`}>
                {editingFormula ? docTypeLabel(editingFormula.documentType) : ""}
              </Badge>
              {editingFormula?.isCustom ? "แก้ไขสูตร" : "กำหนดสูตรเอง"}
            </DialogTitle>
            <DialogDescription>
              {editingFormula?.isCustom
                ? "แก้ไขสูตรที่กำหนดเองสำหรับบริษัทนี้"
                : "สร้างสูตรเฉพาะบริษัท — จะใช้แทนค่าเริ่มต้น"}
            </DialogDescription>
          </DialogHeader>
          {editingFormula && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>ชื่อสูตร (ภาษาไทย)</Label>
                  <Input
                    data-testid="input-formula-name-th"
                    value={editingFormula.nameTh}
                    onChange={e => setEditingFormula({ ...editingFormula, nameTh: e.target.value })}
                    placeholder="เช่น บันทึกซื้อ (E-Commerce)"
                  />
                </div>
                <div>
                  <Label>ชื่อสูตร (English)</Label>
                  <Input
                    data-testid="input-formula-name"
                    value={editingFormula.name}
                    onChange={e => setEditingFormula({ ...editingFormula, name: e.target.value })}
                    placeholder="e.g. Purchase (E-Commerce)"
                  />
                </div>
              </div>
              <div>
                <Label>คำอธิบาย / หมายเหตุ</Label>
                <Textarea
                  data-testid="input-formula-description"
                  value={editingFormula.description || ""}
                  onChange={e => setEditingFormula({ ...editingFormula, description: e.target.value })}
                  rows={2}
                  className="resize-none"
                />
              </div>

              <div
                className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer select-none hover:bg-muted/50 transition-colors"
                onClick={() => setEditingFormula({ ...editingFormula, noJournalEntry: !editingFormula.noJournalEntry })}
                data-testid="toggle-no-journal"
              >
                <div className={`w-10 h-5 rounded-full relative transition-colors ${editingFormula.noJournalEntry ? "bg-amber-500" : "bg-gray-300"}`}>
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${editingFormula.noJournalEntry ? "translate-x-5" : "translate-x-0.5"}`} />
                </div>
                <div>
                  <span className="text-sm font-medium">ไม่ลงบัญชี (ออกเอกสารอย่างเดียว)</span>
                  <p className="text-xs text-muted-foreground">เปิดใช้เมื่อเอกสารนี้ไม่ต้องการสร้างรายการบันทึกบัญชี</p>
                </div>
              </div>

              {!editingFormula.noJournalEntry && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-base font-semibold flex items-center gap-2">
                      <ArrowUpDown className="h-4 w-4" /> รายการบันทึกบัญชี
                    </Label>
                    <Button type="button" variant="outline" size="sm" onClick={addLine} data-testid="button-add-line">
                      <Plus className="h-3.5 w-3.5 mr-1" /> เพิ่มรายการ
                    </Button>
                  </div>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-36">รหัสบัญชี</TableHead>
                          <TableHead>ชื่อบัญชี</TableHead>
                          <TableHead className="w-36">ด้าน</TableHead>
                          <TableHead className="w-14 text-center">ลบ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {editingFormula.lines.map((line, i) => (
                          <TableRow key={i}>
                            <TableCell className="py-1.5">
                              <Select
                                value={line.accountCode}
                                onValueChange={v => {
                                  const acct = companyAccounts.find((a: any) => a.code === v);
                                  const lines = [...editingFormula.lines];
                                  lines[i] = {
                                    ...lines[i],
                                    accountCode: v,
                                    accountName: acct?.nameTh || acct?.name || lines[i].accountName,
                                  };
                                  setEditingFormula({ ...editingFormula, lines });
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs font-mono" data-testid={`select-line-code-${i}`}>
                                  <SelectValue placeholder="เลือกบัญชี" />
                                </SelectTrigger>
                                <SelectContent className="max-h-60">
                                  {companyAccounts
                                    .filter((a: any) => a.code && a.code.length >= 7)
                                    .map((a: any) => (
                                      <SelectItem key={a.code} value={a.code}>
                                        <span className="font-mono text-xs">{a.code}</span>
                                        <span className="ml-1.5 text-xs">{a.nameTh || a.name}</span>
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="py-1.5">
                              <Input
                                data-testid={`input-line-name-${i}`}
                                value={line.accountName}
                                onChange={e => updateLine(i, "accountName", e.target.value)}
                                className="h-8 text-sm"
                                placeholder="ชื่อบัญชี"
                              />
                            </TableCell>
                            <TableCell className="py-1.5">
                              <Select value={line.direction} onValueChange={v => updateLine(i, "direction", v)}>
                                <SelectTrigger className="h-8 text-sm" data-testid={`select-line-dir-${i}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="debit">เดบิต (Dr.)</SelectItem>
                                  <SelectItem value="credit">เครดิต (Cr.)</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-center py-1.5">
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50" onClick={() => removeLine(i)} data-testid={`button-remove-line-${i}`}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {editingFormula.lines.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                              ยังไม่มีรายการ — กด "เพิ่มรายการ" ด้านบน
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 justify-end pt-4 border-t">
                <Button variant="outline" onClick={() => { setEditOpen(false); setEditingFormula(null); }}>
                  ยกเลิก
                </Button>
                <Button
                  className="text-white hover:opacity-90"
                  style={{ background: "#03c9d7" }}
                  onClick={() => editingFormula && saveFormulaMutation.mutate(editingFormula)}
                  disabled={saveFormulaMutation.isPending}
                  data-testid="button-save-formula"
                >
                  {saveFormulaMutation.isPending ? "กำลังบันทึก..." : "บันทึก"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>ลบสูตรที่กำหนดเอง?</DialogTitle>
            <DialogDescription>จะกลับไปใช้สูตรเริ่มต้นของระบบ</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setResetConfirmOpen(false)}>ยกเลิก</Button>
            <Button
              variant="destructive"
              onClick={() => {
                const id = parseInt(resetFormulaKey);
                if (id) resetFormulaMutation.mutate(id);
              }}
            >
              ลบสูตร
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
