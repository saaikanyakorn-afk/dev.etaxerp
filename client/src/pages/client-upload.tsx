import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Upload, CheckCircle2, FileText, Image, File, AlertCircle, Loader2, X, FolderOpen, Folder, ChevronRight, ChevronDown } from "lucide-react";

const CATEGORIES = [
  "ใบเสร็จรับเงิน",
  "สลิปโอนเงิน",
  "ใบแจ้งหนี้",
  "ใบกำกับภาษี",
  "เอกสารสัญญา",
  "หนังสือรับรอง",
  "อื่นๆ",
];

interface FileWithPath {
  file: File;
  folderPath: string;
  relativePath: string;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function getFileIcon(mime: string) {
  if (mime?.startsWith("image/")) return <Image className="w-5 h-5 text-blue-500" />;
  if (mime?.includes("pdf")) return <FileText className="w-5 h-5 text-red-500" />;
  return <File className="w-5 h-5 text-gray-500" />;
}

function buildFolderTree(files: FileWithPath[]): Map<string, FileWithPath[]> {
  const map = new Map<string, FileWithPath[]>();
  for (const f of files) {
    const folder = f.folderPath || "(ไฟล์เดี่ยว)";
    if (!map.has(folder)) map.set(folder, []);
    map.get(folder)!.push(f);
  }
  return map;
}

async function getEntriesFromDataTransfer(dataTransfer: DataTransfer): Promise<FileWithPath[]> {
  const results: FileWithPath[] = [];

  async function readEntry(entry: FileSystemEntry, path: string) {
    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry;
      const file = await new Promise<File>((resolve) => fileEntry.file(resolve));
      const folderPath = path || "";
      results.push({ file, folderPath, relativePath: path ? `${path}/${file.name}` : file.name });
    } else if (entry.isDirectory) {
      const dirEntry = entry as FileSystemDirectoryEntry;
      const reader = dirEntry.createReader();
      const entries = await new Promise<FileSystemEntry[]>((resolve) => {
        const allEntries: FileSystemEntry[] = [];
        function readBatch() {
          reader.readEntries((batch) => {
            if (batch.length === 0) {
              resolve(allEntries);
            } else {
              allEntries.push(...batch);
              readBatch();
            }
          });
        }
        readBatch();
      });
      const newPath = path ? `${path}/${entry.name}` : entry.name;
      for (const child of entries) {
        await readEntry(child, newPath);
      }
    }
  }

  const items = dataTransfer.items;
  const entries: FileSystemEntry[] = [];
  for (let i = 0; i < items.length; i++) {
    const entry = items[i].webkitGetAsEntry?.();
    if (entry) entries.push(entry);
  }

  for (const entry of entries) {
    await readEntry(entry, "");
  }

  return results;
}

