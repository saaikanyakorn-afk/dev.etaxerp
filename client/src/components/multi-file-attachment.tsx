import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, FileDown, X, Loader2 } from "lucide-react";
import { useUpload } from "@/hooks/use-upload";

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

function serializeFiles(files: FileEntry[]): string {
  if (files.length === 0) return "";
  return JSON.stringify(files);
}

interface MultiFileAttachmentProps {
  value: string;
  onChange: (attachedUrl: string) => void;
  disabled?: boolean;
  testIdPrefix?: string;
}

export default function MultiFileAttachment({ value, onChange, disabled, testIdPrefix = "attachment" }: MultiFileAttachmentProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);
  const files = parseAttachedUrl(value);

  useEffect(() => {
    const prevent = (e: DragEvent) => { e.preventDefault(); };
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", prevent);
    };
  }, []);

  const { uploadFile, isUploading } = useUpload({
    onSuccess: (response) => {
      const newFile: FileEntry = {
        path: response.objectPath,
        name: response.metadata.name,
      };
      const currentFiles = parseAttachedUrl(value);
      const updated = [...currentFiles, newFile];
      onChange(serializeFiles(updated));
      setUploadQueue(q => Math.max(0, q - 1));
    },
    onError: () => {
      setUploadQueue(q => Math.max(0, q - 1));
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;
    setUploadQueue(selectedFiles.length);
    for (let i = 0; i < selectedFiles.length; i++) {
      uploadFile(selectedFiles[i]);
    }
    e.target.value = "";
  };

  const uploadFiles = (fileList: FileList | File[]) => {
    const arr = Array.from(fileList);
    if (arr.length === 0) return;
    setUploadQueue(q => q + arr.length);
    arr.forEach(f => uploadFile(f));
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    dragCounterRef.current += 1;
    if (e.dataTransfer.types?.includes("Files")) {
      setIsDragging(true);
    }
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);
    if (disabled) return;
    const dropped = e.dataTransfer.files;
    if (dropped && dropped.length > 0) {
      uploadFiles(dropped);
    }
  };

  const removeFile = (idx: number) => {
    const updated = files.filter((_, i) => i !== idx);
    onChange(serializeFiles(updated));
  };

  return (
    <div
      className={`space-y-1.5 rounded-md transition-colors ${isDragging ? "bg-orange-50 ring-2 ring-[#fb9678] ring-dashed p-2" : ""}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      data-testid={`${testIdPrefix}-dropzone`}
    >
      {isDragging && (
        <div className="text-xs text-[#fb9678] font-medium text-center py-1">
          วางไฟล์ที่นี่เพื่ออัพโหลด
        </div>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,.rar"
          multiple
          onChange={handleFileSelect}
          data-testid={`${testIdPrefix}-input`}
        />
        <Button
          variant="outline"
          size="sm"
          type="button"
          className="h-8 gap-1.5 border-[#fb9678]/40 bg-orange-50 hover:bg-orange-100 text-[#fb9678] shrink-0"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || disabled}
          data-testid={`${testIdPrefix}-button`}
        >
          {isUploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Paperclip className="h-3.5 w-3.5" />
          )}
          {isUploading ? `กำลังอัพโหลด...` : "แนบไฟล์"}
        </Button>
        {files.length === 0 && !isUploading && (
          <span className="text-xs text-slate-400 shrink-0">ยังไม่มีไฟล์แนบ</span>
        )}
      </div>

      {files.length > 0 && (
        <div className="space-y-1">
          {files.map((file, idx) => (
            <div key={idx} className="flex items-center gap-1.5 min-w-0 group bg-slate-50 rounded px-2 py-1 border border-slate-200">
              <FileDown className="h-3.5 w-3.5 text-[#fb9678] shrink-0" />
              <a
                href={file.path}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#fb9678] hover:underline truncate text-left flex-1"
                data-testid={`${testIdPrefix}-file-${idx}`}
              >
                {file.name}
              </a>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeFile(idx)}
                  className="text-red-400 hover:text-red-600 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity"
                  data-testid={`${testIdPrefix}-remove-${idx}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
          <div className="text-[10px] text-slate-400">
            {files.length} ไฟล์แนบ
          </div>
        </div>
      )}
    </div>
  );
}

export { parseAttachedUrl, serializeFiles };
export type { FileEntry };
