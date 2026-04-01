import { useState, useMemo } from "react";
import ThaiDateInput from "@/components/thai-date-input";
import { useDateSettings } from "@/hooks/use-date-settings";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useCompany } from "@/lib/company-context";
import Layout from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Plus,
  Calendar,
  Clock,
  Video,
  ExternalLink,
  Users,
  Check,
  X,
  Filter,
  ChevronRight,
  Edit,
  Trash2,
  Link as LinkIcon,
  Search,
} from "lucide-react";

interface Participant {
  id: number;
  userId: number;
  fullName: string;
  status: string;
}

interface Meeting {
  id: number;
  tenantId: number | null;
  companyId: number | null;
  title: string;
  description: string | null;
  meetingUrl: string | null;
  meetingType: string;
  startTime: string;
  endTime: string;
  createdBy: number;
  createdByName: string;
  status: string;
  chatRoomId: number | null;
  createdAt: string;
  participants: Participant[];
}

interface UserOption {
  id: number;
  fullName: string;
  username: string;
}

type FilterType = "upcoming" | "past" | "my";

function formatThaiDate(dateStr: string) {
  const d = new Date(dateStr);
  const day = d.getDate();
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const month = months[d.getMonth()];
  const year = d.getFullYear() + 543;
  return `${day} ${month} ${year}`;
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

function getStatusBadge(status: string) {
  switch (status) {
    case "scheduled":
      return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100" data-testid="badge-status-scheduled">กำหนดการ</Badge>;
    case "in_progress":
      return <Badge className="bg-green-100 text-green-700 hover:bg-green-100" data-testid="badge-status-in-progress">กำลังประชุม</Badge>;
    case "completed":
      return <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100" data-testid="badge-status-completed">เสร็จสิ้น</Badge>;
    case "cancelled":
      return <Badge className="bg-red-100 text-red-600 hover:bg-red-100" data-testid="badge-status-cancelled">ยกเลิก</Badge>;
    default:
      return <Badge data-testid="badge-status-default">{status}</Badge>;
  }
}

function getParticipantBadge(status: string) {
  switch (status) {
    case "accepted":
      return <span className="inline-flex items-center gap-0.5 text-xs text-green-600"><Check className="h-3 w-3" /> ตอบรับ</span>;
    case "declined":
      return <span className="inline-flex items-center gap-0.5 text-xs text-red-500"><X className="h-3 w-3" /> ปฏิเสธ</span>;
    default:
      return <span className="inline-flex items-center gap-0.5 text-xs text-amber-500"><Clock className="h-3 w-3" /> รอตอบ</span>;
  }
}

function getMeetingTypeLabel(type: string) {
  switch (type) {
    case "google_meet": return "Google Meet";
    case "zoom": return "Zoom";
    default: return "อื่นๆ";
  }
}

export default function MeetingsPage() {
  const { user } = useAuth();
  const { selectedCompanyId } = useCompany();
  const { dateEra, dateFmt } = useDateSettings();
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<FilterType>("upcoming");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);

  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formMeetingUrl, setFormMeetingUrl] = useState("");
  const [formMeetingType, setFormMeetingType] = useState("other");
  const [formStartDate, setFormStartDate] = useState("");
  const [formStartTime, setFormStartTime] = useState("09:00");
  const [formEndDate, setFormEndDate] = useState("");
  const [formEndTime, setFormEndTime] = useState("10:00");
  const [formParticipantIds, setFormParticipantIds] = useState<number[]>([]);
  const [participantSearch, setParticipantSearch] = useState("");

  const { data: meetings = [], isLoading } = useQuery<Meeting[]>({
    queryKey: ["/api/meetings"],
    queryFn: async () => {
      const r = await fetch("/api/meetings", { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!user,
  });

  const { data: allUsers = [] } = useQuery<UserOption[]>({
    queryKey: ["/api/users/list"],
    queryFn: async () => {
      const r = await fetch("/api/users", { credentials: "include" });
      if (!r.ok) return [];
      const data = await r.json();
      return data.map((u: any) => ({ id: u.id, fullName: u.fullName, username: u.username }));
    },
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await apiRequest("POST", "/api/meetings", data);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      resetForm();
      setShowCreateDialog(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const r = await apiRequest("PATCH", `/api/meetings/${id}`, data);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      resetForm();
      setShowCreateDialog(false);
      setEditingMeeting(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiRequest("DELETE", `/api/meetings/${id}`);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      setShowDetailDialog(false);
      setSelectedMeeting(null);
    },
  });

  const respondMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const r = await apiRequest("POST", `/api/meetings/${id}/respond`, { status });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
    },
  });

  function resetForm() {
    setFormTitle("");
    setFormDescription("");
    setFormMeetingUrl("");
    setFormMeetingType("other");
    setFormStartDate("");
    setFormStartTime("09:00");
    setFormEndDate("");
    setFormEndTime("10:00");
    setFormParticipantIds([]);
    setParticipantSearch("");
  }

  function openEditDialog(meeting: Meeting) {
    setEditingMeeting(meeting);
    setFormTitle(meeting.title);
    setFormDescription(meeting.description || "");
    setFormMeetingUrl(meeting.meetingUrl || "");
    setFormMeetingType(meeting.meetingType);
    const start = new Date(meeting.startTime);
    const end = new Date(meeting.endTime);
    setFormStartDate(start.toISOString().split("T")[0]);
    setFormStartTime(start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
    setFormEndDate(end.toISOString().split("T")[0]);
    setFormEndTime(end.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
    setFormParticipantIds(meeting.participants.map(p => p.userId).filter(id => id !== user?.id));
    setShowCreateDialog(true);
  }

  function handleSubmit() {
    if (!formTitle || !formStartDate || !formEndDate) return;
    const startTime = new Date(`${formStartDate}T${formStartTime}:00`).toISOString();
    const endTime = new Date(`${formEndDate}T${formEndTime}:00`).toISOString();

    const payload = {
      title: formTitle,
      description: formDescription || null,
      meetingUrl: formMeetingUrl || null,
      meetingType: formMeetingType,
      startTime,
      endTime,
      companyId: selectedCompanyId,
      participantIds: formParticipantIds,
    };

    if (editingMeeting) {
      updateMutation.mutate({ id: editingMeeting.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const filteredMeetings = useMemo(() => {
    const now = new Date();
    let filtered = meetings;

    if (filter === "upcoming") {
      filtered = filtered.filter(m => new Date(m.startTime) >= now && m.status !== "cancelled");
    } else if (filter === "past") {
      filtered = filtered.filter(m => new Date(m.endTime) < now || m.status === "completed");
    } else if (filter === "my") {
      filtered = filtered.filter(m => m.createdBy === user?.id);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(m =>
        m.title.toLowerCase().includes(q) ||
        (m.description && m.description.toLowerCase().includes(q))
      );
    }

    return filtered.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [meetings, filter, searchQuery, user]);

  const filteredUserOptions = useMemo(() => {
    if (!participantSearch.trim()) return allUsers.filter(u => u.id !== user?.id);
    const q = participantSearch.toLowerCase();
    return allUsers.filter(u =>
      u.id !== user?.id &&
      (u.fullName.toLowerCase().includes(q) || u.username.toLowerCase().includes(q))
    );
  }, [allUsers, participantSearch, user]);

  function getMyParticipantStatus(meeting: Meeting) {
    const p = meeting.participants.find(p => p.userId === user?.id);
    return p?.status || null;
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800" data-testid="text-meetings-title">ห้องประชุม</h1>
            <p className="text-sm text-gray-500 mt-1" data-testid="text-meetings-subtitle">จัดการนัดประชุมและเชิญผู้เข้าร่วม</p>
          </div>
          <Button
            onClick={() => { resetForm(); setEditingMeeting(null); setShowCreateDialog(true); }}
            className="gap-2"
            style={{ background: "var(--theme-primary)" }}
            data-testid="button-create-meeting"
          >
            <Plus className="h-4 w-4" />
            สร้างการประชุม
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="ค้นหาการประชุม..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-meeting-search"
            />
          </div>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {([
              { key: "upcoming" as FilterType, label: "กำลังจะมาถึง" },
              { key: "past" as FilterType, label: "ผ่านไปแล้ว" },
              { key: "my" as FilterType, label: "ของฉัน" },
            ]).map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "px-3 py-1.5 text-sm rounded-md transition-colors",
                  filter === f.key ? "bg-white shadow-sm font-medium text-gray-800" : "text-gray-500 hover:text-gray-700"
                )}
                data-testid={`button-filter-${f.key}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-xl border p-5 animate-pulse">
                <div className="h-5 w-48 bg-gray-200 rounded mb-3" />
                <div className="h-4 w-32 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        ) : filteredMeetings.length === 0 ? (
          <div className="bg-white rounded-xl border p-12 text-center" data-testid="text-no-meetings">
            <Calendar className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">ไม่มีการประชุม</p>
            <p className="text-sm text-gray-400 mt-1">สร้างการประชุมใหม่เพื่อเริ่มต้น</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredMeetings.map(meeting => {
              const myStatus = getMyParticipantStatus(meeting);
              const isCreator = meeting.createdBy === user?.id;
              const isPast = new Date(meeting.endTime) < new Date();

              return (
                <div
                  key={meeting.id}
                  className={cn(
                    "bg-white rounded-xl border p-5 hover:shadow-md transition-shadow cursor-pointer group",
                    meeting.status === "cancelled" && "opacity-60"
                  )}
                  onClick={() => { setSelectedMeeting(meeting); setShowDetailDialog(true); }}
                  data-testid={`card-meeting-${meeting.id}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-800 truncate" data-testid={`text-meeting-title-${meeting.id}`}>
                          {meeting.title}
                        </h3>
                        {getStatusBadge(meeting.status)}
                        {meeting.meetingType !== "other" && (
                          <Badge variant="outline" className="text-xs" data-testid={`badge-meeting-type-${meeting.id}`}>
                            {getMeetingTypeLabel(meeting.meetingType)}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatThaiDate(meeting.startTime)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {formatTime(meeting.startTime)} - {formatTime(meeting.endTime)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {meeting.participants.length} คน
                        </span>
                      </div>
                      {meeting.description && (
                        <p className="text-sm text-gray-400 mt-1 line-clamp-1">{meeting.description}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {!isCreator && myStatus === "invited" && !isPast && meeting.status !== "cancelled" && (
                        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-green-600 border-green-200 hover:bg-green-50"
                            onClick={() => respondMutation.mutate({ id: meeting.id, status: "accepted" })}
                            data-testid={`button-accept-meeting-${meeting.id}`}
                          >
                            <Check className="h-3.5 w-3.5 mr-1" /> ตอบรับ
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-red-500 border-red-200 hover:bg-red-50"
                            onClick={() => respondMutation.mutate({ id: meeting.id, status: "declined" })}
                            data-testid={`button-decline-meeting-${meeting.id}`}
                          >
                            <X className="h-3.5 w-3.5 mr-1" /> ปฏิเสธ
                          </Button>
                        </div>
                      )}
                      {meeting.meetingUrl && meeting.status !== "cancelled" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1"
                          onClick={e => { e.stopPropagation(); window.open(meeting.meetingUrl!, "_blank"); }}
                          data-testid={`button-join-meeting-${meeting.id}`}
                        >
                          <Video className="h-3.5 w-3.5" /> เข้าร่วม
                        </Button>
                      )}
                      <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
          <DialogContent className="max-w-lg">
            {selectedMeeting && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2" data-testid="text-detail-title">
                    {selectedMeeting.title}
                    {getStatusBadge(selectedMeeting.status)}
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">วันที่</span>
                      <p className="font-medium" data-testid="text-detail-date">{formatThaiDate(selectedMeeting.startTime)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">เวลา</span>
                      <p className="font-medium" data-testid="text-detail-time">
                        {formatTime(selectedMeeting.startTime)} - {formatTime(selectedMeeting.endTime)}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">ประเภท</span>
                      <p className="font-medium" data-testid="text-detail-type">{getMeetingTypeLabel(selectedMeeting.meetingType)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">สร้างโดย</span>
                      <p className="font-medium" data-testid="text-detail-creator">{selectedMeeting.createdByName}</p>
                    </div>
                  </div>

                  {selectedMeeting.description && (
                    <div>
                      <span className="text-sm text-gray-500">รายละเอียด</span>
                      <p className="text-sm mt-1" data-testid="text-detail-description">{selectedMeeting.description}</p>
                    </div>
                  )}

                  {selectedMeeting.meetingUrl && (
                    <div>
                      <span className="text-sm text-gray-500">ลิงก์ประชุม</span>
                      <a
                        href={selectedMeeting.meetingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm text-blue-600 hover:underline mt-1"
                        data-testid="link-meeting-url"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        {selectedMeeting.meetingUrl}
                      </a>
                    </div>
                  )}

                  <div>
                    <span className="text-sm text-gray-500 block mb-2">ผู้เข้าร่วม ({selectedMeeting.participants.length})</span>
                    <div className="space-y-2">
                      {selectedMeeting.participants.map(p => (
                        <div key={p.id} className="flex items-center justify-between py-1.5 px-3 bg-gray-50 rounded-lg" data-testid={`participant-${p.userId}`}>
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                              {p.fullName.charAt(0)}
                            </div>
                            <span className="text-sm font-medium">{p.fullName}</span>
                            {p.userId === selectedMeeting.createdBy && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">ผู้จัด</Badge>
                            )}
                          </div>
                          {getParticipantBadge(p.status)}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <DialogFooter className="gap-2">
                  {selectedMeeting.createdBy === user?.id && selectedMeeting.status !== "cancelled" && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-500 hover:bg-red-50"
                        onClick={() => deleteMutation.mutate(selectedMeeting.id)}
                        data-testid="button-cancel-meeting"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> ยกเลิกประชุม
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setShowDetailDialog(false); openEditDialog(selectedMeeting); }}
                        data-testid="button-edit-meeting"
                      >
                        <Edit className="h-3.5 w-3.5 mr-1" /> แก้ไข
                      </Button>
                    </>
                  )}
                  {selectedMeeting.meetingUrl && selectedMeeting.status !== "cancelled" && (
                    <Button
                      size="sm"
                      className="gap-1"
                      style={{ background: "var(--theme-primary)" }}
                      onClick={() => window.open(selectedMeeting.meetingUrl!, "_blank")}
                      data-testid="button-join-detail"
                    >
                      <Video className="h-3.5 w-3.5" /> เข้าร่วมประชุม
                    </Button>
                  )}
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={showCreateDialog} onOpenChange={(open) => { if (!open) { resetForm(); setEditingMeeting(null); } setShowCreateDialog(open); }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle data-testid="text-form-title">
                {editingMeeting ? "แก้ไขการประชุม" : "สร้างการประชุมใหม่"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label>หัวข้อ *</Label>
                <Input
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="เช่น ประชุมทีม, สัมภาษณ์ลูกค้า"
                  data-testid="input-meeting-title"
                />
              </div>

              <div>
                <Label>รายละเอียด</Label>
                <Textarea
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  placeholder="หมายเหตุหรือวาระการประชุม"
                  rows={3}
                  data-testid="input-meeting-description"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>วันที่เริ่ม *</Label>
                  <ThaiDateInput
                    value={formStartDate}
                    onChange={(v: string) => { setFormStartDate(v); if (!formEndDate) setFormEndDate(v); }}
                    dateEra={dateEra} dateFmt={dateFmt}
                    data-testid="input-start-date"
                  />
                </div>
                <div>
                  <Label>เวลาเริ่ม</Label>
                  <Input
                    type="time"
                    value={formStartTime}
                    onChange={e => setFormStartTime(e.target.value)}
                    data-testid="input-start-time"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>วันที่สิ้นสุด *</Label>
                  <ThaiDateInput
                    value={formEndDate}
                    onChange={setFormEndDate}
                    dateEra={dateEra} dateFmt={dateFmt}
                    data-testid="input-end-date"
                  />
                </div>
                <div>
                  <Label>เวลาสิ้นสุด</Label>
                  <Input
                    type="time"
                    value={formEndTime}
                    onChange={e => setFormEndTime(e.target.value)}
                    data-testid="input-end-time"
                  />
                </div>
              </div>

              <div>
                <Label>ประเภทการประชุม</Label>
                <Select value={formMeetingType} onValueChange={setFormMeetingType}>
                  <SelectTrigger data-testid="select-meeting-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="google_meet">Google Meet</SelectItem>
                    <SelectItem value="zoom">Zoom</SelectItem>
                    <SelectItem value="other">อื่นๆ</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>ลิงก์ประชุม</Label>
                <div className="relative">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    value={formMeetingUrl}
                    onChange={e => setFormMeetingUrl(e.target.value)}
                    placeholder="https://meet.google.com/xxx-xxxx-xxx"
                    className="pl-9"
                    data-testid="input-meeting-url"
                  />
                </div>
              </div>

              <div>
                <Label>เชิญผู้เข้าร่วม</Label>
                <Input
                  value={participantSearch}
                  onChange={e => setParticipantSearch(e.target.value)}
                  placeholder="ค้นหาชื่อผู้ใช้..."
                  className="mb-2"
                  data-testid="input-participant-search"
                />
                {formParticipantIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {formParticipantIds.map(id => {
                      const u = allUsers.find(u => u.id === id);
                      if (!u) return null;
                      return (
                        <Badge
                          key={id}
                          variant="secondary"
                          className="gap-1 cursor-pointer hover:bg-red-100"
                          onClick={() => setFormParticipantIds(prev => prev.filter(p => p !== id))}
                          data-testid={`badge-participant-${id}`}
                        >
                          {u.fullName}
                          <X className="h-3 w-3" />
                        </Badge>
                      );
                    })}
                  </div>
                )}
                <div className="max-h-32 overflow-y-auto border rounded-md">
                  {filteredUserOptions.filter(u => !formParticipantIds.includes(u.id)).slice(0, 10).map(u => (
                    <button
                      key={u.id}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 border-b last:border-0"
                      onClick={() => setFormParticipantIds(prev => [...prev, u.id])}
                      data-testid={`button-add-participant-${u.id}`}
                    >
                      <div className="h-6 w-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                        {u.fullName.charAt(0)}
                      </div>
                      <span>{u.fullName}</span>
                      <span className="text-gray-400 text-xs">@{u.username}</span>
                    </button>
                  ))}
                  {filteredUserOptions.filter(u => !formParticipantIds.includes(u.id)).length === 0 && (
                    <div className="px-3 py-3 text-center text-sm text-gray-400">ไม่พบผู้ใช้</div>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => { setShowCreateDialog(false); resetForm(); setEditingMeeting(null); }}
                data-testid="button-cancel-form"
              >
                ยกเลิก
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!formTitle || !formStartDate || !formEndDate || createMutation.isPending || updateMutation.isPending}
                style={{ background: "var(--theme-primary)" }}
                data-testid="button-submit-meeting"
              >
                {editingMeeting ? "บันทึก" : "สร้างการประชุม"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
