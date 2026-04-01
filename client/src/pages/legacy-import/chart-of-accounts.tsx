import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import LegacyLayout from "@/components/legacy-layout";
import { useLegacyCompany } from "@/lib/legacy-company-context";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useThemeColor } from "@/hooks/use-theme-color";
import { BookOpen, Search, Hash, FileText } from "lucide-react";

interface LegacyAccount {
  id: number;
  accountCode: string;
  accountName: string;
  accountType: string | null;
  parentCode: string | null;
  level: number | null;
  isHeader: boolean;
  normalBalance: string | null;
  category: string | null;
}

export default function LegacyChartOfAccountsPage() {
  const { selectedId } = useLegacyCompany();
  const { colors: themeColors } = useThemeColor();
  const [search, setSearch] = useState("");

  const { data: accounts = [], isLoading } = useQuery<LegacyAccount[]>({
    queryKey: ["/api/legacy-import/chart-of-accounts", selectedId],
    queryFn: async () => {
      if (!selectedId) return [];
      const r = await fetch(`/api/legacy-import/chart-of-accounts?legacyCompanyId=${selectedId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedId,
  });

  const filtered = accounts.filter(a => {
    if (!search) return true;
    const q = search.toLowerCase();
    return a.accountCode.toLowerCase().includes(q) || a.accountName.toLowerCase().includes(q);
  });

  const typeColors: Record<string, string> = {
    asset: "bg-blue-100 text-blue-700",
    liability: "bg-red-100 text-red-700",
    equity: "bg-purple-100 text-purple-700",
    revenue: "bg-green-100 text-green-700",
    expense: "bg-orange-100 text-orange-700",
    สินทรัพย์: "bg-blue-100 text-blue-700",
    หนี้สิน: "bg-red-100 text-red-700",
    "ส่วนของเจ้าของ": "bg-purple-100 text-purple-700",
    ทุน: "bg-purple-100 text-purple-700",
    รายได้: "bg-green-100 text-green-700",
    ค่าใช้จ่าย: "bg-orange-100 text-orange-700",
  };

  return (
    <LegacyLayout>
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg text-white" style={{ background: themeColors.primary }}>
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold" data-testid="text-page-title">ผังบัญชี (Chart of Accounts)</h1>
            <p className="text-sm text-gray-500">ข้อมูลผังบัญชีจาก TRCloud — read-only</p>
          </div>
        </div>

        {!selectedId ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-400">
              <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>กรุณานำเข้าข้อมูลบริษัทก่อน</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-3">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="ค้นหารหัสหรือชื่อบัญชี..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="pl-9"
                      data-testid="input-search-accounts"
                    />
                  </div>
                  <span className="text-sm text-gray-500">
                    {filtered.length} / {accounts.length} รายการ
                  </span>
                </div>
              </CardContent>
            </Card>

            {isLoading ? (
              <Card><CardContent className="py-12 text-center text-gray-400">กำลังโหลด...</CardContent></Card>
            ) : filtered.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-gray-400">ไม่พบข้อมูลผังบัญชี</CardContent></Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" data-testid="table-chart-of-accounts">
                      <thead>
                        <tr style={{ background: themeColors.primary }} className="text-white">
                          <th className="px-4 py-3 text-left w-32">รหัสบัญชี</th>
                          <th className="px-4 py-3 text-left">ชื่อบัญชี</th>
                          <th className="px-4 py-3 text-center w-28">ประเภท</th>
                          <th className="px-4 py-3 text-center w-20">ระดับ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((a, i) => (
                          <tr
                            key={a.id}
                            className={`border-b hover:bg-gray-50 ${a.isHeader ? "bg-gray-50 font-semibold" : ""}`}
                            data-testid={`row-account-${a.accountCode}`}
                          >
                            <td className="px-4 py-2.5 font-mono text-xs" style={{ paddingLeft: a.level ? `${16 + (a.level - 1) * 16}px` : "16px" }}>
                              {a.accountCode}
                            </td>
                            <td className="px-4 py-2.5">
                              {a.isHeader ? (
                                <span className="font-semibold">{a.accountName}</span>
                              ) : (
                                a.accountName
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {a.accountType && (
                                <span className={`px-2 py-0.5 rounded-full text-xs ${typeColors[a.accountType.toLowerCase()] || "bg-gray-100 text-gray-600"}`}>
                                  {a.accountType}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-center text-xs text-gray-500">
                              {a.level || "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </LegacyLayout>
  );
}
