import { useState, useMemo, useRef, useEffect } from "react";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { FileText, Search, DollarSign, Clock, AlertTriangle, CheckCircle, Users, CreditCard, Loader2, Receipt, ChevronDown, ChevronRight, Link2, Plus, ArrowLeft, X, CalendarDays, Printer } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { formatDate } from "@/lib/format";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import ThaiDateInput from "@/components/thai-date-input";
import { toLocalDateStr } from "@/lib/utils";

import { useDateSettings } from "@/hooks/use-date-settings";
function fmt(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function billingStatusBadge(status: string) {
  switch (status) {
    case "paid": return <Badge className="text-[10px] bg-green-100 text-green-700 border-0"><CheckCircle className="h-3 w-3 mr-0.5" />ชำระแล้ว</Badge>;
    case "approved": return <Badge className="text-[10px] bg-blue-100 text-blue-700 border-0"><CheckCircle className="h-3 w-3 mr-0.5" />อนุมัติ</Badge>;
    case "cancelled": return <Badge className="text-[10px] bg-red-100 text-red-700 border-0"><X className="h-3 w-3 mr-0.5" />ยกเลิก</Badge>;
    case "draft": return <Badge className="text-[10px] bg-gray-100 text-gray-700 border-0"><Clock className="h-3 w-3 mr-0.5" />ร่าง</Badge>;
    case "unpaid": return <Badge className="text-[10px] bg-red-100 text-red-700 border-0"><AlertTriangle className="h-3 w-3 mr-0.5" />ยังไม่ชำระ</Badge>;
    default: return <Badge className="text-[10px] bg-gray-100 text-gray-700 border-0"><Clock className="h-3 w-3 mr-0.5" />{status || "ร่าง"}</Badge>;
  }
}

function paymentStatusBadge(ps: string) {
  switch (ps) {
    case "paid": return <Badge className="text-[10px] bg-green-100 text-green-700 border-0"><CheckCircle className="h-3 w-3 mr-0.5" />ชำระแล้ว</Badge>;
    case "partial": return <Badge className="text-[10px] bg-yellow-100 text-yellow-700 border-0"><Clock className="h-3 w-3 mr-0.5" />ชำระบางส่วน</Badge>;
    default: return <Badge className="text-[10px] bg-red-100 text-red-700 border-0"><AlertTriangle className="h-3 w-3 mr-0.5" />ยังไม่ชำระ</Badge>;
  }
}

export default function BillingNotes() {
  const [, navigate] = useLocation();
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<"list" | "create">("list");
  const [searchBilling, setSearchBilling] = useState("");
  const [expandedNotes, setExpandedNotes] = useState<Set<number>>(new Set());

  const [customerSearch, setCustomerSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [billingDate, setBillingDate] = useState(() => toLocalDateStr(new Date()));
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return toLocalDateStr(d);
  });
  const [billingNotes, setBillingNotes] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [receiptBillingNote, setReceiptBillingNote] = useState<any>(null);
  const [receiptPayMethod, setReceiptPayMethod] = useState("โอนเงิน");
  const [receiptPayDate, setReceiptPayDate] = useState(() => toLocalDateStr(new Date()));
  const [receiptWht, setReceiptWht] = useState("");
  const [receiptNotes, setReceiptNotes] = useState("");

  const { dateEra, dateFmt } = useDateSettings();
  const { data: docSettings } = useQuery<any>({
    queryKey: ["/api/document-settings", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const r = await fetch(`/api/document-settings/${companyId}`, { credentials: "include" });
      return r.ok ? r.json() : null;
    },
    enabled: !!companyId,
  });
  const { data: billingData, isLoading: billingLoading } = useQuery<any>({
    queryKey: ["/api/finance/billing-notes", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const r = await fetch(`/api/finance/billing-notes?companyId=${companyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!companyId,
  });

  const billingNotesList: any[] = Array.isArray(billingData) ? billingData : [];

  const filteredNotes = useMemo(() => {
    if (!searchBilling) return billingNotesList;
    const s = searchBilling.toLowerCase();
    return billingNotesList.filter((bn: any) =>
      (bn.billingNo || "").toLowerCase().includes(s) ||
      (bn.customerName || "").toLowerCase().includes(s)
    );
  }, [billingNotesList, searchBilling]);

  const totalAmount = billingNotesList.reduce((s: number, bn: any) => s + (parseFloat(bn.totalAmount) || 0), 0);
  const unpaidCount = billingNotesList.filter((bn: any) => bn.status === "unpaid" || bn.paymentStatus === "unpaid").length;

  const { data: searchResults, isFetching: searchingCustomers } = useQuery<any>({
    queryKey: ["/api/finance/customer-outstanding", companyId, customerSearch],
    queryFn: async () => {
      if (!companyId || customerSearch.length < 1) return { contacts: [] };
      const r = await fetch(`/api/finance/customer-outstanding?companyId=${companyId}&q=${encodeURIComponent(customerSearch)}`, { credentials: "include" });
      return r.ok ? r.json() : { contacts: [] };
    },
    enabled: !!companyId && customerSearch.length >= 1 && !selectedContact,
  });

  const { data: outstandingData, isLoading: loadingDocs } = useQuery<any>({
    queryKey: ["/api/finance/customer-outstanding-docs", companyId, selectedContact?.id, selectedContact?.name],
    queryFn: async () => {
      if (!companyId || !selectedContact) return { documents: [] };
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (selectedContact.id) params.append("contactId", String(selectedContact.id));
      if (selectedContact.name) params.append("contactName", selectedContact.name);
      const r = await fetch(`/api/finance/customer-outstanding-docs?${params}`, { credentials: "include" });
      return r.ok ? r.json() : { documents: [] };
    },
    enabled: !!companyId && !!selectedContact,
  });

  const outstandingDocs: any[] = outstandingData?.documents || [];

  const { data: paymentMethodsList } = useQuery<any[]>({
    queryKey: ["/api/payment-methods", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const r = await fetch(`/api/payment-methods?companyId=${companyId}`, { credentials: "include" });
      return r.ok ? r.json() : [];
    },
    enabled: !!companyId,
  });

  const createBillingNote = useMutation({
    mutationFn: async (payload: any) => {
      const r = await apiRequest("POST", "/api/finance/billing-notes", payload);
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "สร้างใบวางบิลสำเร็จ" });
      queryClient.invalidateQueries({ queryKey: ["/api/finance/billing-notes", companyId] });
      queryClient.invalidateQueries({ queryKey: ["/api/finance/customer-outstanding-docs"] });
      resetCreateForm();
      setMode("list");
    },
    onError: (err: any) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  const createReceiptFromBN = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }) => {
      const r = await apiRequest("POST", `/api/finance/billing-notes/${id}/create-receipt`, payload);
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "สร้างใบรับเงินสำเร็จ" });
      queryClient.invalidateQueries({ queryKey: ["/api/finance/billing-notes", companyId] });
      setReceiptDialogOpen(false);
      resetReceiptForm();
    },
    onError: (err: any) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  const resetCreateForm = () => {
    setCustomerSearch("");
    setSelectedContact(null);
    setSelectedDocs(new Set());
    setBillingDate(toLocalDateStr(new Date()));
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setDueDate(toLocalDateStr(d));
    setBillingNotes("");
  };

  const resetReceiptForm = () => {
    setReceiptBillingNote(null);
    setReceiptPayMethod("โอนเงิน");
    setReceiptPayDate(toLocalDateStr(new Date()));
    setReceiptWht("");
    setReceiptNotes("");
  };

  const docKey = (doc: any) => `${doc.docType}-${doc.id}`;

  const toggleDoc = (doc: any) => {
    const key = docKey(doc);
    const next = new Set(selectedDocs);
    if (next.has(key)) next.delete(key); else next.add(key);
    setSelectedDocs(next);
  };

  const toggleAll = () => {
    if (selectedDocs.size === outstandingDocs.length) {
      setSelectedDocs(new Set());
    } else {
      setSelectedDocs(new Set(outstandingDocs.map(docKey)));
    }
  };

  const selectedDocsList = useMemo(() => {
    return outstandingDocs.filter(d => selectedDocs.has(docKey(d)));
  }, [outstandingDocs, selectedDocs]);

  const selectedTotal = useMemo(() => {
    return selectedDocsList.reduce((s, d) => s + (parseFloat(d.totalAmount) || 0), 0);
  }, [selectedDocsList]);

  const submitBillingNote = () => {
    if (selectedDocsList.length === 0) return;
    createBillingNote.mutate({
      companyId,
      documents: selectedDocsList.map(d => ({
        docType: d.docType,
        docId: d.id,
        docNo: d.docNo,
        docDate: d.docDate,
        amount: d.totalAmount,
      })),
      billingDate,
      dueDate,
      notes: billingNotes,
      customerId: selectedContact?.id || null,
      customerName: selectedContact?.name || "",
    });
  };

  const openReceiptDialog = (bn: any) => {
    setReceiptBillingNote(bn);
    setReceiptPayMethod("โอนเงิน");
    setReceiptPayDate(toLocalDateStr(new Date()));
    setReceiptWht("");
    setReceiptNotes("");
    setReceiptDialogOpen(true);
  };

  const submitReceipt = () => {
    if (!receiptBillingNote) return;
    createReceiptFromBN.mutate({
      id: receiptBillingNote.id,
      payload: {
        paymentMethod: receiptPayMethod,
        paymentDate: receiptPayDate,
        notes: receiptNotes,
        withholdingTax: parseFloat(receiptWht) || 0,
      },
    });
  };

  const selectContact = (contact: any) => {
    setSelectedContact(contact);
    setCustomerSearch(contact.name);
    setShowDropdown(false);
    setSelectedDocs(new Set());
  };

  const clearContact = () => {
    setSelectedContact(null);
    setCustomerSearch("");
    setSelectedDocs(new Set());
  };

  const toggleNoteExpand = (id: number) => {
    const next = new Set(expandedNotes);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpandedNotes(next);
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (mode === "create") {
    return (
      <Layout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => { resetCreateForm(); setMode("list"); }} data-testid="button-back-to-list">
            <ArrowLeft className="h-4 w-4 mr-1" />
            กลับ
          </Button>
          <div>
            <h1 className="text-xl font-bold text-gray-800" data-testid="text-page-title">สร้างใบวางบิล</h1>
            <p className="text-sm text-muted-foreground">ค้นหาลูกค้าเพื่อดึงเอกสารค้างชำระ</p>
          </div>
        </div>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">ค้นหาลูกค้า</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative" ref={dropdownRef}>
              {selectedContact ? (
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                  <Users className="h-4 w-4 text-blue-500" />
                  <div className="flex-1">
                    <span className="text-sm font-semibold text-blue-800">{selectedContact.name}</span>
                    {selectedContact.code && (
                      <span className="text-xs text-blue-600 ml-2">({selectedContact.code})</span>
                    )}
                    {selectedContact.taxId && (
                      <span className="text-xs text-blue-500 ml-2">เลขนิติ: {selectedContact.taxId}</span>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={clearContact} data-testid="button-clear-contact">
                    <X className="h-4 w-4 text-blue-400" />
                  </Button>
                </div>
              ) : (
                <>
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    ref={searchInputRef}
                    placeholder="พิมพ์ชื่อลูกค้า, เลขนิติบุคคล, หรือรหัสลูกค้า..."
                    className="pl-10 h-11 text-sm"
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setShowDropdown(true);
                    }}
                    onFocus={() => customerSearch.length >= 1 && setShowDropdown(true)}
                    data-testid="input-search-customer"
                  />
                  {showDropdown && customerSearch.length >= 1 && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white rounded-lg shadow-lg border max-h-[300px] overflow-y-auto">
                      {searchingCustomers ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                          <span className="text-sm text-muted-foreground ml-2">กำลังค้นหา...</span>
                        </div>
                      ) : (searchResults?.contacts || []).length === 0 ? (
                        <div className="py-6 text-center text-sm text-muted-foreground">
                          ไม่พบลูกค้าที่ตรงกับ "{customerSearch}"
                        </div>
                      ) : (
                        (searchResults?.contacts || []).map((c: any) => (
                          <button
                            key={c.id}
                            className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center gap-3 border-b last:border-b-0"
                            onClick={() => selectContact(c)}
                            data-testid={`contact-option-${c.id}`}
                          >
                            <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                              <Users className="h-4 w-4 text-blue-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-800 truncate">{c.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {c.code && <span className="mr-3">รหัส: {c.code}</span>}
                                {c.taxId && <span>เลขนิติ: {c.taxId}</span>}
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {selectedContact && (
          <>
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">เอกสารค้างชำระ</CardTitle>
                  {outstandingDocs.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedDocs.size === outstandingDocs.length && outstandingDocs.length > 0}
                        onCheckedChange={toggleAll}
                        data-testid="checkbox-select-all"
                      />
                      <span className="text-xs text-muted-foreground">เลือกทั้งหมด ({outstandingDocs.length})</span>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loadingDocs ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : outstandingDocs.length === 0 ? (
                  <div className="text-center py-12 text-sm text-muted-foreground">
                    <CheckCircle className="h-10 w-10 mx-auto mb-2 text-green-300" />
                    ลูกค้ารายนี้ไม่มีเอกสารค้างชำระ
                  </div>
                ) : (
                  <div className="divide-y">
                    {outstandingDocs.map((doc: any) => {
                      const key = docKey(doc);
                      const isSelected = selectedDocs.has(key);
                      return (
                        <div key={key} className={`px-4 py-3 transition-colors ${isSelected ? "bg-amber-50/50" : "hover:bg-gray-50/50"}`} data-testid={`doc-item-${key}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleDoc(doc)}
                                data-testid={`checkbox-doc-${key}`}
                              />
                              <Badge className={`text-[9px] border-0 ${doc.docType === "IV" ? "bg-blue-100 text-blue-700" : "bg-cyan-100 text-cyan-700"}`}>
                                {doc.docType === "IV" ? "ใบแจ้งหนี้" : "ใบกำกับภาษี"}
                              </Badge>
                              <span className="text-sm font-medium text-gray-800">{doc.docNo}</span>
                              {paymentStatusBadge(doc.paymentStatus)}
                            </div>
                            <span className="text-sm font-bold text-gray-800">฿{fmt(parseFloat(doc.totalAmount) || 0)}</span>
                          </div>
                          <div className="flex items-center gap-4 mt-1.5 ml-9 text-xs text-muted-foreground">
                            <span>วันที่: {formatDate(doc.docDate, dateEra, dateFmt)}</span>
                            {doc.dueDate && (
                              <span>ครบกำหนด: {formatDate(doc.dueDate, dateEra, dateFmt)}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {selectedDocs.size > 0 && (
              <Card className="border-0 shadow-sm border-t-4" style={{ borderTopColor: "#fec90f" }}>
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-semibold text-gray-700">เลือก {selectedDocs.size} รายการ</span>
                      <span className="text-xs text-muted-foreground ml-2">จาก {outstandingDocs.length} รายการ</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-muted-foreground">ยอดรวม</span>
                      <p className="text-lg font-bold text-gray-800">฿{fmt(selectedTotal)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">วันที่วางบิล</Label>
                      <ThaiDateInput
                        value={billingDate}
                        onChange={setBillingDate}
                        dateEra={dateEra}
                        dateFmt={dateFmt}
                        className="mt-1 h-9 text-sm"
                        data-testid="input-billing-date"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">วันครบกำหนด</Label>
                      <ThaiDateInput
                        value={dueDate}
                        onChange={setDueDate}
                        dateEra={dateEra}
                        dateFmt={dateFmt}
                        className="mt-1 h-9 text-sm"
                        data-testid="input-due-date"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">หมายเหตุ</Label>
                      <Input
                        value={billingNotes}
                        onChange={(e) => setBillingNotes(e.target.value)}
                        placeholder="หมายเหตุ (ถ้ามี)"
                        className="mt-1 h-9 text-sm"
                        data-testid="input-billing-notes"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setSelectedDocs(new Set())} data-testid="button-clear-selection">
                      ล้างการเลือก
                    </Button>
                    <Button
                      size="sm"
                      className="px-6"
                      style={{ background: "#fec90f", color: "#000" }}
                      disabled={createBillingNote.isPending}
                      onClick={submitBillingNote}
                      data-testid="button-submit-billing-note"
                    >
                      {createBillingNote.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileText className="h-4 w-4 mr-1" />}
                      สร้างใบวางบิล ฿{fmt(selectedTotal)}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
      </Layout>
    );
  }

  return (
    <Layout>
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800" data-testid="text-page-title">ใบวางบิล</h1>
          <p className="text-sm text-muted-foreground">รายการใบวางบิลทั้งหมด</p>
        </div>
        <Button
          size="sm"
          style={{ background: "#fb9678" }}
          onClick={() => { resetCreateForm(); setMode("create"); }}
          data-testid="button-create-billing-note"
        >
          <Plus className="h-4 w-4 mr-1" />
          สร้างใบวางบิล
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center">
                <FileText className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">ใบวางบิลทั้งหมด</p>
                <p className="text-lg font-bold text-gray-800" data-testid="text-total-billing-notes">{billingNotesList.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">ยอดรวมทั้งหมด</p>
                <p className="text-lg font-bold text-gray-800" data-testid="text-total-amount">฿{fmt(totalAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">ยังไม่ชำระ</p>
                <p className="text-lg font-bold text-red-600" data-testid="text-unpaid-count">{unpaidCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">รายการใบวางบิล</CardTitle>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="ค้นหาเลขที่ใบวางบิล, ลูกค้า..."
                className="pl-8 h-9 text-sm w-[250px]"
                value={searchBilling}
                onChange={(e) => setSearchBilling(e.target.value)}
                data-testid="input-search-billing"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {billingLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="text-center py-16 text-sm text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-2 text-gray-300" />
              {billingNotesList.length === 0 ? "ยังไม่มีใบวางบิล กดปุ่ม \"สร้างใบวางบิล\" เพื่อเริ่มต้น" : "ไม่พบใบวางบิลที่ค้นหา"}
            </div>
          ) : (
            <div className="divide-y">
              {filteredNotes.map((bn: any) => {
                const isExpanded = expandedNotes.has(bn.id);
                const isUnpaid = bn.status === "unpaid" || bn.paymentStatus === "unpaid";
                return (
                  <div key={bn.id} data-testid={`billing-note-item-${bn.id}`}>
                    <div
                      className="px-4 py-3 hover:bg-gray-50/50 cursor-pointer transition-colors"
                      onClick={() => toggleNoteExpand(bn.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                          <Badge className="text-[9px] border-0" style={{ background: "#fec90f", color: "#000" }}>BN</Badge>
                          <span className="text-sm font-medium text-gray-800">{bn.billingNo}</span>
                          <span className="text-sm text-muted-foreground">{bn.customerName}</span>
                          {bn.linkedDocs?.length > 0 && (
                            <Badge variant="outline" className="text-[9px]">
                              <Link2 className="h-3 w-3 mr-0.5" />
                              {bn.linkedDocs.length} เอกสาร
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">{formatDate(bn.billingDate, dateEra, dateFmt)}</span>
                          {billingStatusBadge(bn.status)}
                          <span className="text-sm font-bold" style={{ color: "#fb9678" }}>฿{fmt(parseFloat(bn.totalAmount) || 0)}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={(e) => { e.stopPropagation(); navigate(`/finance/billing-notes/pdf/${bn.id}`); }}
                            data-testid={`button-print-billing-note-${bn.id}`}
                          >
                            <Printer className="h-3 w-3 mr-1" />
                            พิมพ์
                          </Button>
                          {isUnpaid && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs border-green-200 text-green-700 hover:bg-green-50"
                              onClick={(e) => { e.stopPropagation(); openReceiptDialog(bn); }}
                              data-testid={`button-create-receipt-${bn.id}`}
                            >
                              <Receipt className="h-3 w-3 mr-1" />
                              สร้างใบรับเงิน
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                    {isExpanded && bn.linkedDocs?.length > 0 && (
                      <div className="px-4 pb-3">
                        <div className="ml-6 bg-gray-50 rounded-lg overflow-hidden">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b">
                                <th className="text-left px-3 py-1.5 text-xs font-medium text-gray-500">ประเภท</th>
                                <th className="text-left px-3 py-1.5 text-xs font-medium text-gray-500">เลขที่เอกสาร</th>
                                <th className="text-left px-3 py-1.5 text-xs font-medium text-gray-500">วันที่</th>
                                <th className="text-right px-3 py-1.5 text-xs font-medium text-gray-500">ยอดเงิน</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {bn.linkedDocs.map((ld: any, i: number) => (
                                <tr key={i}>
                                  <td className="px-3 py-1.5">
                                    <Badge className={`text-[8px] border-0 ${ld.docType === "IV" ? "bg-blue-100 text-blue-700" : "bg-cyan-100 text-cyan-700"}`}>
                                      {ld.docType === "IV" ? "ใบแจ้งหนี้" : "ใบกำกับภาษี"}
                                    </Badge>
                                  </td>
                                  <td className="px-3 py-1.5 text-xs">{ld.docNo || "-"}</td>
                                  <td className="px-3 py-1.5 text-xs">{ld.docDate ? formatDate(ld.docDate, dateEra, dateFmt) : "-"}</td>
                                  <td className="px-3 py-1.5 text-xs text-right font-medium">฿{fmt(ld.amount)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={receiptDialogOpen} onOpenChange={setReceiptDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>สร้างใบรับเงินจากใบวางบิล</DialogTitle>
            <DialogDescription>
              {receiptBillingNote && (
                <span>ใบวางบิล: {receiptBillingNote.billingNo} | ยอด ฿{fmt(parseFloat(receiptBillingNote.totalAmount) || 0)}</span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">วิธีรับเงิน</Label>
              <Select value={receiptPayMethod} onValueChange={setReceiptPayMethod}>
                <SelectTrigger className="mt-1 h-9 text-sm" data-testid="select-receipt-pay-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="โอนเงิน">โอนเงิน</SelectItem>
                  <SelectItem value="เงินสด">เงินสด</SelectItem>
                  <SelectItem value="เช็ค">เช็ค</SelectItem>
                  <SelectItem value="บัตรเครดิต">บัตรเครดิต</SelectItem>
                  {(paymentMethodsList || []).filter((m: any) => !["โอนเงิน","เงินสด","เช็ค","บัตรเครดิต"].includes(m.name)).map((m: any) => (
                    <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">วันที่รับเงิน</Label>
              <ThaiDateInput
                value={receiptPayDate}
                onChange={setReceiptPayDate}
                dateEra={dateEra}
                dateFmt={dateFmt}
                className="mt-1 h-9 text-sm"
                data-testid="input-receipt-pay-date"
              />
            </div>
            <div>
              <Label className="text-xs">ภาษีถูกหัก ณ ที่จ่าย</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={receiptWht}
                onChange={(e) => setReceiptWht(e.target.value)}
                placeholder="0.00"
                className="mt-1 h-9 text-sm"
                data-testid="input-receipt-wht"
              />
            </div>
            {parseFloat(receiptWht) > 0 && receiptBillingNote && (
              <div className="bg-amber-50 rounded-lg p-3 flex items-center justify-between">
                <div className="text-sm text-amber-800">
                  <span>ยอดเอกสาร ฿{fmt(parseFloat(receiptBillingNote.totalAmount) || 0)}</span>
                  <span className="mx-2">-</span>
                  <span>ภาษีถูกหัก ฿{fmt(parseFloat(receiptWht) || 0)}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-amber-600">ยอดรับสุทธิ</span>
                  <p className="text-lg font-bold" style={{ color: "#05b187" }}>฿{fmt((parseFloat(receiptBillingNote.totalAmount) || 0) - (parseFloat(receiptWht) || 0))}</p>
                </div>
              </div>
            )}
            <div>
              <Label className="text-xs">หมายเหตุ</Label>
              <Input
                value={receiptNotes}
                onChange={(e) => setReceiptNotes(e.target.value)}
                placeholder="หมายเหตุ (ถ้ามี)"
                className="mt-1 h-9 text-sm"
                data-testid="input-receipt-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setReceiptDialogOpen(false)} data-testid="button-cancel-receipt">
              ยกเลิก
            </Button>
            <Button
              size="sm"
              className="px-6"
              style={{ background: "#05b187" }}
              disabled={createReceiptFromBN.isPending}
              onClick={submitReceipt}
              data-testid="button-submit-receipt"
            >
              {createReceiptFromBN.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CreditCard className="h-4 w-4 mr-1" />}
              บันทึกรับเงิน
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </Layout>
  );
}