export default function ClientUploadPage() {
  const params = useParams<{ token: string }>();
  const token = params.token || "";

  const [files, setFiles] = useState<FileWithPath[]>([]);
  const [uploaderName, setUploaderName] = useState("");
  const [uploaderNote, setUploaderNote] = useState("");
  const [category, setCategory] = useState("อื่นๆ");
  const [dragOver, setDragOver] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const { data: linkInfo, isLoading, error } = useQuery<any>({
    queryKey: ["public-upload", token],
    queryFn: () => fetch(`/api/public/upload/${token}`).then(r => {
      if (!r.ok) return r.json().then(d => Promise.reject(d));
      return r.json();
    }),
    enabled: !!token,
    retry: false,
  });

  const { data: uploadedData, refetch: refetchUploaded } = useQuery<any>({
    queryKey: ["public-upload-files", token],
    queryFn: () => fetch(`/api/public/upload/${token}/files`).then(r => r.ok ? r.json() : { files: [], total: 0 }),
    enabled: !!token && !!linkInfo,
    retry: false,
  });
  const uploadedFiles: any[] = uploadedData?.files || [];

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const BATCH_SIZE = 20;
      let totalUploaded = 0;

      for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);
        const formData = new FormData();
        const folderPaths: string[] = [];

        for (const fw of batch) {
          formData.append("files", fw.file);
          folderPaths.push(fw.folderPath);
        }
        formData.append("uploaderName", uploaderName);
        formData.append("uploaderNote", uploaderNote);
        formData.append("category", category);
        formData.append("folderPaths", JSON.stringify(folderPaths));

        const res = await fetch(`/api/public/upload/${token}`, { method: "POST", body: formData });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || "อัพโหลดไม่สำเร็จ");
        }
        totalUploaded += batch.length;
        setUploadProgress(Math.round((totalUploaded / files.length) * 100));
      }
      return { success: true };
    },
    onSuccess: () => {
      setUploadDone(true);
      setFiles([]);
      setUploadProgress(0);
      refetchUploaded();
    },
  });

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const newFiles = await getEntriesFromDataTransfer(e.dataTransfer);
    if (newFiles.length > 0) {
      setFiles(prev => [...prev, ...newFiles]);
    } else {
      const dropped = Array.from(e.dataTransfer.files);
      setFiles(prev => [...prev, ...dropped.map(f => ({ file: f, folderPath: "", relativePath: f.name }))]);
    }
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map(f => ({
        file: f,
        folderPath: "",
        relativePath: f.name,
      }));
      setFiles(prev => [...prev, ...newFiles]);
    }
  }, []);

  const handleFolderInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map(f => {
        const relativePath = (f as any).webkitRelativePath || f.name;
        const parts = relativePath.split("/");
        const folderPath = parts.length > 1 ? parts.slice(0, -1).join("/") : "";
        return { file: f, folderPath, relativePath };
      });
      setFiles(prev => [...prev, ...newFiles]);
    }
  }, []);

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const removeFolder = (folderName: string) => {
    setFiles(prev => prev.filter(f => (f.folderPath || "(ไฟล์เดี่ยว)") !== folderName));
  };

  const toggleFolder = (folder: string) => {
    setCollapsedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folder)) next.delete(folder); else next.add(folder);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !linkInfo) {
    const errMsg = (error as any)?.message || "ลิงก์ไม่ถูกต้องหรือหมดอายุแล้ว";
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-800 mb-2">ไม่สามารถเข้าถึงได้</h1>
          <p className="text-gray-500">{errMsg}</p>
        </div>
      </div>
    );
  }

  if (uploadDone) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-800 mb-2">อัพโหลดสำเร็จ!</h1>
          <p className="text-gray-500 mb-6">ไฟล์ของท่านถูกส่งเรียบร้อยแล้ว ทางสำนักงานจะได้รับทันที</p>
          <button
            className="px-6 py-2.5 bg-[#fb9678] text-white rounded-xl font-medium hover:bg-[#e8856a] transition-colors"
            onClick={() => setUploadDone(false)}
            data-testid="upload-again-btn"
          >
            ส่งไฟล์เพิ่มเติม
          </button>
        </div>
      </div>
    );
  }

  const remaining = (linkInfo.maxFiles || 50) - (linkInfo.currentFileCount || 0);
  const folderTree = buildFolderTree(files);
  const folderNames = Array.from(folderTree.keys()).sort();
  const hasFolders = folderNames.some(f => f !== "(ไฟล์เดี่ยว)");
  const totalSize = files.reduce((sum, f) => sum + f.file.size, 0);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="bg-[#fb9678] px-6 py-5">
            <h1 className="text-white text-lg font-bold" data-testid="upload-title">
              {linkInfo.label || "ส่งเอกสาร"}
            </h1>
            <p className="text-white/80 text-sm mt-1">
              {linkInfo.firmName && <span>{linkInfo.firmName}</span>}
              {linkInfo.clientName && <span> — {linkInfo.clientName}</span>}
            </p>
          </div>

          <div className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">ชื่อผู้ส่ง</label>
              <input
                type="text"
                className="w-full px-3 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-[#fb9678]/30 focus:border-[#fb9678] outline-none"
                placeholder="ระบุชื่อของท่าน"
                value={uploaderName}
                onChange={e => setUploaderName(e.target.value)}
                data-testid="input-uploader-name"
              />
            </div>

            {!hasFolders && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">ประเภทเอกสาร</label>
                <select
                  className="w-full px-3 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-[#fb9678]/30 focus:border-[#fb9678] outline-none bg-white"
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  data-testid="select-category"
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}

            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors
                ${dragOver ? "border-[#fb9678] bg-[#fb9678]/5" : "border-gray-300 hover:border-gray-400"}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              data-testid="drop-zone"
            >
              <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-600">ลากไฟล์หรือโฟลเดอร์มาวางที่นี่</p>
              <p className="text-xs text-gray-400 mt-1">รองรับการลากโฟลเดอร์ทั้งโฟลเดอร์ (รักษาโครงสร้าง)</p>
              <p className="text-xs text-gray-400 mt-1">ส่งได้อีก {remaining} ไฟล์</p>

              <div className="flex items-center justify-center gap-3 mt-4">
                <button
                  className="px-4 py-2 bg-[#fb9678] text-white text-sm rounded-lg hover:bg-[#e8856a] transition-colors flex items-center gap-2"
                  onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  data-testid="btn-select-files"
                >
                  <File className="w-4 h-4" />
                  เลือกไฟล์
                </button>
                <button
                  className="px-4 py-2 bg-[#03c9d7] text-white text-sm rounded-lg hover:bg-[#02b3bf] transition-colors flex items-center gap-2"
                  onClick={e => { e.stopPropagation(); folderInputRef.current?.click(); }}
                  data-testid="btn-select-folder"
                >
                  <FolderOpen className="w-4 h-4" />
                  เลือกโฟลเดอร์
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileInput}
                data-testid="file-input"
              />
              <input
                ref={folderInputRef}
                type="file"
                className="hidden"
                onChange={handleFolderInput}
                {...{ webkitdirectory: "", directory: "" } as any}
                data-testid="folder-input"
              />
            </div>

            {files.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-700">
                    {files.length} ไฟล์พร้อมส่ง
                    {hasFolders && <span className="text-gray-400 ml-1">({folderNames.filter(f => f !== "(ไฟล์เดี่ยว)").length} โฟลเดอร์)</span>}
                  </p>
                  <p className="text-xs text-gray-400">{formatFileSize(totalSize)}</p>
                </div>

                {folderNames.map(folder => {
                  const folderFiles = folderTree.get(folder) || [];
                  const isCollapsed = collapsedFolders.has(folder);
                  const isRootFiles = folder === "(ไฟล์เดี่ยว)";

                  return (
                    <div key={folder} className="border rounded-lg overflow-hidden">
                      <div
                        className={`flex items-center gap-2 px-3 py-2 cursor-pointer ${isRootFiles ? "bg-gray-50" : "bg-[#03c9d7]/5"}`}
                        onClick={() => toggleFolder(folder)}
                        data-testid={`folder-header-${folder}`}
                      >
                        {isCollapsed ? <ChevronRight className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                        {isRootFiles ? <File className="w-4 h-4 text-gray-500" /> : <Folder className="w-4 h-4 text-[#03c9d7]" />}
                        <span className="text-sm font-medium text-gray-700 flex-1">
                          {isRootFiles ? "ไฟล์เดี่ยว" : folder}
                        </span>
                        <span className="text-xs text-gray-400">{folderFiles.length} ไฟล์</span>
                        <button
                          onClick={e => { e.stopPropagation(); removeFolder(folder); }}
                          className="text-gray-400 hover:text-red-500 p-0.5"
                          data-testid={`remove-folder-${folder}`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {!isCollapsed && (
                        <div className="divide-y divide-gray-100">
                          {folderFiles.map((fw, i) => {
                            const globalIdx = files.indexOf(fw);
                            return (
                              <div key={i} className="flex items-center gap-3 px-3 py-1.5 pl-10" data-testid={`file-item-${globalIdx}`}>
                                {getFileIcon(fw.file.type)}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-gray-700 truncate">{fw.file.name}</p>
                                  <p className="text-xs text-gray-400">{formatFileSize(fw.file.size)}</p>
                                </div>
                                <button onClick={() => removeFile(globalIdx)} className="text-gray-400 hover:text-red-500 p-1" data-testid={`remove-file-${globalIdx}`}>
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">หมายเหตุ (ถ้ามี)</label>
              <textarea
                className="w-full px-3 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-[#fb9678]/30 focus:border-[#fb9678] outline-none resize-none"
                rows={3}
                placeholder="ข้อความถึงสำนักงาน..."
                value={uploaderNote}
                onChange={e => setUploaderNote(e.target.value)}
                data-testid="input-note"
              />
            </div>

            {uploadMutation.isPending && uploadProgress > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>กำลังอัพโหลด...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-[#fb9678] rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}

            <button
              className="w-full py-3 bg-[#fb9678] text-white rounded-xl font-medium hover:bg-[#e8856a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              disabled={files.length === 0 || uploadMutation.isPending}
              onClick={() => uploadMutation.mutate()}
              data-testid="submit-upload"
            >
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  กำลังส่ง... {uploadProgress > 0 && `(${uploadProgress}%)`}
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  ส่งเอกสาร ({files.length} ไฟล์)
                </>
              )}
            </button>

            {uploadMutation.isError && (
              <p className="text-sm text-red-500 text-center" data-testid="upload-error">
                {(uploadMutation.error as any)?.message || "เกิดข้อผิดพลาด กรุณาลองใหม่"}
              </p>
            )}
          </div>
        </div>

        {uploadedFiles.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden mt-4" data-testid="section-uploaded-history">
            <div className="bg-gray-100 px-6 py-3 border-b">
              <h2 className="text-sm font-semibold text-gray-700" data-testid="text-uploaded-title">
                เอกสารที่ส่งไปแล้ว ({uploadedFiles.length})
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">รายการไฟล์ที่ส่งผ่านลิงก์นี้</p>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
              {uploadedFiles.map((f) => {
                const dt = f.createdAt ? new Date(f.createdAt) : null;
                const dateStr = dt ? `${dt.toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "2-digit" })} ${dt.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}` : "";
                return (
                  <div key={f.id} className="flex items-start gap-3 px-4 py-2.5" data-testid={`uploaded-file-${f.id}`}>
                    {getFileIcon(f.mimeType || "")}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 truncate" data-testid={`text-uploaded-name-${f.id}`}>{f.fileName}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                        {f.folderPath && <span className="truncate">{f.folderPath}</span>}
                        {f.folderPath && <span>•</span>}
                        <span>{f.category || "อื่นๆ"}</span>
                        {f.fileSize ? <><span>•</span><span>{formatFileSize(f.fileSize)}</span></> : null}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                        {f.uploaderName && <span>โดย {f.uploaderName}</span>}
                        {f.uploaderName && dateStr && <span>•</span>}
                        {dateStr && <span>{dateStr}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-4">
          Powered by E-Tax Center
        </p>
      </div>
    </div>
  );
}
