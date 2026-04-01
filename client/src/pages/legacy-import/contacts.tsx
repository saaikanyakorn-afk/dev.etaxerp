import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import LegacyLayout from "@/components/legacy-layout";
import { useLegacyCompany } from "@/lib/legacy-company-context";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useThemeColor } from "@/hooks/use-theme-color";
import { Users, Search, FileText } from "lucide-react";

interface LegacyContact {
  id: number;
  contactCode: string | null;
  contactName: string;
  contactType: string | null;
  taxId: string | null;
  branchNo: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
}

export default function LegacyContactsPage() {
  const { selectedId } = useLegacyCompany();
  const { colors: themeColors } = useThemeColor();
  const [search, setSearch] = useState("");

  const { data: contacts = [], isLoading } = useQuery<LegacyContact[]>({
    queryKey: ["/api/legacy-import/contacts", selectedId],
    queryFn: async () => {
      if (!selectedId) return [];
      const r = await fetch(`/api/legacy-import/contacts?legacyCompanyId=${selectedId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedId,
  });

  const filtered = contacts.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (c.contactCode || "").toLowerCase().includes(q) ||
      c.contactName.toLowerCase().includes(q) ||
      (c.taxId || "").toLowerCase().includes(q) ||
      (c.phone || "").toLowerCase().includes(q)
    );
  });

  const typeLabels: Record<string, string> = {
    customer: "ลูกค้า",
    vendor: "ผู้ขาย",
    supplier: "ผู้จำหน่าย",
    both: "ลูกค้า+ผู้ขาย",
    ลูกค้า: "ลูกค้า",
    ผู้ขาย: "ผู้ขาย",
    "ผู้จำหน่าย": "ผู้จำหน่าย",
  };
  const typeColors: Record<string, string> = {
    customer: "bg-green-100 text-green-700",
    vendor: "bg-orange-100 text-orange-700",
    supplier: "bg-orange-100 text-orange-700",
    both: "bg-purple-100 text-purple-700",
    ลูกค้า: "bg-green-100 text-green-700",
    ผู้ขาย: "bg-orange-100 text-orange-700",
    "ผู้จำหน่าย": "bg-orange-100 text-orange-700",
  };

  return (
    <LegacyLayout>
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg text-white" style={{ background: themeColors.primary }}>
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold" data-testid="text-page-title">คู่ค้า (Contacts)</h1>
            <p className="text-sm text-gray-500">ข้อมูลคู่ค้าจาก TRCloud — read-only</p>
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
                      placeholder="ค้นหาชื่อ, รหัส, เลขภาษี, โทร..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="pl-9"
                      data-testid="input-search-contacts"
                    />
                  </div>
                  <span className="text-sm text-gray-500">
                    {filtered.length} / {contacts.length} รายการ
                  </span>
                </div>
              </CardContent>
            </Card>

            {isLoading ? (
              <Card><CardContent className="py-12 text-center text-gray-400">กำลังโหลด...</CardContent></Card>
            ) : filtered.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-gray-400">ไม่พบข้อมูลคู่ค้า</CardContent></Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" data-testid="table-contacts">
                      <thead>
                        <tr style={{ background: themeColors.primary }} className="text-white">
                          <th className="px-4 py-3 text-left w-24">รหัส</th>
                          <th className="px-4 py-3 text-left">ชื่อ</th>
                          <th className="px-4 py-3 text-center w-24">ประเภท</th>
                          <th className="px-4 py-3 text-left w-32">เลขผู้เสียภาษี</th>
                          <th className="px-4 py-3 text-left w-28">สาขา</th>
                          <th className="px-4 py-3 text-left w-32">โทรศัพท์</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((c, i) => (
                          <tr
                            key={c.id}
                            className="border-b hover:bg-gray-50"
                            data-testid={`row-contact-${c.id}`}
                          >
                            <td className="px-4 py-2.5 font-mono text-xs">{c.contactCode || "-"}</td>
                            <td className="px-4 py-2.5">{c.contactName}</td>
                            <td className="px-4 py-2.5 text-center">
                              {c.contactType && (
                                <span className={`px-2 py-0.5 rounded-full text-xs ${typeColors[c.contactType.toLowerCase()] || "bg-gray-100 text-gray-600"}`}>
                                  {typeLabels[c.contactType.toLowerCase()] || c.contactType}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 font-mono text-xs">{c.taxId || "-"}</td>
                            <td className="px-4 py-2.5 text-xs">{c.branchNo || "-"}</td>
                            <td className="px-4 py-2.5 text-xs">{c.phone || "-"}</td>
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
