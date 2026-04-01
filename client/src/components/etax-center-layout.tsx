import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useCompany } from "@/lib/company-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SubscriptionNavButton } from "@/components/layout";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Kanban,
  CalendarDays,
  ArrowLeft,
  Menu,
  Building2,
  ChevronDown,
  ChevronRight,
  LogOut,
  Bell,
  Search,
  Star,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Copy,
  ExternalLink,
  Archive,
  Save,
  Globe,
  Lock,
  Share2,
  Link2,
  ClipboardCopy,
  X,
  Mail,
  MessageSquare,
  User,
  FileText,
  BarChart3,
  QrCode,
  UserPlus,
  Send,
  Check,
  Loader2,
  Users,
  ToggleRight,
  ToggleLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const BOARD_COLORS = [
  "#579bfc", "#a25ddc", "#e2445c", "#fdab3d", "#00c875",
  "#0086c0", "#ff642e", "#cab641", "#ff158a", "#037f4c",
];

export default function EtaxCenterLayout({ children, fullWidth }: { children: React.ReactNode; fullWidth?: boolean }) {
  const [location, setLocation] = useLocation();
  const { user, loading: authLoading, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [switchTarget, setSwitchTarget] = useState<any>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { companies, selectedCompanyId, selectedCompany, setSelectedCompanyId, isAccountingFirm } = useCompany();
  const isExternalUser = (user as any)?.role === "client_external";

  const setPrimaryMutation = useMutation({
    mutationFn: async (companyId: number) => {
      const r = await fetch(`/api/companies/${companyId}/set-primary`, { method: "POST", credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
    },
  });

  const [companySearch, setCompanySearch] = useState("");
  const [companyPopoverOpen, setCompanyPopoverOpen] = useState(false);
  const filteredCompanies = companies.filter((c: any) =>
    c.name.toLowerCase().includes(companySearch.toLowerCase())
  );

  const { data: boards = [] } = useQuery<any[]>({
    queryKey: ["/api/etax-hub/boards", selectedCompanyId, isExternalUser],
    queryFn: async () => {
      const r = await fetch(`/api/etax-hub/boards?companyId=${selectedCompanyId || 0}`, { credentials: "include" });
      if (!r.ok) return [];
      const d = await r.json();
      return Array.isArray(d) ? d : [];
    },
    enabled: isExternalUser || !!selectedCompanyId,
  });

  const [showNewBoard, setShowNewBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");
  const [editingBoardId, setEditingBoardId] = useState<number | null>(null);
  const [editBoardName, setEditBoardName] = useState("");

  const favKey = `etax-hub-favorites-${user?.id || 0}`;
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(favKey) || "[]")); } catch { return new Set(); }
  });
  const toggleFavorite = (id: number) => {
    setFavoriteIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem(favKey, JSON.stringify([...next]));
      return next;
    });
  };
  const favoriteBoards = boards.filter((b: any) => favoriteIds.has(b.id));
  const regularBoards = boards.filter((b: any) => !b.isArchived);

  const createBoardMutation = useMutation({
    mutationFn: async (name: string) => {
      const r = await fetch("/api/etax-hub/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, companyId: selectedCompanyId }),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/etax-hub/boards"] });
      setShowNewBoard(false);
      setNewBoardName("");
      setLocation(`/etax-hub/board?boardId=${data.id}`);
    },
  });

  const updateBoardMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const r = await fetch(`/api/etax-hub/boards/${id}?companyId=${selectedCompanyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...data, companyId: selectedCompanyId }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.message || "Failed"); }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/etax-hub/boards"] });
    },
  });

  const duplicateBoardMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/etax-hub/boards/${id}/duplicate?companyId=${selectedCompanyId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ companyId: selectedCompanyId }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.message || "Failed"); }
      return r.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/etax-hub/boards"] });
      setLocation(`/etax-hub/board?boardId=${data.id}`);
    },
  });

  const deleteBoardMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/etax-hub/boards/${id}?companyId=${selectedCompanyId}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/etax-hub/boards"] });
      setLocation("/etax-hub/board");
    },
  });

  const [shareLinkBoard, setShareLinkBoard] = useState<any>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [shareTab, setShareTab] = useState<"link" | "email" | "line" | "qr" | "group-links">("link");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLineId, setInviteLineId] = useState("");
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [qrData, setQrData] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [shareLinks, setShareLinks] = useState<any[]>([]);
  const [shareLinksLoading, setShareLinksLoading] = useState(false);
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkGroupIds, setNewLinkGroupIds] = useState<number[]>([]);
  const [copiedLinkId, setCopiedLinkId] = useState<number | null>(null);
  const [boardGroups, setBoardGroups] = useState<any[]>([]);

  const isOnBoardPage = location.startsWith("/etax-hub/board");
  const urlParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const activeBoardId = urlParams.get("boardId") ? Number(urlParams.get("boardId")) : null;

  useEffect(() => {
    if (!authLoading && !user) setLocation("/login");
  }, [user, authLoading, setLocation]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  if (authLoading || !user) return null;

  return (
    <>
    <div className="min-h-screen bg-gray-50/50 flex font-sans">
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
          data-testid="mobile-menu-overlay"
        />
      )}

      <aside className={cn(
        "w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col fixed h-full z-50 shadow-sm print:!hidden transition-transform duration-200",
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        {/* Header */}
        <div className="flex items-center px-4 border-b border-sidebar-border shrink-0 relative overflow-hidden" style={{ background: "#fb9678", height: "68px" }}>
          <Link href="/etax-hub" className="flex items-center group cursor-pointer flex-1 justify-center relative z-10 gap-2">
            <Kanban className="h-6 w-6 text-white" />
            <span className="text-white font-bold text-lg" data-testid="text-etax-center-title">eTax Center</span>
          </Link>
          <button
            className="md:hidden ml-2 p-1 rounded hover:bg-white/20 text-white relative z-10"
            onClick={() => setMobileMenuOpen(false)}
            data-testid="button-close-mobile-menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Company Switcher */}
        {!isExternalUser && <div className="p-4 shrink-0">
          {!isAccountingFirm ? (
            <div
              className="w-full flex items-center gap-2 px-3 py-2 bg-sidebar-accent/50 border border-sidebar-border rounded-md text-sidebar-foreground text-sm"
              data-testid="text-company-name"
            >
              <Building2 className="h-4 w-4 shrink-0" />
              <span className="truncate font-medium">{selectedCompany?.name || "บริษัทของฉัน"}</span>
            </div>
          ) : (
            <Popover open={companyPopoverOpen} onOpenChange={(open) => { setCompanyPopoverOpen(open); if (!open) setCompanySearch(""); }}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between bg-sidebar-accent/50 border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  data-testid="button-company-switcher"
                >
                  <div className="flex items-center gap-2 truncate">
                    <Building2 className="h-4 w-4 shrink-0" />
                    <span className="truncate">{selectedCompany?.name || "เลือกบริษัท"}</span>
                  </div>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0 bg-sidebar border-sidebar-border" align="start">
                <div className="p-2 border-b border-sidebar-border">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-sidebar-foreground/50" />
                    <Input
                      data-testid="input-company-search"
                      placeholder="ค้นหาบริษัท..."
                      value={companySearch}
                      onChange={e => setCompanySearch(e.target.value)}
                      className="pl-8 h-8 text-sm bg-sidebar-accent/50 border-sidebar-border text-sidebar-foreground placeholder:text-sidebar-foreground/40"
                    />
                  </div>
                </div>
                <div className="max-h-60 overflow-y-auto p-1">
                  {filteredCompanies.length === 0 ? (
                    <div className="px-3 py-4 text-center text-sm text-sidebar-foreground/50">ไม่พบบริษัท</div>
                  ) : (
                    filteredCompanies.map((company: any) => (
                      <div
                        key={company.id}
                        className={cn(
                          "flex items-center gap-1 px-3 py-2 text-sm rounded-md cursor-pointer transition-colors group",
                          "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground",
                          selectedCompanyId === company.id && "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        )}
                        data-testid={`menu-company-${company.id}`}
                      >
                        <button
                          className="flex-1 text-left truncate"
                          onClick={() => {
                            if (selectedCompanyId === company.id) { setCompanyPopoverOpen(false); setCompanySearch(""); return; }
                            setCompanyPopoverOpen(false); setCompanySearch(""); setSwitchTarget(company);
                          }}
                          data-testid={`button-select-company-${company.id}`}
                        >
                          {company.name}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setPrimaryMutation.mutate(company.id); }}
                          className={cn(
                            "shrink-0 p-0.5 rounded transition-colors",
                            company.isPrimary
                              ? "text-amber-400"
                              : "text-sidebar-foreground/30 hover:text-amber-400"
                          )}
                          title={company.isPrimary ? "บริษัทหลัก (สำนักงาน)" : "ตั้งเป็นบริษัทหลัก"}
                          data-testid={`button-set-primary-${company.id}`}
                        >
                          <Star className={cn("h-3.5 w-3.5", company.isPrimary && "fill-amber-400")} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
                <div className="border-t border-sidebar-border px-3 py-1.5 flex items-center gap-1.5">
                  <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full text-[9px] font-bold text-white" style={{ background: "#fec90f" }}>{companies.length}</span>
                  <span className="text-[10px] text-sidebar-foreground/40">บริษัท</span>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 pb-4 min-h-0">
          {!isExternalUser && (<>
          {/* Dashboard link */}
          <Link href="/etax-hub">
            <span
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer mb-1",
                location === "/etax-hub"
                  ? "text-white shadow-md"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
              style={location === "/etax-hub" ? { background: "#fb9678" } : undefined}
              data-testid="menu-etax-dashboard"
            >
              <LayoutDashboard className="h-4 w-4" />
              ภาพรวม
            </span>
          </Link>

          <Link href="/etax-hub/calendar">
            <span
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer mb-1",
                location === "/etax-hub/calendar"
                  ? "text-white shadow-md"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
              style={location === "/etax-hub/calendar" ? { background: "#fb9678" } : undefined}
              data-testid="menu-etax-calendar"
            >
              <CalendarDays className="h-4 w-4" />
              ปฏิทินของฉัน
            </span>
          </Link>

          <Link href="/settings/tax-reminder">
            <span
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer mb-1",
                location === "/settings/tax-reminder"
                  ? "text-white shadow-md"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
              style={location === "/settings/tax-reminder" ? { background: "#fb9678" } : undefined}
              data-testid="menu-tax-reminder"
            >
              <Bell className="h-4 w-4" />
              แจ้งเตือนภาษี LINE
            </span>
          </Link>

          </>)}

          {!isExternalUser && favoriteBoards.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center px-3 mb-2">
                <Star className="w-3 h-3 text-sidebar-foreground/40 mr-1.5" />
                <span className="text-[11px] font-semibold text-sidebar-foreground/40 uppercase tracking-wider">Favorites</span>
              </div>
              <div className="space-y-0.5 mb-3">
                {favoriteBoards.map((b: any) => {
                  const isActive = isOnBoardPage && activeBoardId === b.id;
                  return (
                    <div
                      key={b.id}
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-1.5 rounded-lg cursor-pointer text-sm transition-all group",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                      )}
                      onClick={() => setLocation(`/etax-hub/board?boardId=${b.id}`)}
                    >
                      <div className="w-[16px] h-[16px] rounded flex-shrink-0 flex items-center justify-center" style={{ backgroundColor: b.color || "#579bfc" }}>
                        <Kanban className="w-2 h-2 text-white" />
                      </div>
                      <span className="truncate flex-1 text-[13px]">{b.name}</span>
                      <button
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-sidebar-accent text-amber-400"
                        onClick={e => { e.stopPropagation(); toggleFavorite(b.id); }}
                      >
                        <Star className="w-3 h-3 fill-current" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Workspaces Section */}
          <div className="mt-4">
            <div className="flex items-center justify-between px-3 mb-2">
              <span className="text-[11px] font-semibold text-sidebar-foreground/40 uppercase tracking-wider">Workspaces</span>
              {!isExternalUser && (
              <div className="flex items-center gap-0.5">
                <button className="p-1 rounded hover:bg-sidebar-accent text-sidebar-foreground/40 hover:text-sidebar-foreground" data-testid="btn-search-boards">
                  <Search className="w-3 h-3" />
                </button>
                <button
                  className="p-1 rounded bg-[#579bfc] hover:bg-[#4a8de8] text-white"
                  onClick={() => setShowNewBoard(true)}
                  data-testid="btn-new-board"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
              )}
            </div>

            <div className="space-y-0.5">
              {regularBoards.map((b: any) => {
                const isActive = isOnBoardPage && activeBoardId === b.id;
                return (
                  <div
                    key={b.id}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer text-sm transition-all group",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                    )}
                    onClick={() => setLocation(`/etax-hub/board?boardId=${b.id}`)}
                    data-testid={`sidebar-board-${b.id}`}
                  >
                    <div className="w-[18px] h-[18px] rounded flex-shrink-0 flex items-center justify-center" style={{ backgroundColor: b.color || "#579bfc" }}>
                      <Kanban className="w-2.5 h-2.5 text-white" />
                    </div>
                    {editingBoardId === b.id ? (
                      <Input
                        value={editBoardName}
                        onChange={e => setEditBoardName(e.target.value)}
                        onBlur={() => { updateBoardMutation.mutate({ id: b.id, name: editBoardName }); setEditingBoardId(null); }}
                        onKeyDown={e => { if (e.key === "Enter") { updateBoardMutation.mutate({ id: b.id, name: editBoardName }); setEditingBoardId(null); } }}
                        className="h-6 text-xs bg-sidebar-accent border-sidebar-border text-sidebar-foreground flex-1"
                        autoFocus
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <>
                        {b.visibility === "shareable"
                          ? <Share2 className="w-3.5 h-3.5 text-[#03c9d7] shrink-0" title="Shareable" />
                          : <Lock className="w-3.5 h-3.5 text-gray-400 shrink-0" title="Main (Private)" />}
                        <span className="truncate flex-1 text-[13px]">{b.name}</span>
                      </>
                    )}
                    {!isExternalUser && <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                        <button className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-sidebar-accent">
                          <MoreHorizontal className="w-3.5 h-3.5 text-sidebar-foreground/50" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onClick={() => window.open(`/etax-hub/board?boardId=${b.id}`, "_blank")}>
                          <ExternalLink className="w-3.5 h-3.5 mr-2" /> เปิดในแท็บใหม่
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => { setEditingBoardId(b.id); setEditBoardName(b.name); }}>
                          <Pencil className="w-3.5 h-3.5 mr-2" /> เปลี่ยนชื่อ
                        </DropdownMenuItem>
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            <Share2 className="w-3.5 h-3.5 mr-2" /> Change type
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="w-48">
                            <DropdownMenuItem
                              onClick={() => updateBoardMutation.mutate({ id: b.id, visibility: "main" }, {
                                onSuccess: () => toast({ title: "เปลี่ยนเป็น Main สำเร็จ", description: "ยกเลิกการแชร์แล้ว ลิงก์เดิมจะใช้ไม่ได้" }),
                              })}
                              className={b.visibility === "main" ? "bg-gray-100" : ""}
                            >
                              <Globe className="w-3.5 h-3.5 mr-2" />
                              <div>
                                <div className="font-medium">Main</div>
                                <div className="text-xs text-gray-400">บอร์ดหลัก (ส่วนตัว)</div>
                              </div>
                              {b.visibility === "main" && <span className="ml-auto text-xs text-green-500">✓</span>}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                updateBoardMutation.mutate({ id: b.id, visibility: "shareable" }, {
                                  onSuccess: (updatedBoard: any) => {
                                    setShareLinkBoard(updatedBoard);
                                    setCopySuccess(false);
                                    toast({ title: "เปลี่ยนเป็น Shareable สำเร็จ", description: "สามารถแชร์ลิงก์ให้คนภายนอกดูได้แล้ว" });
                                  }
                                });
                              }}
                              className={b.visibility === "shareable" ? "bg-gray-100" : ""}
                            >
                              <Share2 className="w-3.5 h-3.5 mr-2" />
                              <div>
                                <div className="font-medium">Shareable</div>
                                <div className="text-xs text-gray-400">แชร์ให้ภายนอกดูได้</div>
                              </div>
                              {b.visibility === "shareable" && <span className="ml-auto text-xs text-green-500">✓</span>}
                            </DropdownMenuItem>
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        <DropdownMenuItem onClick={() => toggleFavorite(b.id)}>
                          <Star className={`w-3.5 h-3.5 mr-2 ${favoriteIds.has(b.id) ? "text-amber-400 fill-amber-400" : ""}`} />
                          {favoriteIds.has(b.id) ? "นำออกจากรายการโปรด" : "เพิ่มในรายการโปรด"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => duplicateBoardMutation.mutate(b.id)}>
                          <Copy className="w-3.5 h-3.5 mr-2" /> คัดลอกบอร์ด
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                          const blob = new Blob([JSON.stringify({ name: b.name, color: b.color, boardType: b.boardType })], { type: "application/json" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url; a.download = `${b.name}-template.json`; a.click();
                          URL.revokeObjectURL(url);
                        }}>
                          <Save className="w-3.5 h-3.5 mr-2" /> บันทึกเป็นเทมเพลต
                        </DropdownMenuItem>
                        {b.visibility === "shareable" && b.shareToken && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => { setShareLinkBoard(b); setCopySuccess(false); setShareTab("link"); setInviteResult(null); setQrData(null); }}>
                              <UserPlus className="w-3.5 h-3.5 mr-2" /> เชิญ / แชร์
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuSeparator />
                        <div className="px-2 py-1.5">
                          <p className="text-xs text-gray-500 mb-1.5">สีบอร์ด</p>
                          <div className="flex flex-wrap gap-1">
                            {BOARD_COLORS.map(c => (
                              <div
                                key={c}
                                className={`w-5 h-5 rounded cursor-pointer border-2 transition-all ${b.color === c ? "border-gray-800 scale-110" : "border-transparent hover:scale-110"}`}
                                style={{ backgroundColor: c }}
                                onClick={() => updateBoardMutation.mutate({ id: b.id, color: c })}
                              />
                            ))}
                          </div>
                        </div>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-500 focus:text-red-500"
                          onClick={() => { if (confirm("ลบบอร์ดนี้?")) deleteBoardMutation.mutate(b.id); }}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-2" /> ลบบอร์ด
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-orange-500 focus:text-orange-500"
                          onClick={() => {
                            updateBoardMutation.mutate({ id: b.id, isArchived: true }, {
                              onSuccess: () => {
                                toast({ title: "เก็บบอร์ดเรียบร้อย", description: "บอร์ดถูกย้ายไปที่ Archive แล้ว" });
                                if (activeBoardId === b.id) setLocation("/etax-hub/board");
                              }
                            });
                          }}
                        >
                          <Archive className="w-3.5 h-3.5 mr-2" /> เก็บถาวร (Archive)
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>}
                  </div>
                );
              })}
            </div>

            {showNewBoard && (
              <div className="px-2 mt-2">
                <Input
                  placeholder="ชื่อบอร์ดใหม่..."
                  value={newBoardName}
                  onChange={e => setNewBoardName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && newBoardName.trim()) createBoardMutation.mutate(newBoardName.trim());
                    if (e.key === "Escape") { setShowNewBoard(false); setNewBoardName(""); }
                  }}
                  className="h-8 text-xs bg-sidebar-accent/50 border-sidebar-border text-sidebar-foreground placeholder:text-sidebar-foreground/40 mb-2"
                  autoFocus
                />
                <div className="flex gap-1">
                  <Button size="sm" className="h-7 text-xs bg-[#579bfc] hover:bg-[#4a8de8] flex-1" onClick={() => newBoardName.trim() && createBoardMutation.mutate(newBoardName.trim())}>
                    สร้าง
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-sidebar-foreground/50" onClick={() => { setShowNewBoard(false); setNewBoardName(""); }}>
                    ยกเลิก
                  </Button>
                </div>
              </div>
            )}
          </div>
        </nav>

        {/* Back to main */}
        {!isExternalUser && (
        <div className="px-3 pb-3 shrink-0">
          <Link href="/">
            <span className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer border-2 border-[#fb9678] text-[#fb9678] hover:bg-[#fb9678] hover:text-white" data-testid="link-back-home">
              <ArrowLeft className="h-4 w-4" />
              กลับหน้าหลัก E-Tax Center
            </span>
          </Link>
        </div>
        )}

        {/* User */}
        <div className="p-4 border-t border-sidebar-border shrink-0">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="h-10 w-10 rounded-full flex items-center justify-center shrink-0 bg-[#fb9678]">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-semibold truncate" data-testid="text-user-name">{user.fullName}</p>
              <p className="text-xs text-sidebar-foreground/50 truncate">{user.role === "admin" ? "ผู้ดูแลระบบ" : user.role}</p>
            </div>
            <button
              onClick={logout}
              className="flexy-icon-btn flexy-icon-btn-error h-8 w-8 shrink-0"
              data-testid="button-logout"
              title="ออกจากระบบ"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className={`flex-1 md:ml-64 flex flex-col print:!ml-0 ${fullWidth ? "h-screen overflow-hidden" : "min-h-screen"}`}>
        <header className="h-16 bg-white border-b flex items-center justify-between px-4 md:px-6 sticky top-0 z-10 print:!hidden shadow-sm shrink-0">
          <div className="flex items-center gap-2 md:gap-4 flex-1">
            <button
              className="md:hidden p-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors"
              onClick={() => setMobileMenuOpen(true)}
              data-testid="button-open-mobile-menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-lg font-bold" style={{ color: "#fb9678" }} data-testid="text-header-title">eTax Center</span>
          </div>
          <div className="flex items-center gap-1">
            <SubscriptionNavButton />
            <button
              className="h-10 w-10 rounded-full flex items-center justify-center relative transition-colors hover:bg-[#fffbf0]"
              style={{ color: "#fec90f" }}
              data-testid="button-notifications"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full border-2 border-white" style={{ background: "#f94d4d" }} />
            </button>
          </div>
        </header>

        <div className={fullWidth ? "flex-1 overflow-hidden animate-in fade-in duration-500 print:!p-0" : "flex-1 p-4 w-full animate-in fade-in duration-500 print:!p-0 overflow-x-hidden"}>
          {children}
        </div>
      </main>
    </div>
    {shareLinkBoard && (() => {
      const shareUrl = `${window.location.origin}/shared/board/${shareLinkBoard.shareToken}`;
      const loadQr = () => {
        if (qrData) return;
        setQrLoading(true);
        fetch(`/api/etax-hub/boards/${shareLinkBoard.id}/qrcode?companyId=${selectedCompanyId}`, { credentials: "include" })
          .then(r => r.json())
          .then(d => { setQrData(d.qrDataUrl); setQrLoading(false); })
          .catch(() => setQrLoading(false));
      };
      const loadShareLinks = () => {
        setShareLinksLoading(true);
        fetch(`/api/etax-hub/boards/${shareLinkBoard.id}/share-links?companyId=${selectedCompanyId}`, { credentials: "include" })
          .then(r => r.json())
          .then(d => { setShareLinks(d); setShareLinksLoading(false); })
          .catch(() => setShareLinksLoading(false));
      };
      const loadBoardGroups = () => {
        fetch(`/api/etax-hub/boards/${shareLinkBoard.id}/data?companyId=${selectedCompanyId}`, { credentials: "include" })
          .then(r => r.json())
          .then(d => { setBoardGroups(d.groups || []); })
          .catch(() => {});
      };
      const createShareLink = async () => {
        if (!newLinkLabel.trim() || newLinkGroupIds.length === 0) return;
        try {
          const r = await fetch(`/api/etax-hub/boards/${shareLinkBoard.id}/share-links`, {
            method: "POST", credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ companyId: selectedCompanyId, label: newLinkLabel, allowedGroupIds: newLinkGroupIds }),
          });
          if (r.ok) {
            setNewLinkLabel(""); setNewLinkGroupIds([]);
            loadShareLinks();
          }
        } catch {}
      };
      const deleteShareLink = async (linkId: number) => {
        if (!confirm("ลบลิงก์แชร์นี้?")) return;
        await fetch(`/api/etax-hub/share-links/${linkId}`, { method: "DELETE", credentials: "include" });
        loadShareLinks();
      };
      const toggleLinkActive = async (linkId: number, active: boolean) => {
        await fetch(`/api/etax-hub/share-links/${linkId}`, {
          method: "PATCH", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active }),
        });
        loadShareLinks();
      };
      const sendInvite = async (method: "email" | "line") => {
        setInviteSending(true);
        setInviteResult(null);
        try {
          const body: any = { method, companyId: selectedCompanyId };
          if (method === "email") body.email = inviteEmail.trim();
          if (method === "line") body.lineUserId = inviteLineId.trim();
          const r = await fetch(`/api/etax-hub/boards/${shareLinkBoard.id}/invite?companyId=${selectedCompanyId}`, {
            method: "POST", credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const d = await r.json();
          setInviteResult({ ok: r.ok, msg: d.message || "สำเร็จ" });
          if (r.ok && method === "email") setInviteEmail("");
          if (r.ok && method === "line") setInviteLineId("");
        } catch { setInviteResult({ ok: false, msg: "เกิดข้อผิดพลาด" }); }
        finally { setInviteSending(false); }
      };
      const closeDialog = () => {
        setShareLinkBoard(null);
        setShareTab("link");
        setInviteEmail("");
        setInviteLineId("");
        setInviteResult(null);
        setQrData(null);
        setShareLinks([]);
        setNewLinkLabel("");
        setNewLinkGroupIds([]);
        setBoardGroups([]);
      };
      return (
        <div className="fixed inset-0 z-[10000] bg-black/50 flex items-center justify-center" data-testid="share-link-dialog">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg mx-4 w-full overflow-hidden">
            <div className="px-6 pt-5 pb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#fb9678]" /> เชิญ / แชร์บอร์ด
              </h3>
              <button onClick={closeDialog} className="p-1 rounded hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="px-6 flex gap-1 border-b overflow-x-auto">
              {[
                { key: "link" as const, icon: Link2, label: "คัดลอกลิงก์" },
                { key: "group-links" as const, icon: Users, label: "แชร์ตามกรุ๊ป" },
                { key: "email" as const, icon: Mail, label: "อีเมล" },
                { key: "line" as const, icon: MessageSquare, label: "LINE" },
                { key: "qr" as const, icon: QrCode, label: "QR Code" },
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => {
                    setShareTab(t.key); setInviteResult(null);
                    if (t.key === "qr") loadQr();
                    if (t.key === "group-links") { loadShareLinks(); loadBoardGroups(); }
                  }}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                    shareTab === t.key
                      ? "border-[#fb9678] text-[#fb9678]"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  )}
                  data-testid={`tab-share-${t.key}`}
                >
                  <t.icon className="w-3.5 h-3.5" /> {t.label}
                </button>
              ))}
            </div>

            <div className="px-6 py-5 min-h-[180px]">
              {shareTab === "link" && (
                <div>
                  <p className="text-sm text-gray-600 mb-3">ลิงก์นี้สามารถแชร์ให้คนภายนอกเข้ามาดูบอร์ดได้</p>
                  <div className="bg-gray-50 rounded-lg p-3 mb-2 flex items-center gap-2">
                    <input
                      readOnly
                      className="flex-1 bg-transparent text-sm text-gray-700 outline-none"
                      value={shareUrl}
                      data-testid="input-share-link"
                    />
                    <button
                      className="shrink-0 px-3 py-1.5 bg-[#fb9678] hover:bg-[#fb9678]/90 text-white rounded-lg text-sm font-medium flex items-center gap-1 transition-colors"
                      data-testid="btn-copy-share-link"
                      onClick={() => {
                        navigator.clipboard.writeText(shareUrl);
                        setCopySuccess(true);
                        setTimeout(() => setCopySuccess(false), 2000);
                      }}
                    >
                      {copySuccess ? <><Check className="w-3.5 h-3.5" /> คัดลอกแล้ว!</> : <><ClipboardCopy className="w-3.5 h-3.5" /> คัดลอก</>}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400">เปลี่ยนกลับเป็น Main เพื่อยกเลิกการแชร์</p>
                </div>
              )}

              {shareTab === "email" && (
                <div>
                  <p className="text-sm text-gray-600 mb-3">ส่งอีเมลเชิญพร้อมลิงก์บอร์ดไปยังลูกค้า</p>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex-1 relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="email"
                        value={inviteEmail}
                        onChange={e => setInviteEmail(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && inviteEmail.includes("@")) sendInvite("email"); }}
                        placeholder="email@example.com"
                        className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#fb9678]"
                        data-testid="input-invite-email"
                      />
                    </div>
                    <button
                      onClick={() => sendInvite("email")}
                      disabled={!inviteEmail.includes("@") || inviteSending}
                      className="px-4 py-2 bg-[#fb9678] hover:bg-[#fb9678]/90 text-white rounded-lg text-sm font-medium flex items-center gap-1.5 disabled:opacity-40 transition-colors"
                      data-testid="btn-send-email-invite"
                    >
                      {inviteSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      ส่งเชิญ
                    </button>
                  </div>
                  {inviteResult && (
                    <p className={`text-sm ${inviteResult.ok ? "text-green-600" : "text-red-500"}`}>{inviteResult.msg}</p>
                  )}
                </div>
              )}

              {shareTab === "line" && (
                <div>
                  <p className="text-sm text-gray-600 mb-3">ส่งข้อความ LINE เชิญพร้อมลิงก์บอร์ดไปยังลูกค้า</p>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex-1 relative">
                      <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={inviteLineId}
                        onChange={e => setInviteLineId(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && inviteLineId.trim()) sendInvite("line"); }}
                        placeholder="LINE User ID (Uxxxx...)"
                        className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#06C755]"
                        data-testid="input-invite-line"
                      />
                    </div>
                    <button
                      onClick={() => sendInvite("line")}
                      disabled={!inviteLineId.trim() || inviteSending}
                      className="px-4 py-2 bg-[#06C755] hover:bg-[#06C755]/90 text-white rounded-lg text-sm font-medium flex items-center gap-1.5 disabled:opacity-40 transition-colors"
                      data-testid="btn-send-line-invite"
                    >
                      {inviteSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      ส่ง LINE
                    </button>
                  </div>
                  <p className="text-xs text-gray-400">LINE User ID หาได้จากระบบ LINE OA หรือ LINE Bot webhook</p>
                  {inviteResult && (
                    <p className={`text-sm ${inviteResult.ok ? "text-green-600" : "text-red-500"}`}>{inviteResult.msg}</p>
                  )}
                </div>
              )}

              {shareTab === "qr" && (
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-4">ให้ลูกค้าสแกน QR Code เพื่อเข้าดูบอร์ด</p>
                  {qrLoading && (
                    <div className="py-8">
                      <Loader2 className="w-8 h-8 animate-spin text-[#fb9678] mx-auto" />
                    </div>
                  )}
                  {qrData && !qrLoading && (
                    <div>
                      <div className="inline-block p-4 bg-white border-2 border-gray-100 rounded-xl shadow-sm mb-3">
                        <img src={qrData} alt="QR Code" className="w-[200px] h-[200px]" data-testid="img-qr-code" />
                      </div>
                      <p className="text-xs text-gray-500 mb-3">{shareLinkBoard.name}</p>
                      <button
                        onClick={() => {
                          const link = document.createElement("a");
                          link.download = `qr-${shareLinkBoard.name}.png`;
                          link.href = qrData!;
                          link.click();
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        data-testid="btn-download-qr"
                      >
                        <QrCode className="w-4 h-4" /> ดาวน์โหลด QR Code
                      </button>
                    </div>
                  )}
                  {!qrData && !qrLoading && (
                    <p className="text-sm text-gray-400 py-8">ไม่สามารถสร้าง QR Code ได้</p>
                  )}
                </div>
              )}

              {shareTab === "group-links" && (
                <div className="space-y-4 max-h-[50vh] overflow-y-auto">
                  <p className="text-sm text-gray-600">สร้างลิงก์แยกตามกรุ๊ป — แต่ละลิงก์เห็นเฉพาะกรุ๊ปที่เลือก</p>

                  <div className="bg-gray-50 rounded-lg p-3 space-y-3" data-testid="form-new-share-link">
                    <div>
                      <label className="text-xs font-medium text-gray-700 mb-1 block">ชื่อลิงก์ (เช่น ชื่อคนที่จะแชร์ให้)</label>
                      <input
                        type="text"
                        value={newLinkLabel}
                        onChange={e => setNewLinkLabel(e.target.value)}
                        placeholder="เช่น นายเอ, ลูกค้า A"
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#fb9678]"
                        data-testid="input-share-link-label"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-700 mb-1.5 block">เลือกกรุ๊ปที่จะแชร์</label>
                      <div className="flex flex-wrap gap-2">
                        {boardGroups.map((g: any) => (
                          <button
                            key={g.id}
                            onClick={() => setNewLinkGroupIds(prev =>
                              prev.includes(g.id) ? prev.filter((x: number) => x !== g.id) : [...prev, g.id]
                            )}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                              newLinkGroupIds.includes(g.id)
                                ? "text-white border-transparent shadow-sm"
                                : "text-gray-600 bg-white hover:bg-gray-50"
                            }`}
                            style={newLinkGroupIds.includes(g.id) ? { backgroundColor: g.color || "#fb9678" } : {}}
                            data-testid={`btn-toggle-group-${g.id}`}
                          >
                            {g.name}
                          </button>
                        ))}
                        {boardGroups.length === 0 && (
                          <p className="text-xs text-gray-400">ไม่มีกรุ๊ปในบอร์ดนี้</p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={createShareLink}
                      disabled={!newLinkLabel.trim() || newLinkGroupIds.length === 0}
                      className="w-full px-4 py-2 bg-[#fb9678] hover:bg-[#fb9678]/90 text-white rounded-lg text-sm font-medium disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5"
                      data-testid="btn-create-share-link"
                    >
                      <Plus className="w-4 h-4" /> สร้างลิงก์แชร์
                    </button>
                  </div>

                  {shareLinksLoading && (
                    <div className="py-4 text-center">
                      <Loader2 className="w-5 h-5 animate-spin text-[#fb9678] mx-auto" />
                    </div>
                  )}

                  {!shareLinksLoading && shareLinks.length > 0 && (
                    <div className="space-y-2" data-testid="list-share-links">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">ลิงก์ที่สร้างแล้ว</h4>
                      {shareLinks.map((sl: any) => {
                        const slUrl = `${window.location.origin}/shared/board/${sl.token}`;
                        const groupNames = (sl.allowedGroupIds || []).map((gid: number) => {
                          const g = boardGroups.find((bg: any) => bg.id === gid);
                          return g?.name || `#${gid}`;
                        });
                        return (
                          <div key={sl.id} className={`border rounded-lg p-3 ${sl.active ? "bg-white" : "bg-gray-50 opacity-60"}`} data-testid={`share-link-${sl.id}`}>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-sm font-semibold text-gray-800">{sl.label}</span>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => toggleLinkActive(sl.id, !sl.active)}
                                  className="p-1 rounded hover:bg-gray-100 text-gray-400"
                                  title={sl.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                                  data-testid={`btn-toggle-active-${sl.id}`}
                                >
                                  {sl.active ? <ToggleRight className="w-5 h-5 text-[#05b187]" /> : <ToggleLeft className="w-5 h-5 text-gray-300" />}
                                </button>
                                <button
                                  onClick={() => deleteShareLink(sl.id)}
                                  className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                                  data-testid={`btn-delete-link-${sl.id}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1 mb-2">
                              {groupNames.map((gn: string, i: number) => (
                                <span key={i} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-orange-50 text-orange-700">{gn}</span>
                              ))}
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                readOnly
                                className="flex-1 bg-gray-50 text-xs text-gray-500 rounded px-2 py-1.5 outline-none border"
                                value={slUrl}
                              />
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(slUrl);
                                  setCopiedLinkId(sl.id);
                                  setTimeout(() => setCopiedLinkId(null), 2000);
                                }}
                                className="shrink-0 px-3 py-1.5 bg-[#fb9678] hover:bg-[#fb9678]/90 text-white rounded text-xs font-medium flex items-center gap-1"
                                data-testid={`btn-copy-link-${sl.id}`}
                              >
                                {copiedLinkId === sl.id ? <><Check className="w-3 h-3" /> คัดลอกแล้ว</> : <><ClipboardCopy className="w-3 h-3" /> คัดลอก</>}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {!shareLinksLoading && shareLinks.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-3">ยังไม่มีลิงก์แชร์ตามกรุ๊ป — สร้างลิงก์ด้านบน</p>
                  )}
                </div>
              )}
            </div>

            <div className="px-6 pb-5 flex justify-end">
              <button onClick={closeDialog} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors" data-testid="btn-close-share">ปิด</button>
            </div>
          </div>
        </div>
      );
    })()}
    {switchTarget && (
      <div className="fixed inset-0 z-[10000] bg-black/50 flex items-center justify-center" data-testid="switch-company-dialog">
        <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm mx-4">
          <h3 className="text-lg font-bold text-gray-800 mb-3">เปลี่ยนบริษัท</h3>
          <p className="text-sm text-gray-600 mb-4">คุณต้องการเปลี่ยนไปใช้งานบริษัท</p>
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <p className="text-sm font-semibold text-gray-800">{switchTarget.name}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setSwitchTarget(null)} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors" data-testid="btn-switch-cancel">ยกเลิก</button>
            <button onClick={() => { const targetId = switchTarget.id; setSwitchTarget(null); setSelectedCompanyId(targetId); queryClient.invalidateQueries({ queryKey: ["/api/permissions/me"] }); queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }); setLocation("/etax-hub"); }} className="flex-1 px-4 py-2.5 bg-[#fb9678] hover:bg-[#fb9678]/90 text-white rounded-lg text-sm font-semibold transition-colors" data-testid="btn-switch-confirm">ยืนยันเปลี่ยน</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
