import { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ThaiDateInput from "@/components/thai-date-input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { BookOpen, Printer, FileDown, ExternalLink, Search, X, RefreshCw } from "lucide-react";
import * as XLSX from "xlsx";
import { formatDate, formatNumber } from "@/lib/format";
import { useLocation, useSearch } from "wouter";
import { toLocalDateStr } from "@/lib/utils";
import { useLanguage } from "@/hooks/use-language";
import ReportLayout from "@/components/report-layout";

import { useDateSettings } from "@/hooks/use-date-settings";
function getDocLink(sourceDocType: string | null, sourceDocId: number | null, journalEntryId: number | null): string | null {
  if (sourceDocType) {
    switch (sourceDocType) {
      case "quotation": return `/sales/quote`;
      case "sales_order": return `/sales/order`;
      case "invoice": return `/sales/invoice`;
      case "tax_invoice": return `/sales/tax-invoice`;
      case "receipt": return `/sales/receipt`;
    }
  }
  if (journalEntryId) return `/journal`;
  return null;
}

function fmt(val: string | number | null | undefined): string {
  const n = parseFloat(String(val || "0"));
  if (n === 0) return "-";
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const JOURNAL_BOOK_MAP: Record<string, number> = {
  general: 1,
  receive: 2,
  payment: 3,
  sales: 4,
  purchase: 5,
};

function bookNo(book: string | null | undefined): string {
  if (!book) return "-";
  return String(JOURNAL_BOOK_MAP[book] ?? "-");
}

export default function GeneralLedger() {
  const [, navigate] = useLocation();
  const searchStr = useSearch();
  const { selectedCompany } = useCompany();
  const { acctName } = useLanguage();
  const companyId = selectedCompany?.id;

  const today = new Date();
  const firstDay = new Date(today.getFullYear(), 0, 1);
  const [startDate, setStartDate] = useState(toLocalDateStr(firstDay));
  const [endDate, setEndDate] = useState(toLocalDateStr(today));
  const [accountCode, setAccountCode] = useState("");
  const [accountSearch, setAccountSearch] = useState("");
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const accountDropdownRef = useRef<HTMLDivElement>(null);
  const accountInputRef = useRef<HTMLInputElement>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(searchStr);
    const qStart = params.get("startDate");
    const qEnd = params.get("endDate");
    const qCode = params.get("accountCode");
    if (qStart) setStartDate(qStart);
    if (qEnd) setEndDate(qEnd);
    if (qCode !== null) setAccountCode(qCode);
    setInitialized(true);
  }, [searchStr]);

  const { dateEra, dateFmt } = useDateSettings();
  const { data: docSettings } = useQuery<any>({
    queryKey: ["/api/document-settings", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const res = await fetch(`/api/document-settings?companyId=${companyId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!companyId,
  });
  const { data: allAccounts = [] } = useQuery<any[]>({
    queryKey: ["/api/accounts", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const res = await fetch(`/api/accounts?companyId=${companyId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!companyId,
  });

  const filteredAccounts = useMemo(() => {
    if (!accountSearch.trim()) return allAccounts.slice(0, 30);
    const q = accountSearch.toLowerCase();
    return allAccounts.filter((a: any) =>
      (a.code && a.code.includes(q)) ||
      (a.name && a.name.toLowerCase().includes(q)) ||
      (a.nameTh && a.nameTh.toLowerCase().includes(q)) ||
      (a.nameZh && a.nameZh.toLowerCase().includes(q))
    ).slice(0, 30);
  }, [allAccounts, accountSearch]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(e.target as Node)) {
        setShowAccountDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { data: reportData, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/reports/general-ledger", companyId, startDate, endDate, accountCode],
    queryFn: async () => {
      if (!companyId) return null;
      const params = new URLSearchParams({
        companyId: String(companyId),
        startDate,
        endDate,
      });
      if (accountCode.trim()) params.set("accountCode", accountCode.trim());
      const res = await fetch(`/api/reports/general-ledger?${params}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!companyId && !!startDate && !!endDate,
    placeholderData: keepPreviousData,
  });

  const accounts: any[] = Array.isArray(reportData) ? reportData : [];
  const companyName = selectedCompany?.name || "";

  function handlePrint() {
    if (accounts.length === 0) return;
    const sections = accounts.map((acct: any) => {
      const lines = acct.lines || [];
      const lineRows = lines.map((l: any) =>
        `<tr>
          <td>${formatDate(l.entryDate, dateEra, dateFmt)}</td>
          <td style="text-align:center">${bookNo(l.journalBook)}</td>
          <td style="color:#3b82f6;font-weight:500">${l.reference || "-"}</td>
          <td>${l.entryDescription || "-"}</td>
          <td style="font-size:10px;color:#666">${l.description || "-"}</td>
          <td style="text-align:right;font-family:'Sarabun',sans-serif;font-variant-numeric:tabular-nums">${fmt(l.debit)}</td>
          <td style="text-align:right;font-family:'Sarabun',sans-serif;font-variant-numeric:tabular-nums">${fmt(l.credit)}</td>
          <td style="text-align:right;font-family:'Sarabun',sans-serif;font-variant-numeric:tabular-nums">${fmt(l.balance)}</td>
        </tr>`
      ).join("");
      const totalDebit = lines.reduce((s: number, l: any) => s + (parseFloat(l.debit) || 0), 0);
      const totalCredit = lines.reduce((s: number, l: any) => s + (parseFloat(l.credit) || 0), 0);
      return `<div class="acct-section">
        <div class="acct-header">${acct.accountCode} — ${acct.accountNameTh || acct.accountName || "-"}</div>
        <table><thead><tr>
          <th style="width:80px">วันที่</th><th style="width:50px;text-align:center">สมุด</th><th style="width:110px">อ้างอิง</th><th>รายละเอียด</th><th style="width:120px;font-size:10px">Note</th>
          <th style="width:95px;text-align:right">เดบิต</th><th style="width:95px;text-align:right">เครดิต</th>
          <th style="width:100px;text-align:right">ยอดคงเหลือ</th>
        </tr></thead><tbody>
          ${acct.beginBalance ? `<tr style="background:#eef6ff"><td colspan="5" style="text-align:right;font-weight:500;color:#1d4ed8">ยอดยกมา</td><td style="text-align:right">-</td><td style="text-align:right">-</td><td style="text-align:right;font-weight:700;color:#1d4ed8;font-family:'Sarabun',sans-serif;font-variant-numeric:tabular-nums">${fmt(acct.beginBalance)}</td></tr>` : ""}
          ${lineRows}
          <tr class="total-row">
            <td colspan="5" style="text-align:right;font-weight:700">[${acct.accountCode}] รวม</td>
            <td style="text-align:right;font-family:'Sarabun',sans-serif;font-variant-numeric:tabular-nums;font-weight:700">${fmt(totalDebit)}</td>
            <td style="text-align:right;font-family:'Sarabun',sans-serif;font-variant-numeric:tabular-nums;font-weight:700">${fmt(totalCredit)}</td>
            <td style="text-align:right;font-family:'Sarabun',sans-serif;font-variant-numeric:tabular-nums;font-weight:700">${fmt(acct.endBalance)}</td>
          </tr>
        </tbody></table>
      </div>`;
    }).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>บัญชีแยกประเภท</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family: 'Sarabun', sans-serif; font-size:12px; padding:20px; }
        h2 { text-align:center; margin-bottom:4px; font-size:16px; }
        .subtitle { text-align:center; margin-bottom:16px; font-size:13px; color:#555; }
        .acct-section { margin-bottom:16px; page-break-inside:avoid; }
        .acct-header { background:#f1f5f9; padding:6px 10px; font-weight:700; font-size:12px; border:1px solid #ddd; border-bottom:none; }
        table { width:100%; border-collapse:collapse; table-layout:fixed; }
        th, td { border:1px solid #ccc; padding:3px 6px; font-size:11px; }
        th { background:var(--theme-table-header); color:white; font-weight:600; }
        .total-row td { background:#f1f5f9; border-top:2px solid #333; }
        @media print { body { padding:10px; } .acct-section { page-break-inside:avoid; } }
      </style>
    </head><body>
      <h2>บัญชีแยกประเภท</h2>
      <div class="subtitle">${companyName} — ${formatDate(startDate, dateEra, dateFmt)} ถึง ${formatDate(endDate, dateEra, dateFmt)}</div>
      ${sections}
    </body></html>`;

    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
      setTimeout(() => w.print(), 300);
    }
  }

  function handleExcel() {
    if (accounts.length === 0) return;
    const allRows: any[][] = [
      [`บัญชีแยกประเภท — ${companyName}`],
      [`${formatDate(startDate, dateEra, dateFmt)} ถึง ${formatDate(endDate, dateEra, dateFmt)}`],
      [],
    ];
    accounts.forEach((acct: any) => {
      allRows.push([`${acct.accountCode} — ${acct.accountNameTh || acct.accountName || "-"}`]);
      allRows.push(["วันที่", "สมุดบัญชี", "อ้างอิง", "รายละเอียด", "Note", "เดบิต", "เครดิต", "ยอดคงเหลือ"]);
      const lines = acct.lines || [];
      lines.forEach((l: any) => {
        allRows.push([
          formatDate(l.entryDate, dateEra, dateFmt),
          bookNo(l.journalBook),
          l.reference || "-",
          l.entryDescription || "-",
          l.description || "-",
          parseFloat(l.debit) || 0,
          parseFloat(l.credit) || 0,
          l.balance || 0,
        ]);
      });
      const totalDebit = lines.reduce((s: number, l: any) => s + (parseFloat(l.debit) || 0), 0);
      const totalCredit = lines.reduce((s: number, l: any) => s + (parseFloat(l.credit) || 0), 0);
      allRows.push(["", "", "", "", `[${acct.accountCode}] รวม`, totalDebit, totalCredit, acct.endBalance || 0]);
      allRows.push([]);
    });
    const ws = XLSX.utils.aoa_to_sheet(allRows);
    ws["!cols"] = [{ wch: 12 }, { wch: 10 }, { wch: 18 }, { wch: 35 }, { wch: 25 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "บัญชีแยกประเภท");
    XLSX.writeFile(wb, `บัญชีแยกประเภท_${startDate}_${endDate}.xlsx`);
  }

  return (
    <ReportLayout fullWidth title="บัญชีแยกประเภท" icon={<BookOpen className="h-5 w-5" />} showNavTabs>
        <div className="bg-white border rounded-xl shadow-sm">
          <div className="p-4 border-b flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium whitespace-nowrap">วันที่เริ่มต้น</label>
              <ThaiDateInput
                value={startDate}
                onChange={setStartDate}
                dateEra={dateEra}
                dateFmt={dateFmt}
                data-testid="input-start-date"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium whitespace-nowrap">วันที่สิ้นสุด</label>
              <ThaiDateInput
                value={endDate}
                onChange={setEndDate}
                dateEra={dateEra}
                dateFmt={dateFmt}
                data-testid="input-end-date"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium whitespace-nowrap">รหัสบัญชี</label>
              <div className="relative" ref={accountDropdownRef}>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    ref={accountInputRef}
                    type="text"
                    placeholder="ทุกบัญชี"
                    value={showAccountDropdown ? accountSearch : (accountCode ? (() => { const found = allAccounts.find((a: any) => a.code === accountCode); return found ? `${found.code} ${acctName(found)}` : accountCode; })() : "")}
                    onChange={e => {
                      setAccountSearch(e.target.value);
                      setShowAccountDropdown(true);
                      if (!e.target.value.trim()) {
                        setAccountCode("");
                      }
                    }}
                    onFocus={() => setShowAccountDropdown(true)}
                    className="h-9 w-[240px] rounded-lg pl-8 pr-8"
                    data-testid="input-account-code"
                  />
                  {(accountCode || accountSearch) && (
                    <button
                      onClick={() => { setAccountCode(""); setAccountSearch(""); setShowAccountDropdown(false); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      data-testid="button-clear-account"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {showAccountDropdown && (
                  <div className="absolute z-50 top-full left-0 mt-1 w-[340px] max-h-[300px] overflow-y-auto bg-white border rounded-lg shadow-lg">
                    <div
                      className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer border-b text-muted-foreground"
                      onClick={() => { setAccountCode(""); setAccountSearch(""); setShowAccountDropdown(false); }}
                      data-testid="option-all-accounts"
                    >
                      ทุกบัญชี
                    </div>
                    {filteredAccounts.map((a: any) => (
                      <div
                        key={a.id}
                        className={`px-3 py-1.5 text-sm hover:bg-blue-50 cursor-pointer flex items-center gap-2 ${accountCode === a.code ? "bg-blue-50 font-medium" : ""}`}
                        onClick={() => {
                          setAccountCode(a.code);
                          setAccountSearch("");
                          setShowAccountDropdown(false);
                        }}
                        data-testid={`option-account-${a.code}`}
                      >
                        <span className="text-xs text-muted-foreground w-[50px] flex-shrink-0 tabular-nums">{a.code}</span>
                        <span className="truncate">{acctName(a) || "-"}</span>
                      </div>
                    ))}
                    {filteredAccounts.length === 0 && (
                      <div className="px-3 py-4 text-sm text-center text-muted-foreground">ไม่พบบัญชี</div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1" />
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs border-green-400 text-green-600 hover:bg-green-50"
              onClick={() => refetch()}
              disabled={isLoading}
              data-testid="button-generate"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
              สร้างรายงาน
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs border-blue-300 text-blue-600 hover:bg-blue-50"
              onClick={handlePrint}
              data-testid="button-print"
            >
              <Printer className="h-3.5 w-3.5" />
              พิมพ์
            </Button>
            <Button
              size="sm"
              className="h-8 gap-1.5 text-xs text-white hover:opacity-90"
              style={{ background: "#03c9d7" }}
              onClick={handleExcel}
              data-testid="button-excel"
            >
              <FileDown className="h-3.5 w-3.5" />
              Excel
            </Button>
          </div>

          <div className="p-4 space-y-6">
            {isLoading ? (
              <div className="py-12 text-center text-muted-foreground text-sm">กำลังโหลด...</div>
            ) : accounts.length === 0 ? (
              <div className="py-12 text-center">
                <BookOpen className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-muted-foreground text-sm" data-testid="text-empty-state">ไม่พบข้อมูลบัญชีแยกประเภทในช่วงวันที่ที่เลือก</p>
              </div>
            ) : (
              accounts.map((account: any) => {
                const lines: any[] = account.lines || [];
                const totalDebit = lines.reduce((s: number, l: any) => s + (parseFloat(l.debit) || 0), 0);
                const totalCredit = lines.reduce((s: number, l: any) => s + (parseFloat(l.credit) || 0), 0);

                return (
                  <div key={account.accountCode} className="border rounded-lg overflow-hidden" data-testid={`section-account-${account.accountCode}`}>
                    <div className="px-4 py-2.5 bg-gray-50 border-b flex items-center gap-2">
                      <span className="tabular-nums text-sm font-semibold">{account.accountCode}</span>
                      <span className="text-sm font-medium">{account.accountNameTh || account.accountName || "-"}</span>
                    </div>
                    <div className="overflow-x-auto">
                      <Table className="table-fixed w-full">
                        <colgroup>
                          <col style={{ width: "85px" }} />
                          <col style={{ width: "55px" }} />
                          <col style={{ width: "120px" }} />
                          <col />
                          <col style={{ width: "140px" }} />
                          <col style={{ width: "100px" }} />
                          <col style={{ width: "100px" }} />
                          <col style={{ width: "110px" }} />
                        </colgroup>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent" style={{ background: "var(--theme-table-header)" }}>
                            <TableHead className="text-sm font-bold text-white">วันที่</TableHead>
                            <TableHead className="text-sm font-bold text-white text-center whitespace-nowrap">สมุดบัญชี</TableHead>
                            <TableHead className="text-sm font-bold text-white">อ้างอิง</TableHead>
                            <TableHead className="text-sm font-bold text-white">รายละเอียด</TableHead>
                            <TableHead className="text-sm font-bold text-white">Note</TableHead>
                            <TableHead className="text-sm font-bold text-white text-right">เดบิต</TableHead>
                            <TableHead className="text-sm font-bold text-white text-right">เครดิต</TableHead>
                            <TableHead className="text-sm font-bold text-white text-right">ยอดคงเหลือ</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {lines.length === 0 && !account.beginBalance ? (
                            <TableRow>
                              <TableCell colSpan={8} className="py-6 text-center text-muted-foreground text-sm">ไม่มีรายการ</TableCell>
                            </TableRow>
                          ) : (
                            <>
                              {account.beginBalance !== 0 && account.beginBalance !== undefined && (
                                <TableRow className="bg-blue-50/40">
                                  <TableCell colSpan={5} className="text-sm py-2 text-right pr-4 font-medium text-blue-700">ยอดยกมา</TableCell>
                                  <TableCell className="text-sm py-2 text-right font-medium tabular-nums">-</TableCell>
                                  <TableCell className="text-sm py-2 text-right font-medium tabular-nums">-</TableCell>
                                  <TableCell className="text-sm py-2 text-right font-bold tabular-nums text-blue-700">{fmt(account.beginBalance)}</TableCell>
                                </TableRow>
                              )}
                              {lines.map((line: any, idx: number) => (
                                <TableRow key={idx} className="hover:bg-blue-50/30" data-testid={`row-line-${account.accountCode}-${idx}`}>
                                  <TableCell className="text-sm py-2 tabular-nums">{formatDate(line.entryDate, dateEra, dateFmt)}</TableCell>
                                  <TableCell className="text-sm py-2 text-center tabular-nums">{bookNo(line.journalBook)}</TableCell>
                                  <TableCell className="text-sm py-2 font-medium">
                                    {(() => {
                                      const link = getDocLink(line.sourceDocType, line.sourceDocId, line.journalEntryId);
                                      if (link) {
                                        return (
                                          <button
                                            onClick={() => navigate(link)}
                                            className="text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1 cursor-pointer"
                                            data-testid={`link-ref-${account.accountCode}-${idx}`}
                                          >
                                            {line.reference || "-"}
                                            <ExternalLink className="h-3 w-3" />
                                          </button>
                                        );
                                      }
                                      return <span className="text-blue-600">{line.reference || "-"}</span>;
                                    })()}
                                  </TableCell>
                                  <TableCell className="text-sm py-2">{line.entryDescription || "-"}</TableCell>
                                  <TableCell className="text-xs py-2 text-muted-foreground">{line.description || "-"}</TableCell>
                                  <TableCell className="text-sm py-2 text-right font-medium tabular-nums">{fmt(line.debit)}</TableCell>
                                  <TableCell className="text-sm py-2 text-right font-medium tabular-nums">{fmt(line.credit)}</TableCell>
                                  <TableCell className="text-sm py-2 text-right font-medium tabular-nums">{fmt(line.balance)}</TableCell>
                                </TableRow>
                              ))}
                              <TableRow className="bg-gray-50 font-bold border-t-2">
                                <TableCell colSpan={5} className="text-sm py-2.5 text-right pr-4">[{account.accountCode}] รวม</TableCell>
                                <TableCell className="text-sm py-2.5 text-right tabular-nums">{fmt(totalDebit)}</TableCell>
                                <TableCell className="text-sm py-2.5 text-right tabular-nums">{fmt(totalCredit)}</TableCell>
                                <TableCell className="text-sm py-2.5 text-right tabular-nums">{fmt(account.endBalance)}</TableCell>
                              </TableRow>
                            </>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
    </ReportLayout>
  );
}
