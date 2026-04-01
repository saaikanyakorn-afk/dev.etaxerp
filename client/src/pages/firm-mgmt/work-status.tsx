import React from "react";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from "@/components/ui/dropdown-menu";
import ThaiDateInput from "@/components/thai-date-input";
import { useDateSettings } from "@/hooks/use-date-settings";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  ClipboardList, ChevronLeft, ChevronRight, Plus, Settings, Download, Upload, Bell,
  FileUp, Trash2, Paperclip, MessageSquare, BarChart3, CheckCircle2, Clock, AlertTriangle, Circle, X, Loader2, GripVertical, ChevronDown, CornerDownRight,
  Copy, ArrowRightLeft, MoreHorizontal, FolderPlus, Pencil, FolderOpen
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { apiRequest } from "@/lib/queryClient";

const MONTHS = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];

const STATUS_OPTIONS = [
  { value: "not_started", label: "ยังไม่เริ่ม", color: "#9ca3af", icon: Circle },
  { value: "in_progress", label: "กำลังทำ", color: "#fec90f", icon: Clock },
  { value: "completed", label: "เสร็จแล้ว", color: "#05b187", icon: CheckCircle2 },
  { value: "overdue", label: "เกินกำหนด", color: "#f94d4d", icon: AlertTriangle },
];

const FIELD_TYPES = [
  { value: "status", label: "สถานะ" },
  { value: "date", label: "วันที่" },
  { value: "text", label: "ข้อความ" },
  { value: "checkbox", label: "เลือก (Checkbox)" },
  { value: "file", label: "ไฟล์แนบ" },
];

const GROUP_COLORS = [
  "#05b187", "#03c9d7", "#fb9678", "#fec90f", "var(--theme-primary)",
  "#f94d4d", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316",
];

const EMPLOYEE_COLORS = [
  "#fb9678", "#03c9d7", "var(--theme-primary)", "#05b187", "#fec90f",
  "#f94d4d", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316",
  "#6366f1", "#84cc16", "#06b6d4", "#e11d48", "#a855f7",
];

function getEmployeeColor(employeeId: number) {
  return EMPLOYEE_COLORS[employeeId % EMPLOYEE_COLORS.length];
}

function getStatusInfo(status: string) {
  return STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];
}

function toBE(year: number) { return year + 543; }

