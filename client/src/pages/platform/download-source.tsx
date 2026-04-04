import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import PlatformLayout from "@/components/platform-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  GitBranch,
  GitCommit,
  Upload,
  Download,
  Loader2,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  FileCode,
  Clock,
  User,
  Hash,
  Globe,
  ArrowUpCircle,
  ArrowDownCircle,
  Server,
  Code,
  Files,
  Tag,
} from "lucide-react";

interface GitInfo {
  local: {
    branch: string;
    commit: string;
    commitFull: string;
    lastCommitDate: string;
    lastCommitMsg: string;
    lastCommitAuthor: string;
    totalCommits: number;
    version: string;
    tsFiles: number;
    totalLines: number;
    trackedFiles: number;
  };
  github: {
    remoteUrl: string;
    hasRemote: boolean;
    reachable: boolean;
    branch: string;
    commit: string;
    commitDate: string;
    commitMsg: string;
    behindCount: number;
    aheadCount: number;
  };
}

function formatDate(dateStr: string) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}

function InfoRow({ icon: Icon, label, value, mono }: { icon: any; label: string; value: string | number; mono?: boolean }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
      <Icon className="h-4 w-4 text-gray-400 shrink-0" />
      <span className="text-sm text-gray-500 w-36 shrink-0">{label}</span>
      <span className={`text-sm text-gray-900 ${mono ? "font-mono text-xs" : ""}`} data-testid={`text-${label.toLowerCase().replace(/\s/g, "-")}`}>{value || "—"}</span>
    </div>
  );
}

