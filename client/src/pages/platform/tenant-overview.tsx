import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Building2, Users, Shield, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Briefcase, CreditCard, Eye } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import PlatformLayout from "@/components/platform-layout";

const TENANT_TYPE_LABELS: Record<string, string> = {
  accounting_firm: "สำนักงานบัญชี",
  general_business: "ธุรกิจทั่วไป",
  ecommerce: "อีคอมเมิร์ซ",
  restaurant: "ร้านอาหาร",
};

const TENANT_TYPE_COLORS: Record<string, string> = {
  accounting_firm: "bg-blue-100 text-blue-700",
  general_business: "bg-green-100 text-green-700",
  ecommerce: "bg-purple-100 text-purple-700",
  restaurant: "bg-orange-100 text-orange-700",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  trial: "bg-yellow-100 text-yellow-700",
  expired: "bg-red-100 text-red-700",
  suspended: "bg-gray-100 text-gray-700",
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  superadmin: "Super Admin",
  admin: "ผู้ดูแล",
  manager: "ผู้จัดการ",
  accountant: "นักบัญชี",
  employee: "พนักงาน",
  client: "ลูกค้า",
};

interface TenantOverviewData {
  tenants: Array<{
    tenant: {
      id: number;
      name: string;
      tenantType: string;
      status: string;
      contactName: string | null;
      contactPhone: string | null;
      contactEmail: string | null;
    };
    subscription: {
      status: string;
      planName: string;
      planCode: string | null;
      trialEndsAt: string | null;
      enabledModules: string[] | null;
    } | null;
    companies: Array<{
      id: number;
      name: string;
      firmClientCount: number;
    }>;
    users: Array<{
      id: number;
      fullName: string;
      username: string;
      role: string;
      companyAccess: number[];
    }>;
    stats: {
      companyCount: number;
      userCount: number;
      adminCount: number;
    };
  }>;
  securityAudit: {
    checkDocOwnershipCoverage: string;
    companyIdFilterPattern: string;
    tenantIsolation: string;
    allowedCompanyIds: string;
    knownFixedIssues: Array<{
      endpoint: string;
      issue: string;
      status: string;
      fixDate: string;
    }>;
    recommendations: string[];
  };
  moduleList: Array<{ key: string; label: string }>;
}

