import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Search, UserCircle, Users, Building2, Filter, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useCompany } from "@/lib/company-context";

export default function AssignmentsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [filterEmployee, setFilterEmployee] = useState("all");
  const { primaryCompanyId, selectedCompanyId } = useCompany();
  const firmCompanyId = primaryCompanyId || selectedCompanyId;

  const { data: clientsData } = useQuery<any[]>({
    queryKey: ["/api/firm-clients"],
    queryFn: async () => {
      const r = await fetch("/api/firm-clients", { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
  });
  const allClients = Array.isArray(clientsData) ? clientsData : [];

  const { data: employeesData } = useQuery<any[]>({
    queryKey: ["/api/employees", firmCompanyId],
    queryFn: async () => {
      const url = firmCompanyId ? `/api/employees?companyId=${firmCompanyId}` : "/api/employees";
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!firmCompanyId,
  });
  const employees = Array.isArray(employeesData) ? employeesData.filter((e: any) => e.active) : [];

  const workloadMap = useMemo(() => {
    const map: Record<number, number> = {};
    employees.forEach((e: any) => { map[e.id] = 0; });
    allClients.forEach((c: any) => {
      if (c.assignedTo) {
        map[c.assignedTo] = (map[c.assignedTo] || 0) + 1;
      }
    });
    return map;
  }, [allClients, employees]);

  const unassignedCount = allClients.filter(c => !c.assignedTo).length;

  const filteredClients = useMemo(() => {
    let list = allClients;
    if (filterEmployee === "unassigned") {
      list = list.filter(c => !c.assignedTo);
    } else if (filterEmployee !== "all") {
      list = list.filter(c => String(c.assignedTo) === filterEmployee);
    }
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((c: any) =>
        (c.name || "").toLowerCase().includes(s) ||
        (c.taxId || "").includes(s) ||
        (c.contactPerson || "").toLowerCase().includes(s)
      );
    }
    return list;
  }, [allClients, filterEmployee, search]);

  const assignMutation = useMutation({
    mutationFn: async ({ clientId, employeeId }: { clientId: number; employeeId: number | null }) => {
      const r = await fetch(`/api/firm-clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedTo: employeeId }),
        credentials: "include",
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message); }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/firm-clients"] });
      toast({ title: "เปลี่ยนผู้รับผิดชอบสำเร็จ" });
    },
    onError: (err: any) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  const getDisplayName = (emp: any) => emp?.nickname || emp?.firstName || emp?.fullName || "?";

  const getEmployeeName = (id: number | null) => {
    if (!id) return null;
    const emp = employees.find((e: any) => e.id === id);
    return getDisplayName(emp);
  };

  const sortedEmployees = useMemo(() => {
    return [...employees].sort((a: any, b: any) => {
      const nameA = getDisplayName(a);
      const nameB = getDisplayName(b);
      return nameA.localeCompare(nameB, "th");
    });
  }, [employees]);

  const WORKLOAD_COLORS = ["#03c9d7", "#fb9678", "#fec90f", "#05b187", "var(--theme-primary)", "#a855f7", "#f97316", "#ec4899"];

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/firm-mgmt/clients")} data-testid="button-back-clients">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-assignments-title">มอบหมายงาน</h1>
            <p className="text-sm text-muted-foreground">เปลี่ยนผู้รับผิดชอบลูกค้าได้ทันทีจาก dropdown</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {sortedEmployees.map((emp: any, i: number) => {
            const count = workloadMap[emp.id] || 0;
            const color = WORKLOAD_COLORS[i % WORKLOAD_COLORS.length];
            const displayName = getDisplayName(emp);
            return (
              <Card
                key={emp.id}
                className="cursor-pointer hover:shadow-md transition-all border-2"
                style={{ borderColor: filterEmployee === String(emp.id) ? color : "transparent" }}
                onClick={() => setFilterEmployee(filterEmployee === String(emp.id) ? "all" : String(emp.id))}
                data-testid={`card-workload-${emp.id}`}
              >
                <CardContent className="p-3 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: color }}>
                    {displayName.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate max-w-[120px]">{displayName}</p>
                    <p className="text-xs text-muted-foreground">{count} บริษัท</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {unassignedCount > 0 && (
            <Card
              className="cursor-pointer hover:shadow-md transition-all border-2"
              style={{ borderColor: filterEmployee === "unassigned" ? "#f94d4d" : "transparent" }}
              onClick={() => setFilterEmployee(filterEmployee === "unassigned" ? "all" : "unassigned")}
              data-testid="card-workload-unassigned"
            >
              <CardContent className="p-3 flex items-center gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold bg-gray-400">
                  ?
                </div>
                <div>
                  <p className="text-sm font-medium text-red-500">ยังไม่มอบหมาย</p>
                  <p className="text-xs text-muted-foreground">{unassignedCount} บริษัท</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="shadow-sm rounded-xl">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Building2 className="h-5 w-5 text-[#fb9678]" />
                รายชื่อลูกค้า ({filteredClients.length}/{allClients.length})
              </CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="ค้นหาชื่อ, เลขภาษี..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-8 h-9 w-[200px]"
                    data-testid="input-search-assignments"
                  />
                </div>
                {filterEmployee !== "all" && (
                  <Button variant="outline" size="sm" onClick={() => setFilterEmployee("all")} data-testid="button-clear-filter">
                    <Filter className="h-3.5 w-3.5 mr-1" />ล้าง
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left p-3 font-medium w-[40px]">#</th>
                    <th className="text-left p-3 font-medium">ชื่อลูกค้า</th>
                    <th className="text-left p-3 font-medium hidden md:table-cell">เลขผู้เสียภาษี</th>
                    <th className="text-left p-3 font-medium hidden lg:table-cell">ผู้ติดต่อ</th>
                    <th className="text-left p-3 font-medium w-[250px]">ผู้รับผิดชอบ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-muted-foreground">
                        <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
                        <p>ไม่พบรายการ</p>
                      </td>
                    </tr>
                  ) : (
                    filteredClients.map((client: any, idx: number) => (
                      <tr key={client.id} className="border-b hover:bg-muted/20 transition-colors" data-testid={`row-assignment-${client.id}`}>
                        <td className="p-3 text-muted-foreground">{idx + 1}</td>
                        <td className="p-3">
                          <div className="font-medium">{client.name}</div>
                          {client.businessType && (
                            <span className="text-xs text-muted-foreground">{client.businessType}</span>
                          )}
                        </td>
                        <td className="p-3 hidden md:table-cell text-muted-foreground">{client.taxId || "-"}</td>
                        <td className="p-3 hidden lg:table-cell text-muted-foreground">{client.contactPerson || "-"}</td>
                        <td className="p-3">
                          <Select
                            value={client.assignedTo ? String(client.assignedTo) : "none"}
                            onValueChange={(val) => {
                              const empId = val === "none" ? null : Number(val);
                              assignMutation.mutate({ clientId: client.id, employeeId: empId });
                            }}
                          >
                            <SelectTrigger
                              className={`h-9 text-sm ${client.assignedTo ? "border-[#03c9d7] bg-[#f0fdfe] dark:bg-[#03c9d7]/10 text-foreground" : "border-[#f94d4d] bg-[#fef2f2] dark:bg-[#f94d4d]/10 text-foreground"}`}
                              data-testid={`select-assign-${client.id}`}
                            >
                              <SelectValue placeholder="เลือกผู้รับผิดชอบ" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">
                                <span className="text-muted-foreground">-- ยังไม่มอบหมาย --</span>
                              </SelectItem>
                              {sortedEmployees.map((emp: any) => (
                                <SelectItem key={emp.id} value={String(emp.id)}>
                                  <div className="flex items-center gap-2">
                                    <UserCircle className="h-4 w-4 text-[#03c9d7]" />
                                    <span>{getDisplayName(emp)}</span>
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{workloadMap[emp.id] || 0}</Badge>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
