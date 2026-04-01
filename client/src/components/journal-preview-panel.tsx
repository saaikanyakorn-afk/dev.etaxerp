import { useEffect, useState, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BookOpen, Check, AlertCircle, Loader2, ChevronDown, ChevronUp, Pencil, RotateCcw, Plus, Trash2 } from "lucide-react";

export interface JournalLine {
  accountCode: string;
  accountName: string;
  debit: string;
  credit: string;
}

interface LineItemAccount {
  accountCode: string;
  accountName: string;
  amount: number;
  description?: string;
}

interface JournalPreviewPanelProps {
  companyId: number | null;
  documentType: string;
  subtotal: string;
  vatAmount: string;
  withholdingTax?: string;
  paymentMethod?: string;
  currencyCode?: string;
  exchangeRate?: string;
  linkedInvoiceId?: number | null;
  lineItemAccounts?: LineItemAccount[];
  onLinesChange?: (lines: JournalLine[] | null) => void;
}

function fmt(val: string | number | null | undefined): string {
  const n = parseFloat(String(val || "0"));
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface AccountOption {
  code: string;
  name: string;
  nameTh: string;
}

function AccountPickerInput({ value, accountName, accounts, onChange, mode = "code" }: {
  value: string;
  accountName: string;
  accounts: AccountOption[];
  onChange: (code: string, name: string) => void;
  mode?: "code" | "name";
}) {
  const displayVal = mode === "code" ? value : accountName;
  const [search, setSearch] = useState(displayVal);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setSearch(mode === "code" ? value : accountName); }, [value, accountName, mode]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const q = search.toLowerCase().trim();
  const filtered = q
    ? accounts.filter(a =>
        a.code.includes(q) || a.name.toLowerCase().includes(q) ||
        a.nameTh.includes(q)
      ).slice(0, 50)
    : accounts.slice(0, 50);

  return (
    <div ref={ref} className="relative">
      <Input
        value={search}
        onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
        onFocus={() => { setSearch(""); setOpen(true); }}
        onBlur={() => { if (!open) setSearch(mode === "code" ? value : accountName); }}
        className={mode === "code" ? "h-7 text-xs font-mono px-1.5 w-24" : "h-7 text-xs px-1.5"}
        placeholder={mode === "code" ? "รหัส" : "ค้นหาชื่อบัญชี"}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 mt-1 bg-white border rounded-lg shadow-lg max-h-72 overflow-auto w-80"
             style={{ minWidth: "360px" }}>
          {filtered.map(a => (
            <button
              key={a.code}
              type="button"
              className="w-full text-left px-2 py-1.5 hover:bg-blue-50 text-xs flex gap-2 items-baseline"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(a.code, a.nameTh || a.name);
                setSearch(mode === "code" ? a.code : (a.nameTh || a.name));
                setOpen(false);
              }}
            >
              <span className="font-mono text-blue-600 shrink-0 w-20">{a.code}</span>
              <span className="text-gray-700 truncate">{a.nameTh || a.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function JournalPreviewPanel({
  companyId, documentType, subtotal, vatAmount, withholdingTax, paymentMethod, currencyCode, exchangeRate, linkedInvoiceId,
  lineItemAccounts,
  onLinesChange,
}: JournalPreviewPanelProps) {
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [debounceTimer, setDebounceTimer] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);
  const [editLines, setEditLines] = useState<JournalLine[]>([]);
  const [isCustomized, setIsCustomized] = useState(false);

  const { data: myPermissions } = useQuery<{ modules: string[]; subModules: string[] }>({
    queryKey: ["/api/permissions/me", companyId],
    queryFn: async () => {
      const params = companyId ? `?companyId=${companyId}` : "";
      const r = await fetch(`/api/permissions/me${params}`, { credentials: "include" });
      if (!r.ok) return { modules: [], subModules: [] };
      const data = await r.json();
      if (Array.isArray(data)) return { modules: data, subModules: [] };
      return data;
    },
    enabled: !!companyId,
  });
  const hasAccounting = myPermissions?.modules?.includes("accounting") ?? false;

  const { data: accountsList } = useQuery<AccountOption[]>({
    queryKey: ["/api/accounts", companyId, "for-journal-preview"],
    queryFn: async () => {
      const r = await fetch(`/api/accounts?companyId=${companyId}`, { credentials: "include" });
      if (!r.ok) return [];
      const data = await r.json();
      return data.filter((a: any) => a.isDetail !== false).map((a: any) => ({
        code: a.code,
        name: a.nameEn || a.name || "",
        nameTh: a.name || a.nameTh || "",
      }));
    },
    enabled: !!companyId && hasAccounting,
    staleTime: 60_000,
  });

  const sub = parseFloat(subtotal) || 0;
  const vat = parseFloat(vatAmount) || 0;

  useEffect(() => {
    if (!hasAccounting || !companyId || !documentType || (sub === 0 && vat === 0)) {
      setPreview(null);
      return;
    }

    if (debounceTimer) clearTimeout(debounceTimer);
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/journal-preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            companyId, documentType, subtotal, vatAmount,
            withholdingTax: withholdingTax || "0",
            paymentMethod: paymentMethod || "เครดิต",
            linkedInvoiceId: linkedInvoiceId || null,
            currencyCode: currencyCode || "THB",
            exchangeRate: exchangeRate || "1",
            lineItemAccounts: lineItemAccounts && lineItemAccounts.length > 0 ? lineItemAccounts : undefined,
          }),
        });
        const data = await res.json();
        setPreview(data);
        if (!isCustomized && data?.available && data.lines?.length > 0) {
          setEditLines(data.lines.map((l: any) => ({
            accountCode: l.accountCode,
            accountName: l.accountName,
            debit: String(l.debit || "0"),
            credit: String(l.credit || "0"),
          })));
        }
      } catch {
        setPreview(null);
      }
      setLoading(false);
    }, 500);
    setDebounceTimer(timer);

    return () => clearTimeout(timer);
  }, [companyId, documentType, subtotal, vatAmount, withholdingTax, paymentMethod, currencyCode, exchangeRate, linkedInvoiceId, lineItemAccounts]);

  const emitLines = useCallback((lines: JournalLine[] | null) => {
    onLinesChange?.(lines);
  }, [onLinesChange]);

  function enterEditMode() {
    if (preview?.available && preview.lines?.length > 0 && editLines.length === 0) {
      setEditLines(preview.lines.map((l: any) => ({
        accountCode: l.accountCode,
        accountName: l.accountName,
        debit: String(l.debit || "0"),
        credit: String(l.credit || "0"),
      })));
    }
    setEditMode(true);
    setIsCustomized(true);
    emitLines(editLines.length > 0 ? editLines : null);
  }

  function resetToAuto() {
    setEditMode(false);
    setIsCustomized(false);
    if (preview?.available && preview.lines) {
      const resetLines = preview.lines.map((l: any) => ({
        accountCode: l.accountCode,
        accountName: l.accountName,
        debit: String(l.debit || "0"),
        credit: String(l.credit || "0"),
      }));
      setEditLines(resetLines);
    }
    emitLines(null);
  }

  function updateLine(idx: number, field: keyof JournalLine, value: string) {
    const newLines = [...editLines];
    newLines[idx] = { ...newLines[idx], [field]: value };
    setEditLines(newLines);
    emitLines(newLines);
  }

  function updateLineAccount(idx: number, code: string, name: string) {
    const newLines = [...editLines];
    newLines[idx] = { ...newLines[idx], accountCode: code, accountName: name };
    setEditLines(newLines);
    emitLines(newLines);
  }

  function addLine() {
    const newLines = [...editLines, { accountCode: "", accountName: "", debit: "0", credit: "0" }];
    setEditLines(newLines);
    emitLines(newLines);
  }

  function removeLine(idx: number) {
    const newLines = editLines.filter((_, i) => i !== idx);
    setEditLines(newLines);
    emitLines(newLines);
  }

  if (!hasAccounting) return null;
  if (!companyId || (sub === 0 && vat === 0)) return null;
  if (preview && !preview.available && preview.noJournalEntry) return null;

  const displayLines = (editMode && isCustomized) ? editLines : (preview?.lines || []);
  const totalDebit = displayLines.reduce((s: number, l: any) => s + (parseFloat(l.debit) || 0), 0);
  const totalCredit = displayLines.reduce((s: number, l: any) => s + (parseFloat(l.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  return (
    <div data-testid="journal-preview-panel" className="border border-[var(--theme-primary)]/30 rounded-lg overflow-hidden bg-white">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-2.5 bg-[#eef4ff] hover:bg-[#e0ecff] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-[var(--theme-primary)]" />
          <span className="text-sm font-medium text-[var(--theme-primary)]">
            {isCustomized ? "บันทึกบัญชี (แก้ไขเอง)" : "ร่างบันทึกบัญชี (Preview)"}
          </span>
          {preview?.formulaName && !isCustomized && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-[var(--theme-primary)]/30 text-[var(--theme-primary)]">
              {preview.formulaName}
            </Badge>
          )}
          {isCustomized && (
            <Badge className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700 border border-amber-300">
              กำหนดเอง
            </Badge>
          )}
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--theme-primary)]" />}
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-[var(--theme-primary)]" /> : <ChevronDown className="h-4 w-4 text-[var(--theme-primary)]" />}
      </button>

      {expanded && (
        <div className="p-3">
          {loading && !preview && (
            <div className="flex items-center justify-center py-4 gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              กำลังคำนวณ...
            </div>
          )}

          {preview && !preview.available && !preview.noJournalEntry && (
            <div className="bg-amber-50 text-amber-700 rounded p-3 flex items-center gap-2 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {preview.message}
            </div>
          )}

          {((preview?.available && preview.lines?.length > 0) || (isCustomized && editLines.length > 0)) && (
            <div className="space-y-2">
              <div className="flex items-center justify-end gap-2 mb-1">
                {!editMode ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1 border-blue-300 text-blue-600 hover:bg-blue-50"
                    onClick={(e) => { e.stopPropagation(); enterEditMode(); }}
                    data-testid="btn-edit-journal"
                  >
                    <Pencil className="h-3 w-3" />
                    แก้ไข
                  </Button>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1 border-amber-300 text-amber-600 hover:bg-amber-50"
                      onClick={(e) => { e.stopPropagation(); resetToAuto(); }}
                      data-testid="btn-reset-journal"
                    >
                      <RotateCcw className="h-3 w-3" />
                      คืนค่าอัตโนมัติ
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1 border-emerald-300 text-emerald-600 hover:bg-emerald-50"
                      onClick={(e) => { e.stopPropagation(); addLine(); }}
                      data-testid="btn-add-journal-line"
                    >
                      <Plus className="h-3 w-3" />
                      เพิ่มบรรทัด
                    </Button>
                  </>
                )}
              </div>

              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="text-xs w-28 py-1.5">รหัสบัญชี</TableHead>
                    <TableHead className="text-xs py-1.5">ชื่อบัญชี</TableHead>
                    <TableHead className="text-xs text-right w-28 py-1.5">เดบิต</TableHead>
                    <TableHead className="text-xs text-right w-28 py-1.5">เครดิต</TableHead>
                    {editMode && <TableHead className="text-xs w-8 py-1.5"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayLines.map((line: any, idx: number) => (
                    <TableRow key={idx}>
                      {editMode ? (
                        <>
                          <TableCell className="py-1">
                            <AccountPickerInput
                              value={line.accountCode}
                              accountName={line.accountName}
                              accounts={accountsList || []}
                              mode="code"
                              onChange={(code, name) => updateLineAccount(idx, code, name)}
                            />
                          </TableCell>
                          <TableCell className="py-1">
                            <AccountPickerInput
                              value={line.accountCode}
                              accountName={line.accountName}
                              accounts={accountsList || []}
                              mode="name"
                              onChange={(code, name) => updateLineAccount(idx, code, name)}
                            />
                          </TableCell>
                          <TableCell className="py-1">
                            <Input
                              type="number"
                              value={parseFloat(line.debit) > 0 ? line.debit : ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                updateLine(idx, "debit", v || "0");
                                if (parseFloat(v) > 0) updateLine(idx, "credit", "0");
                              }}
                              className="h-7 text-xs text-right px-1.5 w-24"
                              placeholder="0.00"
                              step="0.01"
                            />
                          </TableCell>
                          <TableCell className="py-1">
                            <Input
                              type="number"
                              value={parseFloat(line.credit) > 0 ? line.credit : ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                updateLine(idx, "credit", v || "0");
                                if (parseFloat(v) > 0) updateLine(idx, "debit", "0");
                              }}
                              className="h-7 text-xs text-right px-1.5 w-24"
                              placeholder="0.00"
                              step="0.01"
                            />
                          </TableCell>
                          <TableCell className="py-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                              onClick={() => removeLine(idx)}
                              data-testid={`btn-remove-journal-line-${idx}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="text-xs font-mono py-1.5">{line.accountCode}</TableCell>
                          <TableCell className="text-xs py-1.5">{line.accountName}</TableCell>
                          <TableCell className="text-xs text-right py-1.5" style={{ fontVariantNumeric: "tabular-nums" }}>
                            {parseFloat(line.debit) > 0 ? fmt(line.debit) : "-"}
                          </TableCell>
                          <TableCell className="text-xs text-right py-1.5" style={{ fontVariantNumeric: "tabular-nums" }}>
                            {parseFloat(line.credit) > 0 ? fmt(line.credit) : "-"}
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                  <TableRow className="bg-slate-50 font-semibold">
                    <TableCell colSpan={2} className="text-xs text-right py-1.5">รวม</TableCell>
                    <TableCell className="text-xs text-right py-1.5" style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(totalDebit)}</TableCell>
                    <TableCell className="text-xs text-right py-1.5" style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(totalCredit)}</TableCell>
                    {editMode && <TableCell className="py-1.5"></TableCell>}
                  </TableRow>
                </TableBody>
              </Table>

              {isBalanced ? (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                  <Check className="h-3.5 w-3.5" />
                  เดบิต = เครดิต (สมดุล)
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-red-600">
                  <AlertCircle className="h-3.5 w-3.5" />
                  เดบิต ≠ เครดิต (ไม่สมดุล — ผลต่าง {fmt(Math.abs(totalDebit - totalCredit))})
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