export default function WorkStatusPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { dateEra, dateFmt } = useDateSettings();
  const now = new Date();
  const taxMonth = now.getMonth() === 0 ? 12 : now.getMonth();
  const taxYearBe = now.getMonth() === 0 ? toBE(now.getFullYear() - 1) : toBE(now.getFullYear());
  const [month, setMonth] = useState(taxMonth);
  const [yearBe, setYearBe] = useState(taxYearBe);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [showAddSubColumn, setShowAddSubColumn] = useState(false);
  const [newCol, setNewCol] = useState({ key: "", label: "", fieldType: "status" });
  const [showNoteDialog, setShowNoteDialog] = useState<any>(null);
  const [noteText, setNoteText] = useState("");
  const [filterEmployee, setFilterEmployee] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [columnFilters, setColumnFilters] = useState<Record<number, string>>({});
  const [searchClient, setSearchClient] = useState("");
  const [dragColId, setDragColId] = useState<number | null>(null);
  const [dragOverColId, setDragOverColId] = useState<number | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [addingSubRowFor, setAddingSubRowFor] = useState<number | null>(null);
  const [newSubRowLabel, setNewSubRowLabel] = useState("");
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupColor, setNewGroupColor] = useState("#05b187");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<number | string>>(new Set());
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [editingGroupName, setEditingGroupName] = useState("");
  const [showBulkMoveDialog, setShowBulkMoveDialog] = useState(false);
  const [showBulkCopyDialog, setShowBulkCopyDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<any>(null);
  const [importLoading, setImportLoading] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["/api/work-status/board", month, yearBe],
    queryFn: async () => {
      const res = await fetch(`/api/work-status/board?month=${month}&yearBe=${yearBe}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const board = data?.board;
  const allColumns = data?.columns || [];
  const columns = allColumns.filter((c: any) => !c.isSubitem);
  const subColumns = allColumns.filter((c: any) => c.isSubitem);
  const rows = data?.rows || [];
  const groups = data?.groups || [];
  const clients = data?.clients || [];
  const employees = data?.employees || [];
  const isManager = data?.isManager;

  const updateCellMutation = useMutation({
    mutationFn: async (body: any) => {
      const res = await apiRequest("PATCH", "/api/work-status/cells", body);
      return res.json();
    },
    onSuccess: () => refetch(),
  });

  const updateRowMutation = useMutation({
    mutationFn: async ({ id, ...body }: any) => {
      const res = await apiRequest("PATCH", `/api/work-status/rows/${id}`, body);
      return res.json();
    },
    onSuccess: () => refetch(),
  });

  const addColumnMutation = useMutation({
    mutationFn: async (body: any) => {
      const res = await apiRequest("POST", "/api/work-status/columns", body);
      return res.json();
    },
    onSuccess: () => { refetch(); setShowAddColumn(false); setShowAddSubColumn(false); setNewCol({ key: "", label: "", fieldType: "status" }); toast({ title: "เพิ่มคอลัมน์สำเร็จ" }); },
  });

  const deleteColumnMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/work-status/columns/${id}`);
      return res.json();
    },
    onSuccess: () => { refetch(); toast({ title: "ลบคอลัมน์สำเร็จ" }); },
  });

  const uploadFileMutation = useMutation({
    mutationFn: async ({ file, cellId, rowId }: { file: File; cellId?: number; rowId?: number }) => {
      const formData = new FormData();
      formData.append("file", file);
      if (cellId) formData.append("cellId", String(cellId));
      if (rowId) formData.append("rowId", String(rowId));
      const res = await fetch("/api/work-status/attachments", { method: "POST", body: formData, credentials: "include" });
      return res.json();
    },
    onSuccess: () => { refetch(); toast({ title: "อัปโหลดไฟล์สำเร็จ" }); },
  });

  const notifyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/work-status/send-notifications", { month, yearBe });
      return res.json();
    },
    onSuccess: (data) => toast({ title: data.message }),
  });

  const addSubRowMutation = useMutation({
    mutationFn: async ({ parentRowId, label, boardId }: { parentRowId: number; label: string; boardId: number }) => {
      const res = await apiRequest("POST", "/api/work-status/rows", { parentRowId, label, boardId, overallStatus: "not_started" });
      return res.json();
    },
    onSuccess: (_, vars) => {
      refetch();
      setAddingSubRowFor(null);
      setNewSubRowLabel("");
      setExpandedRows(prev => { const n = new Set(Array.from(prev)); n.add(vars.parentRowId); return n; });
      toast({ title: "เพิ่มแถวย่อยสำเร็จ" });
    },
  });

  const deleteSubRowMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/work-status/rows/${id}`);
      return res.json();
    },
    onSuccess: () => { refetch(); toast({ title: "ลบแถวย่อยสำเร็จ" }); },
  });

  const addGroupMutation = useMutation({
    mutationFn: async (body: any) => {
      const res = await apiRequest("POST", "/api/work-status/groups", body);
      return res.json();
    },
    onSuccess: () => {
      refetch();
      setShowAddGroup(false);
      setNewGroupName("");
      setNewGroupColor("#05b187");
      toast({ title: "เพิ่มกรุ๊ปสำเร็จ" });
    },
  });

  const updateGroupMutation = useMutation({
    mutationFn: async ({ id, ...body }: any) => {
      const res = await apiRequest("PATCH", `/api/work-status/groups/${id}`, body);
      return res.json();
    },
    onSuccess: () => {
      refetch();
      setEditingGroupId(null);
      setEditingGroupName("");
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/work-status/groups/${id}`);
      return res.json();
    },
    onSuccess: () => { refetch(); toast({ title: "ลบกรุ๊ปสำเร็จ" }); },
  });

  const bulkActionMutation = useMutation({
    mutationFn: async (body: any) => {
      const res = await apiRequest("POST", "/api/work-status/rows/bulk", body);
      return res.json();
    },
    onSuccess: (data) => {
      refetch();
      setSelectedRows(new Set());
      setShowBulkMoveDialog(false);
      setShowBulkCopyDialog(false);
      toast({ title: data.message });
    },
  });

  const toggleExpand = useCallback((rowId: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  }, []);

  const reorderColumnsMutation = useMutation({
    mutationFn: async (columnIds: number[]) => {
      const res = await apiRequest("PATCH", "/api/work-status/columns/reorder", { columnIds });
      return res.json();
    },
    onSuccess: () => refetch(),
  });

  const handleColumnDrop = (targetColId: number) => {
    if (dragColId === null || dragColId === targetColId) return;
    const sortedCols = [...columns].sort((a: any, b: any) => a.sortOrder - b.sortOrder);
    const fromIdx = sortedCols.findIndex((c: any) => c.id === dragColId);
    const toIdx = sortedCols.findIndex((c: any) => c.id === targetColId);
    if (fromIdx === -1 || toIdx === -1) return;
    const newCols = [...sortedCols];
    const [moved] = newCols.splice(fromIdx, 1);
    newCols.splice(toIdx, 0, moved);
    reorderColumnsMutation.mutate(newCols.map((c: any) => c.id));
    setDragColId(null);
    setDragOverColId(null);
  };

  const updateBoardMutation = useMutation({
    mutationFn: async (body: any) => {
      const res = await apiRequest("PATCH", `/api/work-status/board/${board.id}`, body);
      return res.json();
    },
    onSuccess: () => { refetch(); toast({ title: "บันทึกการตั้งค่าสำเร็จ" }); },
  });

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYearBe(yearBe - 1); }
    else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYearBe(yearBe + 1); }
    else setMonth(month + 1);
  };

  const parentRows = useMemo(() => rows.filter((r: any) => !r.parentRowId), [rows]);
  const getSubRows = useCallback((parentId: number) => {
    return rows.filter((r: any) => r.parentRowId === parentId).sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }, [rows]);

  const filteredRows = useMemo(() => {
    let result = parentRows;
    if (searchClient.trim()) {
      const q = searchClient.trim().toLowerCase();
      result = result.filter((r: any) => {
        const client = clients.find((c: any) => c.id === r.firmClientId);
        return client?.name?.toLowerCase().includes(q);
      });
    }
    if (filterEmployee !== "all") {
      result = result.filter((r: any) => String(r.assignedEmployeeId) === filterEmployee);
    }
    if (filterStatus !== "all") {
      result = result.filter((r: any) => r.overallStatus === filterStatus);
    }
    const activeColFilters = Object.entries(columnFilters).filter(([_, v]) => v && v !== "all");
    if (activeColFilters.length > 0) {
      result = result.filter((r: any) => {
        return activeColFilters.every(([colId, filterVal]) => {
          const cell = r.cells?.find((c: any) => c.columnId === Number(colId));
          const col = columns.find((c: any) => c.id === Number(colId));
          if (!col) return true;
          if (col.fieldType === "status") return (cell?.valueStatus || "not_started") === filterVal;
          if (col.fieldType === "checkbox") {
            if (filterVal === "checked") return cell?.valueBool === true;
            if (filterVal === "unchecked") return !cell?.valueBool;
          }
          if (col.fieldType === "text") {
            if (filterVal === "filled") return !!cell?.valueText;
            if (filterVal === "empty") return !cell?.valueText;
          }
          if (col.fieldType === "date") {
            if (filterVal === "filled") return !!cell?.valueDate;
            if (filterVal === "empty") return !cell?.valueDate;
          }
          if (col.fieldType === "file") {
            if (filterVal === "has_file") return r.attachments?.length > 0;
            if (filterVal === "no_file") return !r.attachments?.length;
          }
          return true;
        });
      });
    }
    return result;
  }, [rows, filterEmployee, filterStatus, columnFilters, columns, searchClient, clients]);

  const getGroupRows = useCallback((groupId: number | null) => {
    return filteredRows.filter((r: any) => (r.groupId || null) === groupId);
  }, [filteredRows]);

  const ungroupedRows = useMemo(() => getGroupRows(null), [getGroupRows]);

  const statusSummary = useMemo(() => {
    const summary = { not_started: 0, in_progress: 0, completed: 0, overdue: 0 };
    rows.forEach((r: any) => {
      if (summary[r.overallStatus as keyof typeof summary] !== undefined) {
        summary[r.overallStatus as keyof typeof summary]++;
      }
    });
    return summary;
  }, [rows]);

  const workloadData = useMemo(() => {
    const map: Record<number, { name: string; count: number; fill: string }> = {};
    rows.forEach((r: any) => {
      if (r.assignedEmployeeId) {
        if (!map[r.assignedEmployeeId]) {
          const emp = employees.find((e: any) => e.id === r.assignedEmployeeId);
          map[r.assignedEmployeeId] = { name: emp?.fullName || "ไม่ระบุ", count: 0, fill: getEmployeeColor(r.assignedEmployeeId) };
        }
        map[r.assignedEmployeeId].count++;
      }
    });
    return Object.values(map);
  }, [rows, employees]);

  const toggleRowSelect = useCallback((rowId: number) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  }, []);

  const toggleGroupSelect = useCallback((groupId: number | null) => {
    const groupRows = getGroupRows(groupId);
    const allSelected = groupRows.every((r: any) => selectedRows.has(r.id));
    setSelectedRows(prev => {
      const next = new Set(prev);
      groupRows.forEach((r: any) => {
        if (allSelected) next.delete(r.id);
        else next.add(r.id);
      });
      return next;
    });
  }, [getGroupRows, selectedRows]);

  const initializedCollapse = useMemo(() => {
    const collapsed = new Set<number | string>();
    groups.forEach((g: any) => { if (g.isCollapsed) collapsed.add(g.id); });
    return collapsed;
  }, [groups]);

  const isGroupCollapsed = useCallback((groupId: number) => {
    if (collapsedGroups.has(groupId)) return true;
    if (collapsedGroups.has(`open-${groupId}`)) return false;
    return initializedCollapse.has(groupId);
  }, [collapsedGroups, initializedCollapse]);

  const toggleGroupCollapse = useCallback((groupId: number) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      const currentlyCollapsed = isGroupCollapsed(groupId);
      if (currentlyCollapsed) {
        next.delete(groupId);
        next.add(`open-${groupId}`);
      } else {
        next.delete(`open-${groupId}`);
        next.add(groupId);
      }
      return next;
    });
    updateGroupMutation.mutate({ id: groupId, isCollapsed: !isGroupCollapsed(groupId) });
  }, [isGroupCollapsed, updateGroupMutation]);

  function getCellValue(row: any, col: any) {
    return row.cells?.find((c: any) => c.columnId === col.id);
  }

  function handleStatusClick(row: any, col: any) {
    const cell = getCellValue(row, col);
    const currentIdx = STATUS_OPTIONS.findIndex(s => s.value === (cell?.valueStatus || "not_started"));
    const nextIdx = (currentIdx + 1) % STATUS_OPTIONS.length;
    updateCellMutation.mutate({ rowId: row.id, columnId: col.id, valueStatus: STATUS_OPTIONS[nextIdx].value });
  }

  function getProgressPercent(row: any) {
    const statusCols = columns.filter((c: any) => c.fieldType === "status");
    if (statusCols.length === 0) return 0;
    const completed = statusCols.filter((col: any) => {
      const cell = row.cells?.find((c: any) => c.columnId === col.id);
      return cell?.valueStatus === "completed";
    }).length;
    return Math.round((completed / statusCols.length) * 100);
  }

  function renderCellEditor(row: any, col: any) {
    const cell = getCellValue(row, col);

    if (col.fieldType === "status") {
      const info = getStatusInfo(cell?.valueStatus || "not_started");
      const Icon = info.icon;
      return (
        <button
          onClick={() => handleStatusClick(row, col)}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors hover:opacity-80"
          style={{ backgroundColor: info.color + "20", color: info.color, border: `1px solid ${info.color}40` }}
          data-testid={`status-cell-${row.id}-${col.id}`}
        >
          <Icon className="h-3 w-3" />
          {info.label}
        </button>
      );
    }

    if (col.fieldType === "date") {
      return (
        <ThaiDateInput value={cell?.valueDate || ""} onChange={(v: string) => updateCellMutation.mutate({ rowId: row.id, columnId: col.id, valueDate: v })} dateEra={dateEra} dateFmt={dateFmt} className="w-28" data-testid={`date-cell-${row.id}-${col.id}`} />
      );
    }

    if (col.fieldType === "checkbox") {
      return (
        <input
          type="checkbox"
          className="h-4 w-4 accent-[#05b187]"
          checked={cell?.valueBool || false}
          onChange={(e) => updateCellMutation.mutate({ rowId: row.id, columnId: col.id, valueBool: e.target.checked })}
          data-testid={`checkbox-cell-${row.id}-${col.id}`}
        />
      );
    }

    if (col.fieldType === "text") {
      return (
        <input
          type="text"
          className="border rounded px-2 py-1 text-xs w-full min-w-[100px]"
          defaultValue={cell?.valueText || ""}
          onBlur={(e) => {
            if (e.target.value !== (cell?.valueText || "")) {
              updateCellMutation.mutate({ rowId: row.id, columnId: col.id, valueText: e.target.value });
            }
          }}
          data-testid={`text-cell-${row.id}-${col.id}`}
        />
      );
    }

    if (col.fieldType === "file") {
      return (
        <div className="flex items-center gap-1">
          <label className="cursor-pointer text-[var(--theme-primary)] hover:underline text-xs flex items-center gap-1">
            <Paperclip className="h-3 w-3" />
            แนบไฟล์
            <input
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadFileMutation.mutate({ file, rowId: row.id });
              }}
              data-testid={`file-cell-${row.id}-${col.id}`}
            />
          </label>
        </div>
      );
    }

    return null;
  }

  function getClientName(firmClientId: number) {
    const client = clients.find((c: any) => c.id === firmClientId);
    return client?.name || "-";
  }

  function getEmployeeName(employeeId: number | null) {
    if (!employeeId) return "-";
    const emp = employees.find((e: any) => e.id === employeeId);
    return emp?.fullName || "-";
  }

  function renderRow(row: any) {
    const progress = getProgressPercent(row);
    const subRows = getSubRows(row.id);
    const isExpanded = expandedRows.has(row.id);
    const isSelected = selectedRows.has(row.id);
    return (
      <React.Fragment key={row.id}>
        <TableRow className={`hover:bg-gray-50 ${isSelected ? "bg-blue-50/50" : ""}`} data-testid={`row-client-${row.id}`}>
          <TableCell className="w-10 text-center">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[#03c9d7] cursor-pointer"
              checked={isSelected}
              onChange={() => toggleRowSelect(row.id)}
              data-testid={`checkbox-select-${row.id}`}
            />
          </TableCell>
          <TableCell className="font-medium text-sm sticky left-0 bg-white z-10">
            <div className="flex items-center gap-1">
              <button
                onClick={() => toggleExpand(row.id)}
                className="p-0.5 rounded hover:bg-gray-100 transition-colors shrink-0"
                data-testid={`expand-row-${row.id}`}
              >
                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? "" : "-rotate-90"}`} />
              </button>
              {row.firmClientId ? getClientName(row.firmClientId) : (row.label || "-")}
              {subRows.length > 0 && (
                <span className="text-[10px] text-gray-400 ml-0.5">({subRows.length})</span>
              )}
            </div>
          </TableCell>
          <TableCell>
            {isManager ? (
              <div className="flex items-center gap-1.5">
                {row.assignedEmployeeId && (
                  <div className="w-1 h-6 rounded-full shrink-0" style={{ backgroundColor: getEmployeeColor(row.assignedEmployeeId) }} />
                )}
                <Select
                  value={String(row.assignedEmployeeId || "")}
                  onValueChange={(val) => updateRowMutation.mutate({ id: row.id, assignedEmployeeId: val ? Number(val) : null })}
                >
                  <SelectTrigger className="h-7 text-xs w-32" data-testid={`select-employee-${row.id}`}>
                    <SelectValue placeholder="เลือก..." />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp: any) => (
                      <SelectItem key={emp.id} value={String(emp.id)}>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: getEmployeeColor(emp.id) }} />
                          {emp.fullName}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                {row.assignedEmployeeId && (
                  <div className="w-1 h-6 rounded-full shrink-0" style={{ backgroundColor: getEmployeeColor(row.assignedEmployeeId) }} />
                )}
                <span className="text-sm">{getEmployeeName(row.assignedEmployeeId)}</span>
              </div>
            )}
          </TableCell>
          <TableCell className="text-center">
            <div className="flex flex-col items-center gap-1">
              <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${progress}%`, backgroundColor: progress === 100 ? "#05b187" : "#fec90f" }}
                />
              </div>
              <span className="text-xs text-gray-500">{progress}%</span>
            </div>
          </TableCell>
          {columns.map((col: any) => (
            <TableCell key={col.id} className="text-center">
              {renderCellEditor(row, col)}
            </TableCell>
          ))}
          <TableCell className="text-center">
            <button
              onClick={() => { setShowNoteDialog(row); setNoteText(row.employeeNote || ""); }}
              className="text-[var(--theme-primary)] hover:underline text-xs flex items-center gap-1 mx-auto"
              data-testid={`button-note-${row.id}`}
            >
              <MessageSquare className="h-3 w-3" />
              {row.employeeNote ? "ดู/แก้ไข" : "เพิ่มโน้ต"}
            </button>
          </TableCell>
          <TableCell className="text-center">
            <div className="flex flex-col items-center gap-1">
              {row.attachments?.length > 0 && (
                <Badge variant="secondary" className="text-xs">{row.attachments.length} ไฟล์</Badge>
              )}
              <label className="cursor-pointer text-[#03c9d7] hover:underline text-xs flex items-center gap-1">
                <FileUp className="h-3 w-3" />
                อัปโหลด
                <input type="file" className="hidden" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadFileMutation.mutate({ file, rowId: row.id });
                }} data-testid={`file-upload-${row.id}`} />
              </label>
            </div>
          </TableCell>
          <TableCell className="text-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1 rounded hover:bg-gray-100" data-testid={`row-actions-${row.id}`}>
                  <MoreHorizontal className="h-4 w-4 text-gray-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {groups.length > 0 && (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <FolderOpen className="h-4 w-4 mr-2" /> ย้ายไปกรุ๊ป
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuItem
                        onClick={() => bulkActionMutation.mutate({ action: "move", rowIds: [row.id], targetGroupId: null })}
                        data-testid={`row-move-ungrouped-${row.id}`}
                      >
                        <Circle className="h-3 w-3 mr-2 text-gray-400" /> ไม่มีกรุ๊ป
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {groups.map((g: any) => (
                        <DropdownMenuItem
                          key={g.id}
                          onClick={() => bulkActionMutation.mutate({ action: "move", rowIds: [row.id], targetGroupId: g.id })}
                          disabled={row.groupId === g.id}
                          data-testid={`row-move-group-${g.id}-${row.id}`}
                        >
                          <div className="w-3 h-3 rounded-sm mr-2 shrink-0" style={{ backgroundColor: g.color }} />
                          {g.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                )}
                <DropdownMenuItem
                  onClick={() => bulkActionMutation.mutate({ action: "copy", rowIds: [row.id], targetGroupId: row.groupId })}
                  data-testid={`row-copy-${row.id}`}
                >
                  <Copy className="h-4 w-4 mr-2" /> คัดลอก
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-500"
                  onClick={() => { if (confirm("ลบรายการนี้?")) bulkActionMutation.mutate({ action: "delete", rowIds: [row.id] }); }}
                  data-testid={`row-delete-${row.id}`}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> ลบ
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </TableCell>
        </TableRow>
        {isExpanded && (
          <TableRow className="bg-transparent">
            <TableCell colSpan={columns.length + 7} className="p-0">
              <div className="ml-8 mr-4 my-2 border-l-2 border-[#03c9d7]/30">
                <div className="overflow-x-auto">
                  <Table className="w-full">
                    <TableHeader>
                      <TableRow className="bg-gray-50/80 border-b border-gray-200">
                        <TableHead className="text-xs font-semibold text-gray-500 min-w-[180px] pl-4">Subitem</TableHead>
                        {subColumns.map((col: any) => (
                          <TableHead key={col.id} className="text-xs font-semibold text-gray-500 text-center min-w-[120px] group/subcol">
                            <div className="flex items-center justify-center gap-1">
                              {col.label}
                              {isManager && (
                                <button
                                  onClick={() => { if (confirm(`ลบคอลัมน์ย่อย "${col.label}" ?`)) deleteColumnMutation.mutate(col.id); }}
                                  className="text-gray-300 hover:text-red-400 opacity-0 group-hover/subcol:opacity-100 transition-opacity"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          </TableHead>
                        ))}
                        {isManager && (
                          <TableHead className="w-10 text-center">
                            <button
                              onClick={() => setShowAddSubColumn(true)}
                              className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-[#03c9d7] transition-colors"
                              title="เพิ่มคอลัมน์ย่อย"
                              data-testid="button-add-subcol"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </TableHead>
                        )}
                        <TableHead className="w-8"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subRows.map((sub: any) => (
                        <TableRow key={sub.id} className="hover:bg-muted/50 border-b border-border" data-testid={`subrow-${sub.id}`}>
                          <TableCell className="text-sm pl-4">
                            <div className="flex items-center gap-1.5">
                              <span className="text-foreground">{sub.label || "แถวย่อย"}</span>
                            </div>
                          </TableCell>
                          {subColumns.map((col: any) => (
                            <TableCell key={col.id} className="text-center">
                              {renderCellEditor(sub, col)}
                            </TableCell>
                          ))}
                          {isManager && <TableCell />}
                          <TableCell className="text-center">
                            {isManager && (
                              <button
                                onClick={() => { if (confirm(`ลบแถวย่อย "${sub.label}" ?`)) deleteSubRowMutation.mutate(sub.id); }}
                                className="text-gray-300 hover:text-red-500 p-0.5"
                                data-testid={`delete-subrow-${sub.id}`}
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex items-center gap-3 py-2 pl-4">
                  {addingSubRowFor === row.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        className="border rounded px-2 py-1 text-xs w-48"
                        placeholder="ชื่อแถวย่อย..."
                        value={newSubRowLabel}
                        onChange={(e) => setNewSubRowLabel(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && newSubRowLabel.trim()) {
                            addSubRowMutation.mutate({ parentRowId: row.id, label: newSubRowLabel.trim(), boardId: board.id });
                          }
                          if (e.key === "Escape") { setAddingSubRowFor(null); setNewSubRowLabel(""); }
                        }}
                        autoFocus
                        data-testid={`input-subrow-label-${row.id}`}
                      />
                      <button
                        onClick={() => {
                          if (newSubRowLabel.trim()) addSubRowMutation.mutate({ parentRowId: row.id, label: newSubRowLabel.trim(), boardId: board.id });
                        }}
                        className="text-xs px-2 py-1 rounded bg-[#05b187] text-white hover:opacity-90"
                        disabled={addSubRowMutation.isPending}
                        data-testid={`button-save-subrow-${row.id}`}
                      >
                        {addSubRowMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "เพิ่ม"}
                      </button>
                      <button
                        onClick={() => { setAddingSubRowFor(null); setNewSubRowLabel(""); }}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setAddingSubRowFor(row.id); setExpandedRows(prev => { const n = new Set(Array.from(prev)); n.add(row.id); return n; }); }}
                      className="text-xs text-[#03c9d7] hover:underline flex items-center gap-1"
                      data-testid={`button-add-subrow-${row.id}`}
                    >
                      <Plus className="h-3 w-3" /> + Add subitem
                    </button>
                  )}
                </div>
              </div>
            </TableCell>
          </TableRow>
        )}
      </React.Fragment>
    );
  }

  function renderGroupSection(group: any) {
    const groupRows = getGroupRows(group.id);
    const isCollapsed = isGroupCollapsed(group.id);
    const allSelected = groupRows.length > 0 && groupRows.every((r: any) => selectedRows.has(r.id));
    const someSelected = groupRows.some((r: any) => selectedRows.has(r.id));

    return (
      <div key={group.id} className="mb-4" data-testid={`group-${group.id}`}>
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-t-lg cursor-pointer select-none"
          style={{ backgroundColor: group.color + "15", borderLeft: `4px solid ${group.color}` }}
        >
          <input
            type="checkbox"
            className="h-4 w-4 accent-[#03c9d7] cursor-pointer"
            checked={allSelected}
            ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
            onChange={() => toggleGroupSelect(group.id)}
            data-testid={`checkbox-group-${group.id}`}
          />
          <button
            onClick={() => toggleGroupCollapse(group.id)}
            className="p-0.5"
            data-testid={`toggle-group-${group.id}`}
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
              style={{ color: group.color }}
            />
          </button>
          {editingGroupId === group.id ? (
            <input
              type="text"
              className="border rounded px-2 py-0.5 text-sm font-bold bg-white"
              value={editingGroupName}
              onChange={(e) => setEditingGroupName(e.target.value)}
              onBlur={() => {
                if (editingGroupName.trim()) {
                  updateGroupMutation.mutate({ id: group.id, name: editingGroupName.trim() });
                } else {
                  setEditingGroupId(null);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && editingGroupName.trim()) {
                  updateGroupMutation.mutate({ id: group.id, name: editingGroupName.trim() });
                }
                if (e.key === "Escape") setEditingGroupId(null);
              }}
              autoFocus
              data-testid={`input-group-name-${group.id}`}
            />
          ) : (
            <span
              className="font-bold text-sm cursor-pointer"
              style={{ color: group.color }}
              onDoubleClick={() => { setEditingGroupId(group.id); setEditingGroupName(group.name); }}
              data-testid={`text-group-name-${group.id}`}
            >
              {group.name}
            </span>
          )}
          <span className="text-xs text-gray-400 ml-1">{groupRows.length} รายการ</span>

          {isManager && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="ml-auto p-1 rounded hover:bg-white/50" data-testid={`menu-group-${group.id}`}>
                  <MoreHorizontal className="h-4 w-4 text-gray-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => { setEditingGroupId(group.id); setEditingGroupName(group.name); }}>
                  <Pencil className="h-3.5 w-3.5 mr-2" /> เปลี่ยนชื่อ
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-500"
                  onClick={() => {
                    if (confirm(`ลบกรุ๊ป "${group.name}" ? (รายการในกรุ๊ปจะย้ายไปอยู่นอกกรุ๊ป)`)) {
                      deleteGroupMutation.mutate(group.id);
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> ลบกรุ๊ป
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {!isCollapsed && (
          <Card className="border rounded-t-none">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="w-10" />
                      <TableHead className="text-sm font-semibold min-w-[180px]">ลูกค้า</TableHead>
                      <TableHead className="text-sm font-semibold min-w-[120px]">ผู้รับผิดชอบ</TableHead>
                      <TableHead className="text-sm font-semibold min-w-[80px] text-center">ความคืบหน้า</TableHead>
                      {columns.map((col: any) => (
                        <TableHead
                          key={col.id}
                          className={`text-sm font-semibold text-center min-w-[110px] ${isManager ? "cursor-grab" : ""} ${dragOverColId === col.id ? "bg-blue-50 border-l-2 border-blue-400" : ""}`}
                          draggable={isManager}
                          onDragStart={(e) => { setDragColId(col.id); e.dataTransfer.effectAllowed = "move"; }}
                          onDragOver={(e) => { e.preventDefault(); setDragOverColId(col.id); }}
                          onDragLeave={() => setDragOverColId(null)}
                          onDrop={(e) => { e.preventDefault(); handleColumnDrop(col.id); }}
                          onDragEnd={() => { setDragColId(null); setDragOverColId(null); }}
                        >
                          <div className="flex items-center justify-center gap-1">
                            {isManager && <GripVertical className="h-3 w-3 text-gray-300 shrink-0" />}
                            {col.label}
                            {isManager && (
                              <button onClick={() => { if (confirm(`ลบคอลัมน์ "${col.label}" ?`)) deleteColumnMutation.mutate(col.id); }} className="text-gray-400 hover:text-red-500">
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </TableHead>
                      ))}
                      <TableHead className="text-sm font-semibold text-center min-w-[100px]">โน้ต</TableHead>
                      <TableHead className="text-sm font-semibold text-center min-w-[80px]">ไฟล์</TableHead>
                      <TableHead className="text-sm font-semibold text-center w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={columns.length + 7} className="text-center text-gray-400 py-6 text-sm">
                          ไม่มีรายการในกรุ๊ปนี้
                        </TableCell>
                      </TableRow>
                    ) : (
                      groupRows.map((row: any) => renderRow(row))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-[#fb9678]" />
        </div>
      </Layout>
    );
  }

  const totalCols = columns.length + 6;

  return (
    <Layout>
      <div className="space-y-4" data-testid="work-status-page">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ background: "#fb967820" }}>
              <ClipboardList className="h-6 w-6 text-[#fb9678]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground" data-testid="text-page-title">ติดตามสถานะงานบัญชี</h1>
              <p className="text-sm text-muted-foreground">{isManager ? "มุมมองผู้จัดการ - เห็นลูกค้าทุกราย" : "มุมมองพนักงาน - เฉพาะลูกค้าที่รับผิดชอบ"}</p>
            </div>
          </div>
        </div>

        {/* Month/Year Selector */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="icon" onClick={prevMonth} data-testid="button-prev-month">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="text-center" data-testid="text-month-year">
            <div className="text-lg font-semibold text-foreground">เดือนภาษี: {MONTHS[month - 1]} {yearBe}</div>
            <div className="text-xs text-muted-foreground">(ยื่นภาษีใน{MONTHS[month % 12]} {month === 12 ? yearBe + 1 : yearBe})</div>
          </div>
          <Button variant="ghost" size="icon" onClick={nextMonth} data-testid="button-next-month">
            <ChevronRight className="h-5 w-5" />
          </Button>

          {isManager && (
            <div className="flex items-center gap-2 ml-4">
              <Label className="text-sm whitespace-nowrap">กรองพนักงาน:</Label>
              <Select value={filterEmployee} onValueChange={setFilterEmployee}>
                <SelectTrigger className="w-40 h-8 text-sm" data-testid="select-filter-employee">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  {employees.map((emp: any) => (
                    <SelectItem key={emp.id} value={String(emp.id)}>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: getEmployeeColor(emp.id) }} />
                        {emp.fullName}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center gap-2 ml-2">
            <Label className="text-sm whitespace-nowrap">สถานะ:</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-36 h-8 text-sm" data-testid="select-filter-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                {STATUS_OPTIONS.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 ml-2">
            <input
              type="text"
              className="text-sm border rounded px-2 py-1 w-48 bg-background text-foreground placeholder-muted-foreground"
              placeholder="🔍 ค้นหาลูกค้า..."
              value={searchClient}
              onChange={(e) => setSearchClient(e.target.value)}
              data-testid="input-search-client"
            />
          </div>
        </div>

        {/* Floating Bulk Action Toolbar (Monday.com style) */}
        {selectedRows.size > 0 && isManager && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-200" data-testid="bulk-toolbar">
            <div className="flex items-center gap-1 bg-[#323338] text-white rounded-lg shadow-2xl px-4 py-2.5">
              <div className="flex items-center gap-2 mr-3 pr-3 border-r border-gray-600">
                <div className="bg-[#03c9d7] text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                  {selectedRows.size}
                </div>
                <span className="text-sm font-medium whitespace-nowrap">Items selected</span>
              </div>
              <button
                onClick={() => bulkActionMutation.mutate({ action: "copy", rowIds: Array.from(selectedRows), targetGroupId: null })}
                className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded hover:bg-white/10 transition-colors"
                data-testid="button-bulk-copy-quick"
              >
                <Copy className="h-4 w-4" />
                <span className="text-[10px]">Duplicate</span>
              </button>
              <button
                onClick={() => {
                  if (confirm(`ลบ ${selectedRows.size} รายการที่เลือก?`)) {
                    bulkActionMutation.mutate({ action: "delete", rowIds: Array.from(selectedRows) });
                  }
                }}
                className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded hover:bg-white/10 transition-colors"
                data-testid="button-bulk-delete"
              >
                <Trash2 className="h-4 w-4" />
                <span className="text-[10px]">Delete</span>
              </button>
              <button
                onClick={() => setShowBulkMoveDialog(true)}
                className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded hover:bg-white/10 transition-colors"
                data-testid="button-bulk-move"
              >
                <ArrowRightLeft className="h-4 w-4" />
                <span className="text-[10px]">Move to</span>
              </button>
              <button
                onClick={() => setShowBulkCopyDialog(true)}
                className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded hover:bg-white/10 transition-colors"
                data-testid="button-bulk-copy"
              >
                <FolderOpen className="h-4 w-4" />
                <span className="text-[10px]">Copy to</span>
              </button>
              <div className="ml-1 pl-1 border-l border-gray-600">
                <button
                  onClick={() => setSelectedRows(new Set())}
                  className="p-1.5 rounded hover:bg-white/10 transition-colors"
                  data-testid="button-clear-selection"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <Card className="border" style={{ background: "#f3f4f620", borderColor: "#9ca3af40" }}>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">ยังไม่เริ่ม</CardTitle>
            </CardHeader>
            <CardContent className="pb-3 px-4">
              <div className="text-2xl font-bold text-foreground" data-testid="text-count-not-started">{statusSummary.not_started}</div>
            </CardContent>
          </Card>
          <Card className="border" style={{ background: "#fec90f10", borderColor: "#fec90f40" }}>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs font-medium" style={{ color: "#fec90f" }}>กำลังทำ</CardTitle>
            </CardHeader>
            <CardContent className="pb-3 px-4">
              <div className="text-2xl font-bold" style={{ color: "#fec90f" }} data-testid="text-count-in-progress">{statusSummary.in_progress}</div>
            </CardContent>
          </Card>
          <Card className="border" style={{ background: "#05b18710", borderColor: "#05b18740" }}>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs font-medium" style={{ color: "#05b187" }}>เสร็จแล้ว</CardTitle>
            </CardHeader>
            <CardContent className="pb-3 px-4">
              <div className="text-2xl font-bold" style={{ color: "#05b187" }} data-testid="text-count-completed">{statusSummary.completed}</div>
            </CardContent>
          </Card>
          <Card className="border" style={{ background: "#f94d4d10", borderColor: "#f94d4d40" }}>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs font-medium" style={{ color: "#f94d4d" }}>เกินกำหนด</CardTitle>
            </CardHeader>
            <CardContent className="pb-3 px-4">
              <div className="text-2xl font-bold" style={{ color: "#f94d4d" }} data-testid="text-count-overdue">{statusSummary.overdue}</div>
            </CardContent>
          </Card>
        </div>

        {/* Workload Chart (Manager Only) */}
        {isManager && workloadData.length > 0 && (
          <Card className="border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-[#03c9d7]" />
                ภาระงานพนักงาน (จำนวนลูกค้าที่รับผิดชอบ)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={workloadData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} name="จำนวนลูกค้า">
                      {workloadData.map((entry, index) => (
                        <Cell key={index} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {isManager && (
            <>
              <Button variant="outline" size="sm" onClick={() => notifyMutation.mutate()} disabled={notifyMutation.isPending} className="border-[#fb9678] text-[#fb9678]" data-testid="button-notify">
                <Bell className="h-4 w-4 mr-1" /> แจ้งเตือน
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="border-[#03c9d7] text-[#03c9d7]" data-testid="button-add-column">
                    <Plus className="h-4 w-4 mr-1" /> เพิ่มคอลัมน์ <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => setShowAddColumn(true)} data-testid="menu-add-main-col">
                    <Settings className="h-4 w-4 mr-2" /> คอลัมน์หลัก
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowAddSubColumn(true)} data-testid="menu-add-sub-col">
                    <CornerDownRight className="h-4 w-4 mr-2" /> คอลัมน์ย่อย (Subitem)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
          {isManager && (
            <Button variant="outline" size="sm" className="border-[#03c9d7] text-[#03c9d7]" onClick={() => { setShowImportDialog(true); setImportFile(null); setImportPreview(null); }} data-testid="button-import-excel">
              <Upload className="h-4 w-4 mr-1" /> นำเข้า Excel
            </Button>
          )}
          <a href={`/api/work-status/export?month=${month}&yearBe=${yearBe}`} target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm" className="border-[#05b187] text-[#05b187]" data-testid="button-export">
              <Download className="h-4 w-4 mr-1" /> ส่งออก Excel
            </Button>
          </a>
        </div>

        {/* Active Filters Bar */}
        {(Object.values(columnFilters).some(v => v && v !== "all") || searchClient || filterEmployee !== "all") && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              กรองอยู่
              {searchClient ? ` ชื่อ "${searchClient}"` : ""}
              {filterEmployee !== "all" ? " ผู้รับผิดชอบ" : ""}
              {Object.values(columnFilters).filter(v => v && v !== "all").length > 0 ? ` ${Object.values(columnFilters).filter(v => v && v !== "all").length} คอลัมน์` : ""}
            </span>
            <button
              onClick={() => { setColumnFilters({}); setSearchClient(""); setFilterEmployee("all"); setFilterStatus("all"); }}
              className="text-xs text-[#f94d4d] hover:underline flex items-center gap-0.5"
              data-testid="button-clear-col-filters"
            >
              <X className="h-3 w-3" /> ล้างตัวกรองทั้งหมด
            </button>
          </div>
        )}

        {/* Groups + Ungrouped */}
        {groups.map((group: any) => renderGroupSection(group))}

        {/* Ungrouped rows */}
        {ungroupedRows.length > 0 && (
          <div className="mb-4" data-testid="group-ungrouped">
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-t-lg select-none"
              style={{ backgroundColor: "#9ca3af15", borderLeft: "4px solid #9ca3af" }}
            >
              <input
                type="checkbox"
                className="h-4 w-4 accent-[#03c9d7] cursor-pointer"
                checked={ungroupedRows.length > 0 && ungroupedRows.every((r: any) => selectedRows.has(r.id))}
                ref={(el) => {
                  if (el) el.indeterminate = ungroupedRows.some((r: any) => selectedRows.has(r.id)) && !ungroupedRows.every((r: any) => selectedRows.has(r.id));
                }}
                onChange={() => toggleGroupSelect(null)}
                data-testid="checkbox-group-ungrouped"
              />
              <span className="font-bold text-sm text-gray-500" data-testid="text-group-ungrouped">
                ไม่มีกรุ๊ป
              </span>
              <span className="text-xs text-gray-400 ml-1">{ungroupedRows.length} รายการ</span>
            </div>
            <Card className="border rounded-t-none">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="w-10" />
                        <TableHead className="text-sm font-semibold min-w-[180px]">ลูกค้า</TableHead>
                        <TableHead className="text-sm font-semibold min-w-[120px]">ผู้รับผิดชอบ</TableHead>
                        <TableHead className="text-sm font-semibold min-w-[80px] text-center">ความคืบหน้า</TableHead>
                        {columns.map((col: any) => (
                          <TableHead
                            key={col.id}
                            className={`text-sm font-semibold text-center min-w-[110px] ${isManager ? "cursor-grab" : ""} ${dragOverColId === col.id ? "bg-blue-50 border-l-2 border-blue-400" : ""}`}
                            draggable={isManager}
                            onDragStart={(e) => { setDragColId(col.id); e.dataTransfer.effectAllowed = "move"; }}
                            onDragOver={(e) => { e.preventDefault(); setDragOverColId(col.id); }}
                            onDragLeave={() => setDragOverColId(null)}
                            onDrop={(e) => { e.preventDefault(); handleColumnDrop(col.id); }}
                            onDragEnd={() => { setDragColId(null); setDragOverColId(null); }}
                          >
                            <div className="flex items-center justify-center gap-1">
                              {isManager && <GripVertical className="h-3 w-3 text-gray-300 shrink-0" />}
                              {col.label}
                              {isManager && (
                                <button onClick={() => { if (confirm(`ลบคอลัมน์ "${col.label}" ?`)) deleteColumnMutation.mutate(col.id); }} className="text-gray-400 hover:text-red-500">
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          </TableHead>
                        ))}
                        <TableHead className="text-sm font-semibold text-center min-w-[100px]">โน้ต</TableHead>
                        <TableHead className="text-sm font-semibold text-center min-w-[80px]">ไฟล์</TableHead>
                        <TableHead className="text-sm font-semibold text-center w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ungroupedRows.map((row: any) => renderRow(row))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {filteredRows.length === 0 && groups.length === 0 && (
          <Card className="border">
            <CardContent className="py-12 text-center text-gray-400">
              ไม่มีข้อมูล
            </CardContent>
          </Card>
        )}

        {/* Add New Group Button */}
        {isManager && board && (
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddGroup(true)}
              className="border-dashed border-gray-300 text-gray-500 hover:border-[#05b187] hover:text-[#05b187]"
              data-testid="button-add-group"
            >
              <Plus className="h-4 w-4 mr-1" /> เพิ่มกรุ๊ปใหม่
            </Button>
          </div>
        )}

        {/* Board Settings (Manager) */}
        {isManager && board && (
          <Card className="border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Settings className="h-4 w-4 text-gray-500" />
                ตั้งค่าการแจ้งเตือน
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border rounded-lg p-3 bg-orange-50/50">
                  <p className="text-sm font-medium text-[#fb9678] mb-2">ช่วงที่ 1: ภงด. / ประกันสังคม</p>
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm whitespace-nowrap">กำหนดยื่นวันที่:</Label>
                      <Input
                        type="number"
                        className="w-20 h-8 text-sm"
                        min={1} max={31}
                        defaultValue={board.deadlineDayPnd || 7}
                        onBlur={(e) => updateBoardMutation.mutate({ deadlineDayPnd: Number(e.target.value) })}
                        data-testid="input-deadline-day-pnd"
                      />
                      <span className="text-sm text-gray-500">ของเดือนถัดไป</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-sm whitespace-nowrap">เตือนล่วงหน้า:</Label>
                      <Input
                        type="number"
                        className="w-20 h-8 text-sm"
                        min={1} max={30}
                        defaultValue={board.notifyDaysBeforePnd || 3}
                        onBlur={(e) => updateBoardMutation.mutate({ notifyDaysBeforePnd: Number(e.target.value) })}
                        data-testid="input-notify-days-pnd"
                      />
                      <span className="text-sm text-gray-500">วัน</span>
                    </div>
                  </div>
                </div>
                <div className="border rounded-lg p-3 bg-blue-50/50">
                  <p className="text-sm font-medium text-[var(--theme-primary)] mb-2">ช่วงที่ 2: ภ.พ.30</p>
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm whitespace-nowrap">กำหนดยื่นวันที่:</Label>
                      <Input
                        type="number"
                        className="w-20 h-8 text-sm"
                        min={1} max={31}
                        defaultValue={board.deadlineDayVat || 15}
                        onBlur={(e) => updateBoardMutation.mutate({ deadlineDayVat: Number(e.target.value) })}
                        data-testid="input-deadline-day-vat"
                      />
                      <span className="text-sm text-gray-500">ของเดือนถัดไป</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-sm whitespace-nowrap">เตือนล่วงหน้า:</Label>
                      <Input
                        type="number"
                        className="w-20 h-8 text-sm"
                        min={1} max={30}
                        defaultValue={board.notifyDaysBeforeVat || 3}
                        onBlur={(e) => updateBoardMutation.mutate({ notifyDaysBeforeVat: Number(e.target.value) })}
                        data-testid="input-notify-days-vat"
                      />
                      <span className="text-sm text-gray-500">วัน</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Add Column Dialog */}
        <Dialog open={showAddColumn} onOpenChange={setShowAddColumn}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>เพิ่มคอลัมน์ใหม่</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>ชื่อคอลัมน์</Label>
                <Input value={newCol.label} onChange={(e) => setNewCol({ ...newCol, label: e.target.value, key: e.target.value.toLowerCase().replace(/\s+/g, "_") })} placeholder="เช่น ตรวจสอบเอกสาร" data-testid="input-new-col-label" />
              </div>
              <div>
                <Label>ประเภทฟิลด์</Label>
                <Select value={newCol.fieldType} onValueChange={(val) => setNewCol({ ...newCol, fieldType: val })}>
                  <SelectTrigger data-testid="select-new-col-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map(ft => (
                      <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full text-white"
                style={{ background: "#03c9d7" }}
                onClick={() => {
                  if (!newCol.label) return;
                  addColumnMutation.mutate({ boardId: board.id, key: newCol.key, label: newCol.label, fieldType: newCol.fieldType, sortOrder: columns.length });
                }}
                disabled={addColumnMutation.isPending}
                data-testid="button-save-column"
              >
                {addColumnMutation.isPending ? "กำลังบันทึก..." : "เพิ่มคอลัมน์"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Sub Column Dialog */}
        <Dialog open={showAddSubColumn} onOpenChange={setShowAddSubColumn}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>เพิ่มคอลัมน์ย่อย (Subitem)</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>ชื่อคอลัมน์</Label>
                <Input value={newCol.label} onChange={(e) => setNewCol({ ...newCol, label: e.target.value, key: e.target.value.toLowerCase().replace(/\s+/g, "_") })} placeholder="เช่น Update ถึงเดือน" data-testid="input-new-subcol-label" />
              </div>
              <div>
                <Label>ประเภทฟิลด์</Label>
                <Select value={newCol.fieldType} onValueChange={(val) => setNewCol({ ...newCol, fieldType: val })}>
                  <SelectTrigger data-testid="select-new-subcol-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map(ft => (
                      <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full text-white"
                style={{ background: "#03c9d7" }}
                onClick={() => {
                  if (!newCol.label) return;
                  addColumnMutation.mutate({ boardId: board.id, key: newCol.key, label: newCol.label, fieldType: newCol.fieldType, sortOrder: subColumns.length, isSubitem: true });
                }}
                disabled={addColumnMutation.isPending}
                data-testid="button-save-subcol"
              >
                {addColumnMutation.isPending ? "กำลังบันทึก..." : "เพิ่มคอลัมน์ย่อย"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Group Dialog */}
        <Dialog open={showAddGroup} onOpenChange={setShowAddGroup}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>เพิ่มกรุ๊ปใหม่</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>ชื่อกรุ๊ป</Label>
                <Input
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="เช่น DONE68, กลุ่ม A"
                  data-testid="input-new-group-name"
                />
              </div>
              <div>
                <Label>สี</Label>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {GROUP_COLORS.map(c => (
                    <button
                      key={c}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${newGroupColor === c ? "border-gray-800 scale-110" : "border-transparent hover:scale-105"}`}
                      style={{ backgroundColor: c }}
                      onClick={() => setNewGroupColor(c)}
                      data-testid={`color-${c}`}
                    />
                  ))}
                </div>
              </div>
              <Button
                className="w-full text-white"
                style={{ background: newGroupColor }}
                onClick={() => {
                  if (!newGroupName.trim() || !board) return;
                  addGroupMutation.mutate({ boardId: board.id, name: newGroupName.trim(), color: newGroupColor });
                }}
                disabled={addGroupMutation.isPending}
                data-testid="button-save-group"
              >
                {addGroupMutation.isPending ? "กำลังบันทึก..." : "เพิ่มกรุ๊ป"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Bulk Move Dialog */}
        <Dialog open={showBulkMoveDialog} onOpenChange={setShowBulkMoveDialog}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>ย้ายไปกรุ๊ป ({selectedRows.size} รายการ)</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <button
                onClick={() => bulkActionMutation.mutate({ action: "move", rowIds: Array.from(selectedRows), targetGroupId: null })}
                className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-sm flex items-center gap-2"
                data-testid="move-to-ungrouped"
              >
                <div className="w-3 h-3 rounded-full bg-gray-400" />
                ไม่มีกรุ๊ป (ยกเลิกกรุ๊ป)
              </button>
              {groups.map((g: any) => (
                <button
                  key={g.id}
                  onClick={() => bulkActionMutation.mutate({ action: "move", rowIds: Array.from(selectedRows), targetGroupId: g.id })}
                  className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-sm flex items-center gap-2"
                  data-testid={`move-to-group-${g.id}`}
                >
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: g.color }} />
                  {g.name}
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        {/* Bulk Copy Dialog */}
        <Dialog open={showBulkCopyDialog} onOpenChange={setShowBulkCopyDialog}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>คัดลอกไปกรุ๊ป ({selectedRows.size} รายการ)</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <button
                onClick={() => bulkActionMutation.mutate({ action: "copy", rowIds: Array.from(selectedRows), targetGroupId: null })}
                className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-sm flex items-center gap-2"
                data-testid="copy-to-ungrouped"
              >
                <div className="w-3 h-3 rounded-full bg-gray-400" />
                ไม่มีกรุ๊ป
              </button>
              {groups.map((g: any) => (
                <button
                  key={g.id}
                  onClick={() => bulkActionMutation.mutate({ action: "copy", rowIds: Array.from(selectedRows), targetGroupId: g.id })}
                  className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-sm flex items-center gap-2"
                  data-testid={`copy-to-group-${g.id}`}
                >
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: g.color }} />
                  {g.name}
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        {/* Note Dialog */}
        <Dialog open={!!showNoteDialog} onOpenChange={() => setShowNoteDialog(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>โน้ต - {showNoteDialog ? (showNoteDialog.firmClientId ? getClientName(showNoteDialog.firmClientId) : (showNoteDialog.label || "")) : ""}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>โน้ตพนักงาน</Label>
                <Textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="เพิ่มบันทึกส่วนตัว..."
                  rows={3}
                  data-testid="textarea-employee-note"
                />
              </div>
              {isManager && showNoteDialog && (
                <div>
                  <Label>โน้ตผู้จัดการ</Label>
                  <Textarea
                    defaultValue={showNoteDialog?.managerNote || ""}
                    placeholder="เพิ่มบันทึกผู้จัดการ..."
                    rows={3}
                    onBlur={(e) => {
                      if (showNoteDialog) updateRowMutation.mutate({ id: showNoteDialog.id, managerNote: e.target.value });
                    }}
                    data-testid="textarea-manager-note"
                  />
                </div>
              )}
              <Button
                className="w-full text-white"
                style={{ background: "#03c9d7" }}
                onClick={() => {
                  if (showNoteDialog) {
                    updateRowMutation.mutate({ id: showNoteDialog.id, employeeNote: noteText });
                    setShowNoteDialog(null);
                  }
                }}
                data-testid="button-save-note"
              >
                บันทึก
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="dialog-import-excel">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-[#03c9d7]" />
                นำเข้าข้อมูลจาก Excel
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-3 bg-cyan-50 border border-cyan-200 rounded-lg text-xs text-cyan-700 space-y-1">
                <p>ไฟล์ Excel ต้องมีคอลัมน์ <b>"เลขผู้เสียภาษี"</b> หรือ <b>"taxId"</b> เพื่อจับคู่กับลูกค้าในระบบ</p>
                <p>คอลัมน์อื่นๆ จะถูกสร้างเป็นคอลัมน์ข้อมูลในบอร์ดอัตโนมัติ</p>
              </div>

              <div>
                <Label>เลือกไฟล์ Excel (.xlsx, .xls)</Label>
                <Input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => { setImportFile(e.target.files?.[0] || null); setImportPreview(null); }}
                  data-testid="input-import-file"
                />
              </div>

              {importFile && !importPreview && (
                <Button
                  className="w-full text-white"
                  style={{ background: "#03c9d7" }}
                  disabled={importLoading}
                  onClick={async () => {
                    if (!board || !importFile) return;
                    setImportLoading(true);
                    try {
                      const formData = new FormData();
                      formData.append("file", importFile);
                      formData.append("boardId", String(board.id));
                      formData.append("preview", "true");
                      const res = await fetch("/api/work-status/import-excel", { method: "POST", body: formData, credentials: "include" });
                      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
                      const data = await res.json();
                      setImportPreview(data);
                    } catch (err: any) {
                      toast({ title: "ไม่สำเร็จ", description: err.message, variant: "destructive" });
                    } finally {
                      setImportLoading(false);
                    }
                  }}
                  data-testid="button-preview-import"
                >
                  {importLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> กำลังตรวจสอบ...</> : "ตรวจสอบการจับคู่"}
                </Button>
              )}

              {importPreview && (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <div className="text-2xl font-bold">{importPreview.totalRows}</div>
                      <div className="text-xs text-muted-foreground">แถวทั้งหมด</div>
                    </div>
                    <div className="p-3 bg-emerald-50 rounded-lg">
                      <div className="text-2xl font-bold text-emerald-600">{importPreview.matched}</div>
                      <div className="text-xs text-emerald-600">จับคู่ได้</div>
                    </div>
                    <div className="p-3 bg-red-50 rounded-lg">
                      <div className="text-2xl font-bold text-red-600">{importPreview.unmatched}</div>
                      <div className="text-xs text-red-600">จับคู่ไม่ได้</div>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">คอลัมน์ที่จะนำเข้า ({importPreview.dataColumns?.length || 0})</p>
                    <div className="flex flex-wrap gap-1">
                      {importPreview.dataColumns?.map((col: string, i: number) => (
                        <Badge key={i} variant="outline" className="text-xs bg-cyan-50 text-cyan-700 border-cyan-200">{col}</Badge>
                      ))}
                    </div>
                  </div>

                  <div className="max-h-60 overflow-y-auto border rounded-lg">
                    <Table>
                      <TableHeader className="bg-slate-50 sticky top-0">
                        <TableRow>
                          <TableHead className="text-xs font-bold w-8">#</TableHead>
                          <TableHead className="text-xs font-bold">เลขผู้เสียภาษี</TableHead>
                          <TableHead className="text-xs font-bold">ชื่อลูกค้า</TableHead>
                          <TableHead className="text-xs font-bold text-center">สถานะ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importPreview.results?.map((r: any, i: number) => (
                          <TableRow key={i} className={r.matched ? "" : "bg-red-50/50"} data-testid={`row-import-preview-${i}`}>
                            <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                            <TableCell className="text-xs font-mono">{r.taxId || "-"}</TableCell>
                            <TableCell className="text-xs">{r.clientName || <span className="text-red-500">ไม่พบ</span>}</TableCell>
                            <TableCell className="text-xs text-center">
                              {r.matched ? (
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 text-[10px]">จับคู่ได้</Badge>
                              ) : (
                                <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 text-[10px]">ไม่พบ</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => { setImportPreview(null); setImportFile(null); }} data-testid="button-cancel-import">ยกเลิก</Button>
                    <Button
                      className="text-white"
                      style={{ background: "#03c9d7" }}
                      disabled={importLoading || importPreview.matched === 0}
                      onClick={async () => {
                        if (!board || !importFile) return;
                        setImportLoading(true);
                        try {
                          const formData = new FormData();
                          formData.append("file", importFile);
                          formData.append("boardId", String(board.id));
                          const res = await fetch("/api/work-status/import-excel", { method: "POST", body: formData, credentials: "include" });
                          if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
                          const result = await res.json();
                          toast({ title: `นำเข้าสำเร็จ! จับคู่ ${result.matched} ราย, อัปเดต ${result.cellsUpdated} เซลล์` });
                          setShowImportDialog(false);
                          setImportFile(null);
                          setImportPreview(null);
                          refetch();
                        } catch (err: any) {
                          toast({ title: "นำเข้าไม่สำเร็จ", description: err.message, variant: "destructive" });
                        } finally {
                          setImportLoading(false);
                        }
                      }}
                      data-testid="button-confirm-import"
                    >
                      {importLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> กำลังนำเข้า...</> : `ยืนยันนำเข้า (${importPreview.matched} ราย)`}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