function TenantCard({ data, moduleList }: { data: TenantOverviewData["tenants"][0]; moduleList: Array<{ key: string; label: string }> }) {
  const [expanded, setExpanded] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const { tenant, subscription, companies: comps, users: tenantUsers, stats } = data;
  const enabledModules = subscription?.enabledModules || [];

  return (
    <Card className="border shadow-sm hover:shadow-md transition-shadow" data-testid={`card-tenant-${tenant.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#fb9678]/10 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-[#fb9678]" />
            </div>
            <div>
              <CardTitle className="text-base">{tenant.name}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className={TENANT_TYPE_COLORS[tenant.tenantType] || "bg-gray-100"}>
                  {TENANT_TYPE_LABELS[tenant.tenantType] || tenant.tenantType}
                </Badge>
                <Badge variant="outline" className={STATUS_COLORS[tenant.status] || "bg-gray-100"}>
                  {tenant.status === "active" ? "ใช้งาน" : tenant.status}
                </Badge>
                {subscription && (
                  <Badge variant="outline" className={STATUS_COLORS[subscription.status] || "bg-gray-100"}>
                    {subscription.planName}
                    {subscription.status === "trial" && " (ทดลอง)"}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1" title="บริษัท">
              <Briefcase className="h-4 w-4" />
              <span>{stats.companyCount}</span>
            </div>
            <div className="flex items-center gap-1" title="ผู้ใช้">
              <Users className="h-4 w-4" />
              <span>{stats.userCount}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              data-testid={`button-expand-tenant-${tenant.id}`}
            >
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          <Separator className="mb-4" />

          {tenant.contactName && (
            <div className="text-sm text-muted-foreground mb-3">
              ติดต่อ: {tenant.contactName}
              {tenant.contactPhone && ` | ${tenant.contactPhone}`}
              {tenant.contactEmail && ` | ${tenant.contactEmail}`}
            </div>
          )}

          <div className="mb-4">
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
              <CreditCard className="h-4 w-4" />
              โมดูลที่เปิดใช้งาน
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {moduleList.map(mod => {
                const isEnabled = enabledModules.includes(mod.key);
                return (
                  <TooltipProvider key={mod.key}>
                    <Tooltip>
                      <TooltipTrigger>
                        <Badge
                          variant={isEnabled ? "default" : "outline"}
                          className={isEnabled ? "bg-[#05b187] hover:bg-[#05b187]/90 text-white" : "text-gray-400 border-gray-200"}
                          data-testid={`badge-module-${tenant.id}-${mod.key}`}
                        >
                          {mod.label}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        {isEnabled ? "เปิดใช้งาน" : "ยังไม่เปิด"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
            </div>
          </div>

          <div className="mb-4">
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
              <Building2 className="h-4 w-4" />
              บริษัท ({comps.length})
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {comps.map(c => (
                <div key={c.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm" data-testid={`row-company-${c.id}`}>
                  <span className="truncate">{c.name}</span>
                  {c.firmClientCount > 0 && (
                    <Badge variant="outline" className="ml-2 shrink-0 text-xs">
                      {c.firmClientCount} ลูกค้า
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowUsers(!showUsers)}
              className="mb-2 text-sm font-semibold"
              data-testid={`button-toggle-users-${tenant.id}`}
            >
              <Eye className="h-4 w-4 mr-1" />
              ผู้ใช้งาน ({tenantUsers.length})
              {showUsers ? <ChevronDown className="h-3 w-3 ml-1" /> : <ChevronRight className="h-3 w-3 ml-1" />}
            </Button>
            {showUsers && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border rounded-lg overflow-hidden">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">ชื่อ</th>
                      <th className="text-left px-3 py-2 font-medium">Username</th>
                      <th className="text-left px-3 py-2 font-medium">บทบาท</th>
                      <th className="text-left px-3 py-2 font-medium">เข้าถึงบริษัท</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenantUsers.map(u => (
                      <tr key={u.id} className="border-t hover:bg-gray-50" data-testid={`row-user-${u.id}`}>
                        <td className="px-3 py-2">{u.fullName}</td>
                        <td className="px-3 py-2 text-muted-foreground">{u.username}</td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className="text-xs">
                            {ROLE_LABELS[u.role] || u.role}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          {u.role === "admin" || u.role === "super_admin" || u.role === "superadmin" ? (
                            <span className="text-green-600 text-xs">ทุกบริษัท</span>
                          ) : u.companyAccess && u.companyAccess.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {u.companyAccess.map(cid => {
                                const comp = comps.find(c => c.id === cid);
                                return (
                                  <Badge key={cid} variant="outline" className="text-xs">
                                    {comp ? comp.name : `#${cid}`}
                                  </Badge>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-yellow-600 text-xs">ยังไม่กำหนด</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export default function TenantOverview() {
  const { data, isLoading, error } = useQuery<TenantOverviewData>({
    queryKey: ["/api/platform/tenant-overview"],
  });

  if (isLoading) return <PlatformLayout><div className="p-6 text-center text-muted-foreground">กำลังโหลดข้อมูล...</div></PlatformLayout>;
  if (error) return <PlatformLayout><div className="p-6 text-center text-red-500">ไม่สามารถโหลดข้อมูลได้</div></PlatformLayout>;
  if (!data) return null;

  const { tenants: tenantList, securityAudit, moduleList } = data;

  const typeCounts: Record<string, number> = {};
  for (const t of tenantList) {
    typeCounts[t.tenant.tenantType] = (typeCounts[t.tenant.tenantType] || 0) + 1;
  }

  const totalCompanies = tenantList.reduce((s, t) => s + t.stats.companyCount, 0);
  const totalUsers = tenantList.reduce((s, t) => s + t.stats.userCount, 0);

  return (
    <PlatformLayout>
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">ภาพรวมลูกค้า & การจัดการข้อมูล</h1>
        <p className="text-muted-foreground">ดูภาพรวมกลุ่มลูกค้า, โมดูลที่ใช้, และการแยกข้อมูล</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <div className="text-2xl font-bold text-[#fb9678]" data-testid="text-total-tenants">{tenantList.length}</div>
            <div className="text-sm text-muted-foreground">Tenant ทั้งหมด</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <div className="text-2xl font-bold text-[#03c9d7]" data-testid="text-total-companies">{totalCompanies}</div>
            <div className="text-sm text-muted-foreground">บริษัททั้งหมด</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <div className="text-2xl font-bold text-[#539BFF]" data-testid="text-total-users">{totalUsers}</div>
            <div className="text-sm text-muted-foreground">ผู้ใช้ทั้งหมด</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <div className="flex gap-2 justify-center">
              {Object.entries(typeCounts).map(([type, cnt]) => (
                <Badge key={type} variant="outline" className={TENANT_TYPE_COLORS[type] || "bg-gray-100"}>
                  {TENANT_TYPE_LABELS[type] || type}: {cnt}
                </Badge>
              ))}
            </div>
            <div className="text-sm text-muted-foreground mt-1">ประเภทลูกค้า</div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-[#05b187]/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-5 w-5 text-[#05b187]" />
            Security Audit — การแยกข้อมูลระหว่างบริษัท
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>checkDocOwnership ครอบคลุม <strong>{securityAudit.checkDocOwnershipCoverage}</strong></span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>{securityAudit.companyIdFilterPattern}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>{securityAudit.tenantIsolation}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>{securityAudit.allowedCompanyIds}</span>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                แนวปฏิบัติป้องกันข้อมูลข้าม
              </h4>
              <ul className="space-y-1.5">
                {securityAudit.recommendations.map((rec, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-[#fb9678] font-bold mt-0.5">{i + 1}.</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {securityAudit.knownFixedIssues.length > 0 && (
            <div className="mt-3 border-t pt-3">
              <h4 className="text-sm font-semibold mb-2">ปัญหาที่เคยพบ & แก้ไขแล้ว</h4>
              <div className="space-y-1">
                {securityAudit.knownFixedIssues.map((issue, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm bg-green-50 rounded px-3 py-1.5">
                    <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                    <code className="text-xs bg-white px-1.5 py-0.5 rounded">{issue.endpoint}</code>
                    <span>{issue.issue}</span>
                    <Badge variant="outline" className="bg-green-100 text-green-700 text-xs ml-auto shrink-0">
                      {issue.status} ({issue.fixDate})
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold" data-testid="text-section-tenants">
          กลุ่มลูกค้าทั้งหมด ({tenantList.length})
        </h2>
        {tenantList.map(t => (
          <TenantCard key={t.tenant.id} data={t} moduleList={moduleList} />
        ))}
      </div>
    </div>
    </PlatformLayout>
  );
}
