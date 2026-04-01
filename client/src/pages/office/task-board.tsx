import Layout from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useCompany } from "@/lib/company-context";
import { formatDate } from "@/lib/format";
import ThaiDateInput from "@/components/thai-date-input";
import { useDateSettings } from "@/hooks/use-date-settings";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Plus, LayoutGrid, List, Settings, Trash2, GripVertical,
  Calendar, User, MessageSquare, MoreHorizontal, Lock, Globe,
  Users, UserPlus, X, Send, ChevronDown
} from "lucide-react";

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  urgent: { label: "เร่งด่วน", color: "#9333ea", bg: "rgba(147,51,234,0.15)" },
  high: { label: "สูง", color: "#f94d4d", bg: "rgba(249,77,77,0.15)" },
  medium: { label: "กลาง", color: "#fec90f", bg: "rgba(254,201,15,0.15)" },
  low: { label: "ต่ำ", color: "#05b187", bg: "rgba(5,177,135,0.15)" },
};

const BOARD_COLORS = ["var(--theme-primary)", "#fb9678", "#05b187", "#fec90f", "#f94d4d", "#9333ea", "#03c9d7", "#ff6b6b"];

export default function TaskBoardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedCompanyId } = useCompany();
  const { dateEra, dateFmt } = useDateSettings();
  const [selectedBoardId, setSelectedBoardId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
  const [showCreateBoard, setShowCreateBoard] = useState(false);
  const [showBoardSettings, setShowBoardSettings] = useState(false);
  const [showTaskDetail, setShowTaskDetail] = useState<number | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");
  const [newBoardColor, setNewBoardColor] = useState("var(--theme-primary)");
  const [newBoardVisibility, setNewBoardVisibility] = useState("public");
  const [newColumnName, setNewColumnName] = useState("");
  const [newColumnColor, setNewColumnColor] = useState("#c4c4c4");
  const [quickAddTitle, setQuickAddTitle] = useState<Record<number, string>>({});
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [searchText, setSearchText] = useState("");
  const [draggedTask, setDraggedTask] = useState<any>(null);

  const { data: boards = [] } = useQuery<any[]>({
    queryKey: ["/api/task-boards"],
    queryFn: async () => {
      const r = await fetch("/api/task-boards", { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
  });

  const board = boards.find((b: any) => b.id === selectedBoardId) || boards[0];
  const boardId = board?.id;

  const { data: columns = [] } = useQuery<any[]>({
    queryKey: ["/api/task-boards", boardId, "columns"],
    queryFn: async () => {
      if (!boardId) return [];
      const r = await fetch(`/api/task-boards/${boardId}/columns`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!boardId,
  });

  const { data: allTasks = [] } = useQuery<any[]>({
    queryKey: ["/api/task-boards", boardId, "tasks"],
    queryFn: async () => {
      if (!boardId) return [];
      const r = await fetch(`/api/task-boards/${boardId}/tasks`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!boardId,
  });

  const { data: boardMembers = [] } = useQuery<any[]>({
    queryKey: ["/api/task-boards", boardId, "members"],
    queryFn: async () => {
      if (!boardId) return [];
      const r = await fetch(`/api/task-boards/${boardId}/members`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!boardId,
  });

  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ["/api/employees", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/employees?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: allUsers = [] } = useQuery<any[]>({
    queryKey: ["/api/users-list"],
    queryFn: async () => {
      const r = await fetch("/api/users", { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
  });

  const filteredTasks = allTasks.filter((t: any) => {
    if (filterPriority !== "all" && t.priority !== filterPriority) return false;
    if (searchText && !t.title.toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  });

  const createBoardMut = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/task-boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: newBoardName, color: newBoardColor, visibility: newBoardVisibility }),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/task-boards"] });
      setSelectedBoardId(data.id);
      setShowCreateBoard(false);
      setNewBoardName("");
      toast({ title: "สร้างบอร์ดสำเร็จ" });
    },
  });

  const createTaskMut = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/task-boards", boardId, "tasks"] });
    },
  });

  const updateTaskMut = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const r = await fetch(`/api/tasks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/task-boards", boardId, "tasks"] });
    },
  });

  const deleteTaskMut = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/tasks/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/task-boards", boardId, "tasks"] });
      setShowTaskDetail(null);
      toast({ title: "ลบงานสำเร็จ" });
    },
  });

  const deleteBoardMut = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/task-boards/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/task-boards"] });
      setSelectedBoardId(null);
      setShowBoardSettings(false);
      toast({ title: "ลบบอร์ดสำเร็จ" });
    },
  });

  const createColumnMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/task-boards/${boardId}/columns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: newColumnName, color: newColumnColor, sortOrder: columns.length }),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/task-boards", boardId, "columns"] });
      setNewColumnName("");
      toast({ title: "เพิ่มคอลัมน์สำเร็จ" });
    },
  });

  const addMemberMut = useMutation({
    mutationFn: async (userId: number) => {
      const r = await fetch(`/api/task-boards/${boardId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId }),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/task-boards", boardId, "members"] });
      toast({ title: "เพิ่มสมาชิกสำเร็จ" });
    },
  });

  const removeMemberMut = useMutation({
    mutationFn: async (userId: number) => {
      const r = await fetch(`/api/task-boards/${boardId}/members/${userId}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/task-boards", boardId, "members"] });
      toast({ title: "ลบสมาชิกสำเร็จ" });
    },
  });

  const handleQuickAdd = (columnId: number) => {
    const title = quickAddTitle[columnId]?.trim();
    if (!title || !boardId) return;
    createTaskMut.mutate({
      boardId, columnId, title, priority: "medium",
      sortOrder: filteredTasks.filter((t: any) => t.columnId === columnId).length,
    });
    setQuickAddTitle({ ...quickAddTitle, [columnId]: "" });
  };

  const handleDragStart = (task: any) => {
    setDraggedTask(task);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (columnId: number) => {
    if (draggedTask && draggedTask.columnId !== columnId) {
      updateTaskMut.mutate({ id: draggedTask.id, data: { columnId } });
    }
    setDraggedTask(null);
  };

  const selectedTask = allTasks.find((t: any) => t.id === showTaskDetail);

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">บริหารจัดการงาน</h1>
            {boards.length > 0 && (
              <Select value={String(boardId || "")} onValueChange={(v) => setSelectedBoardId(Number(v))}>
                <SelectTrigger className="w-[200px] h-9" data-testid="select-board">
                  <SelectValue placeholder="เลือกบอร์ด" />
                </SelectTrigger>
                <SelectContent>
                  {boards.map((b: any) => (
                    <SelectItem key={b.id} value={String(b.id)}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded" style={{ background: b.color || "var(--theme-primary)" }} />
                        {b.name}
                        {b.visibility === "private" && <Lock className="h-3 w-3 text-muted-foreground" />}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button size="sm" onClick={() => setShowCreateBoard(true)} className="gap-1" style={{ background: "#fb9678" }} data-testid="button-create-board">
              <Plus className="h-4 w-4" /> สร้างบอร์ด
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Input
              placeholder="ค้นหางาน..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-[180px] h-9"
              data-testid="input-search-task"
            />
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-[130px] h-9" data-testid="select-filter-priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex bg-muted rounded-lg overflow-hidden">
              <button
                className={`p-2 transition-colors ${viewMode === "kanban" ? "text-white" : "text-muted-foreground"}`}
                style={viewMode === "kanban" ? { background: "var(--theme-primary)" } : undefined}
                onClick={() => setViewMode("kanban")}
                data-testid="button-view-kanban"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                className={`p-2 transition-colors ${viewMode === "table" ? "text-white" : "text-muted-foreground"}`}
                style={viewMode === "table" ? { background: "var(--theme-primary)" } : undefined}
                onClick={() => setViewMode("table")}
                data-testid="button-view-table"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
            {boardId && (
              <>
                <Button size="sm" variant="outline" className="gap-1 h-9" onClick={() => setShowInvite(true)} data-testid="button-invite">
                  <UserPlus className="h-4 w-4" /> เชิญ
                </Button>
                <Button size="sm" variant="outline" className="h-9 w-9 p-0" onClick={() => setShowBoardSettings(true)} data-testid="button-board-settings">
                  <Settings className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>

        {!boardId && boards.length === 0 && (
          <Card className="border-0 shadow-md">
            <CardContent className="py-16 text-center">
              <LayoutGrid className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
              <h3 className="text-lg font-semibold mb-2">ยังไม่มีบอร์ดงาน</h3>
              <p className="text-muted-foreground mb-4">สร้างบอร์ดแรกเพื่อเริ่มจัดการงานของทีม</p>
              <Button onClick={() => setShowCreateBoard(true)} style={{ background: "#fb9678" }} data-testid="button-create-first-board">
                <Plus className="h-4 w-4 mr-2" /> สร้างบอร์ดใหม่
              </Button>
            </CardContent>
          </Card>
        )}

        {boardId && viewMode === "kanban" && (
          <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: "calc(100vh - 250px)" }}>
            {columns.map((col: any) => {
              const colTasks = filteredTasks.filter((t: any) => t.columnId === col.id);
              return (
                <div
                  key={col.id}
                  className="flex-shrink-0 w-[300px] flex flex-col"
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(col.id)}
                  data-testid={`column-${col.id}`}
                >
                  <div className="rounded-t-xl px-4 py-3 flex items-center justify-between" style={{ background: col.color || "#c4c4c4" }}>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white text-sm">{col.name}</span>
                      <span className="bg-white/30 text-white text-xs px-2 py-0.5 rounded-full font-medium">{colTasks.length}</span>
                    </div>
                  </div>
                  <div className="flex-1 bg-muted/30 rounded-b-xl p-2 space-y-2 min-h-[200px]">
                    {colTasks.map((task: any) => {
                      const pri = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
                      return (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={() => handleDragStart(task)}
                          className="bg-white rounded-xl p-3 shadow-sm border cursor-grab hover:shadow-md transition-shadow"
                          onClick={() => setShowTaskDetail(task.id)}
                          data-testid={`task-card-${task.id}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-sm font-medium flex-1">{task.title}</h4>
                            <GripVertical className="h-4 w-4 text-muted-foreground/30 flex-shrink-0" />
                          </div>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: pri.bg, color: pri.color }}>
                              {pri.label}
                            </span>
                            {task.dueDate && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDate(task.dueDate, dateEra, dateFmt)}
                              </span>
                            )}
                          </div>
                          {task.assignees && task.assignees.length > 0 && (
                            <div className="flex items-center gap-1 mt-2">
                              {task.assignees.slice(0, 3).map((a: any) => (
                                <div key={a.employeeId} className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium text-white" style={{ background: "#fb9678" }}>
                                  {employees.find((e: any) => e.id === a.employeeId)?.fullName?.charAt(0) || "?"}
                                </div>
                              ))}
                              {task.assignees.length > 3 && (
                                <span className="text-xs text-muted-foreground">+{task.assignees.length - 3}</span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div className="pt-1">
                      <div className="flex gap-1">
                        <Input
                          placeholder="+ เพิ่มงาน..."
                          value={quickAddTitle[col.id] || ""}
                          onChange={(e) => setQuickAddTitle({ ...quickAddTitle, [col.id]: e.target.value })}
                          onKeyDown={(e) => e.key === "Enter" && handleQuickAdd(col.id)}
                          className="h-8 text-sm bg-white/80"
                          data-testid={`input-quickadd-${col.id}`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {boardId && viewMode === "table" && (
          <Card className="border-0 shadow-md">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-semibold">งาน</TableHead>
                    <TableHead className="font-semibold">สถานะ</TableHead>
                    <TableHead className="font-semibold">ลำดับความสำคัญ</TableHead>
                    <TableHead className="font-semibold">ผู้รับผิดชอบ</TableHead>
                    <TableHead className="font-semibold">กำหนดเสร็จ</TableHead>
                    <TableHead className="font-semibold w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTasks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">ยังไม่มีงาน</TableCell>
                    </TableRow>
                  ) : (
                    filteredTasks.map((task: any) => {
                      const col = columns.find((c: any) => c.id === task.columnId);
                      const pri = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
                      return (
                        <TableRow key={task.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setShowTaskDetail(task.id)} data-testid={`row-task-${task.id}`}>
                          <TableCell className="font-medium">{task.title}</TableCell>
                          <TableCell>
                            <span className="text-xs px-3 py-1 rounded-full text-white font-medium" style={{ background: col?.color || "#c4c4c4" }}>
                              {col?.name || "-"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: pri.bg, color: pri.color }}>
                              {pri.label}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {(task.assignees || []).slice(0, 2).map((a: any) => {
                                const emp = employees.find((e: any) => e.id === a.employeeId);
                                return (
                                  <span key={a.employeeId} className="text-xs">{emp?.fullName?.split(" ")[0] || "?"}</span>
                                );
                              })}
                              {(task.assignees || []).length > 2 && <span className="text-xs text-muted-foreground">+{task.assignees.length - 2}</span>}
                              {(!task.assignees || task.assignees.length === 0) && <span className="text-xs text-muted-foreground">-</span>}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{task.dueDate ? formatDate(task.dueDate, dateEra, dateFmt) : "-"}</TableCell>
                          <TableCell>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={(e) => { e.stopPropagation(); deleteTaskMut.mutate(task.id); }}>
                              <Trash2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <Dialog open={showCreateBoard} onOpenChange={setShowCreateBoard}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>สร้างบอร์ดใหม่</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>ชื่อบอร์ด</Label>
                <Input value={newBoardName} onChange={(e) => setNewBoardName(e.target.value)} placeholder="เช่น งานปิดบัญชี" data-testid="input-board-name" />
              </div>
              <div>
                <Label>สี</Label>
                <div className="flex gap-2 mt-1">
                  {BOARD_COLORS.map((c) => (
                    <button
                      key={c}
                      className={`w-8 h-8 rounded-full border-2 ${newBoardColor === c ? "border-foreground" : "border-transparent"}`}
                      style={{ background: c }}
                      onClick={() => setNewBoardColor(c)}
                    />
                  ))}
                </div>
              </div>
              <div>
                <Label>การมองเห็น</Label>
                <Select value={newBoardVisibility} onValueChange={setNewBoardVisibility}>
                  <SelectTrigger data-testid="select-board-visibility">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public"><div className="flex items-center gap-2"><Globe className="h-4 w-4" /> สาธารณะ - ทุกคนเห็น</div></SelectItem>
                    <SelectItem value="private"><div className="flex items-center gap-2"><Lock className="h-4 w-4" /> ส่วนตัว - เฉพาะสมาชิก</div></SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" style={{ background: "#fb9678" }} disabled={!newBoardName.trim()} onClick={() => createBoardMut.mutate()} data-testid="button-submit-board">
                สร้างบอร์ด
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showBoardSettings} onOpenChange={setShowBoardSettings}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>ตั้งค่าบอร์ด: {board?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-semibold">คอลัมน์สถานะ</Label>
                <div className="space-y-2 mt-2">
                  {columns.map((col: any) => (
                    <div key={col.id} className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded" style={{ background: col.color }} />
                      <span className="text-sm flex-1">{col.name}</span>
                      {col.isDone && <Badge variant="secondary" className="text-xs">เสร็จ</Badge>}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-3">
                  <Input
                    placeholder="ชื่อคอลัมน์ใหม่"
                    value={newColumnName}
                    onChange={(e) => setNewColumnName(e.target.value)}
                    className="h-8 text-sm"
                    data-testid="input-new-column"
                  />
                  <Input
                    type="color"
                    value={newColumnColor}
                    onChange={(e) => setNewColumnColor(e.target.value)}
                    className="h-8 w-12 p-0.5"
                  />
                  <Button size="sm" className="h-8" style={{ background: "#fb9678" }} disabled={!newColumnName.trim()} onClick={() => createColumnMut.mutate()}>
                    เพิ่ม
                  </Button>
                </div>
              </div>
              <hr />
              <Button variant="destructive" size="sm" className="w-full" onClick={() => { if (confirm("ต้องการลบบอร์ดนี้ใช่ไหม?")) deleteBoardMut.mutate(boardId); }} data-testid="button-delete-board">
                <Trash2 className="h-4 w-4 mr-2" /> ลบบอร์ด
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showInvite} onOpenChange={setShowInvite}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>เชิญสมาชิกเข้าบอร์ด</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-semibold mb-2 block">สมาชิกปัจจุบัน</Label>
                {boardMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">ยังไม่มีสมาชิก</p>
                ) : (
                  <div className="space-y-2">
                    {boardMembers.map((m: any) => {
                      const u = allUsers.find((u: any) => u.id === m.userId);
                      return (
                        <div key={m.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium text-white" style={{ background: "#fb9678" }}>
                              {u?.fullName?.charAt(0) || u?.username?.charAt(0) || "?"}
                            </div>
                            <span className="text-sm">{u?.fullName || u?.username || `User ${m.userId}`}</span>
                          </div>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => removeMemberMut.mutate(m.userId)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <hr />
              <div>
                <Label className="text-sm font-semibold mb-2 block">เพิ่มสมาชิก</Label>
                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                  {allUsers.filter((u: any) => !boardMembers.some((m: any) => m.userId === u.id)).map((u: any) => (
                    <div key={u.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted cursor-pointer" onClick={() => addMemberMut.mutate(u.id)}>
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium text-white" style={{ background: "#03c9d7" }}>
                          {u.fullName?.charAt(0) || u.username?.charAt(0) || "?"}
                        </div>
                        <span className="text-sm">{u.fullName || u.username}</span>
                      </div>
                      <UserPlus className="h-4 w-4 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <TaskDetailDialog
          task={selectedTask}
          open={!!showTaskDetail}
          onClose={() => setShowTaskDetail(null)}
          columns={columns}
          employees={employees}
          allUsers={allUsers}
          boardId={boardId}
          onUpdate={(id: number, data: any) => updateTaskMut.mutate({ id, data })}
          onDelete={(id: number) => deleteTaskMut.mutate(id)}
        />
      </div>
    </Layout>
  );
}

function TaskDetailDialog({ task, open, onClose, columns, employees, allUsers, boardId, onUpdate, onDelete }: any) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [commentText, setCommentText] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const { data: comments = [] } = useQuery<any[]>({
    queryKey: ["/api/tasks", task?.id, "comments"],
    queryFn: async () => {
      if (!task?.id) return [];
      const r = await fetch(`/api/tasks/${task.id}/comments`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!task?.id,
  });

  const { data: assignees = [] } = useQuery<any[]>({
    queryKey: ["/api/tasks", task?.id, "assignees"],
    queryFn: async () => {
      if (!task?.id) return [];
      const r = await fetch(`/api/tasks/${task.id}/assignees`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!task?.id,
  });

  const addCommentMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/tasks/${task.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ body: commentText }),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", task.id, "comments"] });
      setCommentText("");
    },
  });

  const addAssigneeMut = useMutation({
    mutationFn: async (employeeId: number) => {
      const r = await fetch(`/api/tasks/${task.id}/assignees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ employeeId }),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", task.id, "assignees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/task-boards", boardId, "tasks"] });
    },
  });

  const removeAssigneeMut = useMutation({
    mutationFn: async (employeeId: number) => {
      const r = await fetch(`/api/tasks/${task.id}/assignees/${employeeId}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", task.id, "assignees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/task-boards", boardId, "tasks"] });
    },
  });

  if (!task) return null;

  const pri = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">{task.title}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-4">
            <div>
              <Label className="text-sm font-semibold">ชื่องาน</Label>
              <Input
                defaultValue={task.title}
                onBlur={(e) => {
                  if (e.target.value !== task.title) onUpdate(task.id, { title: e.target.value });
                }}
                data-testid="input-task-title"
              />
            </div>
            <div>
              <Label className="text-sm font-semibold">รายละเอียด</Label>
              <Textarea
                defaultValue={task.description || ""}
                placeholder="เพิ่มรายละเอียดงาน..."
                rows={3}
                onBlur={(e) => {
                  if (e.target.value !== (task.description || "")) onUpdate(task.id, { description: e.target.value });
                }}
                data-testid="input-task-description"
              />
            </div>

            <div>
              <Label className="text-sm font-semibold mb-2 block">
                <MessageSquare className="h-4 w-4 inline mr-1" /> ความคิดเห็น ({comments.length})
              </Label>
              <div className="space-y-3">
                {comments.map((c: any) => {
                  const u = allUsers.find((u: any) => u.id === c.userId);
                  return (
                    <div key={c.id} className="flex gap-2">
                      <div className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium text-white shrink-0" style={{ background: "#03c9d7" }}>
                        {u?.fullName?.charAt(0) || "?"}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{u?.fullName || u?.username || "ไม่ทราบ"}</span>
                          <span className="text-xs text-muted-foreground">{c.createdAt ? new Date(c.createdAt).toLocaleString("th-TH") : ""}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">{c.body}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2 mt-3">
                <Input
                  placeholder="เขียนความคิดเห็น..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && commentText.trim() && addCommentMut.mutate()}
                  className="h-9"
                  data-testid="input-comment"
                />
                <Button size="sm" className="h-9 w-9 p-0" style={{ background: "#fb9678" }} disabled={!commentText.trim()} onClick={() => addCommentMut.mutate()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-xs font-semibold text-muted-foreground">สถานะ</Label>
              <Select value={String(task.columnId)} onValueChange={(v) => onUpdate(task.id, { columnId: Number(v) })}>
                <SelectTrigger className="h-9 mt-1" data-testid="select-task-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {columns.map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded" style={{ background: c.color }} />
                        {c.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-muted-foreground">ลำดับความสำคัญ</Label>
              <Select value={task.priority || "medium"} onValueChange={(v) => onUpdate(task.id, { priority: v })}>
                <SelectTrigger className="h-9 mt-1" data-testid="select-task-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      <span style={{ color: v.color }}>{v.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-muted-foreground">กำหนดเสร็จ</Label>
              <ThaiDateInput value={task.dueDate || ""} onChange={(v: string) => onUpdate(task.id, { dueDate: v || null })} dateEra={dateEra} dateFmt={dateFmt} className="mt-1" data-testid="input-task-duedate" />
            </div>

            <div>
              <Label className="text-xs font-semibold text-muted-foreground mb-1 block">ผู้รับผิดชอบ</Label>
              <div className="space-y-1">
                {assignees.map((a: any) => {
                  const emp = employees.find((e: any) => e.id === a.employeeId);
                  return (
                    <div key={a.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium text-white" style={{ background: "#fb9678" }}>
                          {emp?.fullName?.charAt(0) || "?"}
                        </div>
                        <span className="text-xs">{emp?.fullName || "ไม่ทราบ"}</span>
                      </div>
                      <button onClick={() => removeAssigneeMut.mutate(a.employeeId)} className="text-muted-foreground hover:text-foreground">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
              <Select onValueChange={(v) => addAssigneeMut.mutate(Number(v))}>
                <SelectTrigger className="h-8 mt-2 text-xs" data-testid="select-add-assignee">
                  <SelectValue placeholder="+ เพิ่มผู้รับผิดชอบ" />
                </SelectTrigger>
                <SelectContent>
                  {employees.filter((e: any) => !assignees.some((a: any) => a.employeeId === e.id)).map((e: any) => (
                    <SelectItem key={e.id} value={String(e.id)}>{e.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <hr />
            <Button variant="destructive" size="sm" className="w-full" onClick={() => { if (confirm("ต้องการลบงานนี้ใช่ไหม?")) onDelete(task.id); }} data-testid="button-delete-task">
              <Trash2 className="h-4 w-4 mr-2" /> ลบงาน
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
