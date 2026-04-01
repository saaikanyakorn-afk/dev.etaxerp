import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Paperclip, FileDown, ExternalLink } from "lucide-react";

interface FileEntry {
  path: string;
  name: string;
}

function parseAttachedUrl(attachedUrl: string): FileEntry[] {
  if (!attachedUrl) return [];
  try {
    const parsed = JSON.parse(attachedUrl);
    if (Array.isArray(parsed)) return parsed;
    if (parsed.path || parsed.objectPath) {
      return [{ path: parsed.path || parsed.objectPath, name: parsed.name || "ไฟล์แนบ" }];
    }
    return [];
  } catch {
    if (attachedUrl.startsWith("http") || attachedUrl.startsWith("/")) {
      return [{ path: attachedUrl, name: attachedUrl.split("/").pop() || "ไฟล์แนบ" }];
    }
    return [];
  }
}

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(ext)) return "🖼️";
  if (["pdf"].includes(ext)) return "📄";
  if (["doc", "docx"].includes(ext)) return "📝";
  if (["xls", "xlsx", "csv"].includes(ext)) return "📊";
  if (["zip", "rar", "7z"].includes(ext)) return "📦";
  return "📎";
}

export default function AttachmentViewDialog({
  open,
  onOpenChange,
  attachedUrl,
  docNo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attachedUrl: string;
  docNo?: string;
}) {
  const files = parseAttachedUrl(attachedUrl);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="attachment-view-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-purple-100">
              <Paperclip className="w-4 h-4 text-purple-600" />
            </div>
            เอกสารแนบ {docNo && <span className="text-sm text-slate-400 font-normal">({docNo})</span>}
          </DialogTitle>
        </DialogHeader>

        {files.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">
            ยังไม่มีเอกสารแนบสำหรับรายการนี้
          </div>
        ) : (
          <div className="space-y-2">
            {files.map((file, idx) => (
              <a
                key={idx}
                href={file.path}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-purple-300 hover:bg-purple-50/50 transition-colors group"
                data-testid={`attachment-file-${idx}`}
              >
                <span className="text-lg shrink-0">{getFileIcon(file.name)}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-700 group-hover:text-purple-700 truncate">
                    {file.name}
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-purple-500 shrink-0" />
              </a>
            ))}
            <div className="text-xs text-slate-400 text-center pt-1">
              {files.length} ไฟล์แนบ
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