export default function GithubManagement() {
  const [pushLoading, setPushLoading] = useState(false);
  const [pullLoading, setPullLoading] = useState(false);
  const [commitMessage, setCommitMessage] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const { data: info, isLoading, refetch, isFetching } = useQuery<GitInfo>({
    queryKey: ["/api/platform/github/info"],
    refetchOnWindowFocus: false,
  });

  const handlePush = async () => {
    if (!confirm("ยืนยัน Push ไปยัง GitHub?\n\nจะสร้าง orphan commit ใหม่และ force push ไปที่ main branch")) return;
    setPushLoading(true);
    setError("");
    setSuccess("");
    try {
      const r = await fetch("/api/platform/github/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ commitMessage: commitMessage || undefined }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message);
      setSuccess(`Push สำเร็จ! ${data.tag} — ${data.message}`);
      setCommitMessage("");
      refetch();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPushLoading(false);
    }
  };

  const handlePull = async () => {
    setPullLoading(true);
    setError("");
    setSuccess("");
    try {
      const r = await fetch("/api/platform/github/pull", {
        method: "POST",
        credentials: "include",
      });
      if (!r.ok) {
        const data = await r.json();
        throw new Error(data.message);
      }
      const blob = await r.blob();
      const cd = r.headers.get("Content-Disposition") || "";
      const match = cd.match(/filename="?([^";\n]+)"?/);
      const filename = match?.[1] || `etax-github-${new Date().toISOString().slice(0, 10)}.zip`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      const sizeMB = (blob.size / 1024 / 1024).toFixed(1);
      setSuccess(`ดาวน์โหลดสำเร็จ! ${filename} (${sizeMB} MB)`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPullLoading(false);
    }
  };

  return (
    <PlatformLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900" data-testid="text-github-title">Github Push & Pull</h1>
            <p className="text-gray-500 mt-1">จัดการ source code ระหว่าง Replit กับ GitHub</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            data-testid="button-refresh-info"
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg" data-testid="alert-error">
            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
        {success && (
          <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg" data-testid="alert-success">
            <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
            <p className="text-sm text-green-700">{success}</p>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : info ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Server className="h-5 w-5 text-blue-500" />
                    Local (Replit)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <InfoRow icon={GitBranch} label="Branch" value={info.local.branch} mono />
                  <InfoRow icon={GitCommit} label="Commit" value={info.local.commit} mono />
                  <InfoRow icon={Clock} label="Last Changed" value={formatDate(info.local.lastCommitDate)} />
                  <InfoRow icon={User} label="Author" value={info.local.lastCommitAuthor} />
                  <InfoRow icon={Hash} label="Message" value={info.local.lastCommitMsg} />
                  <InfoRow icon={Tag} label="Version" value={info.local.version} mono />
                  <InfoRow icon={GitCommit} label="Total Commits" value={info.local.totalCommits.toLocaleString()} />

                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Codebase Stats</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center p-2 bg-gray-50 rounded-lg">
                        <Code className="h-4 w-4 mx-auto text-blue-400 mb-1" />
                        <p className="text-lg font-semibold text-gray-900">{info.local.totalLines.toLocaleString()}</p>
                        <p className="text-[10px] text-gray-500">Lines of Code</p>
                      </div>
                      <div className="text-center p-2 bg-gray-50 rounded-lg">
                        <FileCode className="h-4 w-4 mx-auto text-green-400 mb-1" />
                        <p className="text-lg font-semibold text-gray-900">{info.local.tsFiles.toLocaleString()}</p>
                        <p className="text-[10px] text-gray-500">TS/TSX Files</p>
                      </div>
                      <div className="text-center p-2 bg-gray-50 rounded-lg">
                        <Files className="h-4 w-4 mx-auto text-purple-400 mb-1" />
                        <p className="text-lg font-semibold text-gray-900">{info.local.trackedFiles.toLocaleString()}</p>
                        <p className="text-[10px] text-gray-500">Tracked Files</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Globe className="h-5 w-5 text-gray-700" />
                    GitHub Remote
                    {info.github.hasRemote && (
                      <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${info.github.reachable ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {info.github.reachable ? "Connected" : "Unreachable"}
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!info.github.hasRemote ? (
                    <div className="text-center py-8 text-gray-400">
                      <Globe className="h-10 w-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No GitHub remote configured</p>
                    </div>
                  ) : (
                    <>
                      <InfoRow icon={Globe} label="Remote URL" value={info.github.remoteUrl} mono />
                      <InfoRow icon={GitBranch} label="Branch" value={info.github.branch || "—"} mono />
                      <InfoRow icon={GitCommit} label="Commit" value={info.github.commit || "—"} mono />
                      <InfoRow icon={Clock} label="Last Changed" value={formatDate(info.github.commitDate)} />
                      <InfoRow icon={Hash} label="Message" value={info.github.commitMsg || "—"} />

                      {info.github.reachable && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Sync Status</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div className={`flex items-center gap-2 p-2.5 rounded-lg ${info.github.aheadCount > 0 ? "bg-blue-50" : "bg-gray-50"}`}>
                              <ArrowUpCircle className={`h-5 w-5 ${info.github.aheadCount > 0 ? "text-blue-500" : "text-gray-300"}`} />
                              <div>
                                <p className="text-lg font-semibold text-gray-900">{info.github.aheadCount}</p>
                                <p className="text-[10px] text-gray-500">Ahead (local new)</p>
                              </div>
                            </div>
                            <div className={`flex items-center gap-2 p-2.5 rounded-lg ${info.github.behindCount > 0 ? "bg-amber-50" : "bg-gray-50"}`}>
                              <ArrowDownCircle className={`h-5 w-5 ${info.github.behindCount > 0 ? "text-amber-500" : "text-gray-300"}`} />
                              <div>
                                <p className="text-lg font-semibold text-gray-900">{info.github.behindCount}</p>
                                <p className="text-[10px] text-gray-500">Behind (github new)</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-t-4 border-t-blue-500">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Upload className="h-5 w-5 text-blue-500" />
                    Push to GitHub
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-gray-500">
                    สร้าง orphan commit แล้ว force push ไปที่ <code className="bg-gray-100 px-1 rounded text-xs">main</code> branch บน GitHub พร้อม version tag
                  </p>
                  <div>
                    <label className="text-sm text-gray-600 mb-1 block">Commit Message (optional)</label>
                    <Input
                      value={commitMessage}
                      onChange={(e) => setCommitMessage(e.target.value)}
                      placeholder={`Manual push ${new Date().toISOString().slice(0, 10)}`}
                      data-testid="input-commit-message"
                    />
                  </div>
                  <Button
                    onClick={handlePush}
                    disabled={pushLoading || !info.github.hasRemote}
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white"
                    data-testid="button-push"
                  >
                    {pushLoading ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Pushing...</>
                    ) : (
                      <><Upload className="h-4 w-4 mr-2" />Push to GitHub</>
                    )}
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-t-4 border-t-green-500">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Download className="h-5 w-5 text-green-500" />
                    Pull from GitHub
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-gray-500">
                    ดาวน์โหลด source code ล่าสุดจาก GitHub <code className="bg-gray-100 px-1 rounded text-xs">main</code> branch เป็นไฟล์ ZIP (ไม่ได้เขียนทับ local)
                  </p>
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs text-amber-700">ไฟล์จะถูกดาวน์โหลดเป็น ZIP — ไม่ได้ merge เข้า local โดยตรง เหมาะสำหรับนำไปใช้กับ etaxerp หรือ deploy server อื่น</p>
                  </div>
                  <Button
                    onClick={handlePull}
                    disabled={pullLoading || !info.github.hasRemote}
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                    data-testid="button-pull"
                  >
                    {pullLoading ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Downloading...</>
                    ) : (
                      <><Download className="h-4 w-4 mr-2" />Pull from GitHub (.zip)</>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </>
        ) : null}
      </div>
    </PlatformLayout>
  );
}
