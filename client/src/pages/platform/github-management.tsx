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
  BarChart3,
  Key,
  Eye,
  EyeOff,
} from "lucide-react";

interface LocalInfo {
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
}

interface RemoteInfo {
  remoteUrl: string;
  hasRemote: boolean;
  reachable: boolean;
  branch: string;
  commit: string;
  commitDate: string;
  commitMsg: string;
  behindCount: number;
  aheadCount: number;
}

function formatDate(dateStr: string) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}

function InfoRow({ icon: Icon, label, value, mono }: { icon: any; label: string; value: string | number; mono?: boolean }) {
  return (
    <div className="flex items-center gap-3 py-1.5 border-b border-gray-100 last:border-0">
      <Icon className="h-3.5 w-3.5 text-gray-400 shrink-0" />
      <span className="text-sm text-gray-500 w-32 shrink-0">{label}</span>
      <span className={`text-sm text-gray-900 truncate ${mono ? "font-mono text-xs" : ""}`} data-testid={`text-${label.toLowerCase().replace(/\s/g, "-")}`}>{value || "—"}</span>
    </div>
  );
}

export default function GithubManagement() {
  const [pushLoading, setPushLoading] = useState(false);
  const [pullLoading, setPullLoading] = useState(false);
  const [commitMessage, setCommitMessage] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [largestLimit, setLargestLimit] = useState<5 | 10 | 20>(10);
  const [largestFiles, setLargestFiles] = useState<{ lines: number; file: string }[] | null>(null);
  const [largestLoading, setLargestLoading] = useState(false);
  const [newToken, setNewToken] = useState("");
  const [tokenLoading, setTokenLoading] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showCurrentToken, setShowCurrentToken] = useState(false);

  interface TokenInfo { hasToken: boolean; masked?: string; full?: string; expiresAt?: string | null; }

  const { data: localInfo, isLoading: localLoading, refetch: refetchLocal, isFetching: localFetching, error: localError } = useQuery<LocalInfo>({
    queryKey: ["/api/platform/github/local-info"],
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const { data: remoteInfo, isLoading: remoteLoading, refetch: refetchRemote, isFetching: remoteFetching, error: remoteError } = useQuery<RemoteInfo>({
    queryKey: ["/api/platform/github/remote-info"],
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const { data: tokenInfo, refetch: refetchTokenInfo } = useQuery<TokenInfo>({
    queryKey: ["/api/platform/github/token-info"],
    refetchOnWindowFocus: false,
    retry: 1,
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
      refetchLocal();
      refetchRemote();
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

  const fetchLargestFiles = async (limit: number) => {
    setLargestLoading(true);
    try {
      const r = await fetch(`/api/platform/github/largest-files?limit=${limit}`, { credentials: "include" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message);
      setLargestFiles(data.files);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLargestLoading(false);
    }
  };

  const refetchAll = () => { refetchLocal(); refetchRemote(); };

  const handleUpdateToken = async () => {
    if (!newToken.trim()) return;
    setTokenLoading(true);
    setError("");
    setSuccess("");
    try {
      const r = await fetch("/api/platform/github/token", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token: newToken.trim() }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message);
      setNewToken("");
      setShowToken(false);
      if (data.reachable) {
        setSuccess("อัปเดต Token สำเร็จ — เชื่อมต่อ GitHub ได้ปกติ");
      } else {
        setSuccess("อัปเดต Token แล้ว แต่ยังเชื่อมต่อ GitHub ไม่ได้ — กรุณาตรวจสอบ Token");
      }
      refetchRemote();
      refetchTokenInfo();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setTokenLoading(false);
    }
  };

  return (
    <PlatformLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" data-testid="text-github-title">Github Push & Pull</h1>
          <p className="text-gray-500 mt-1">จัดการ source code ระหว่าง Replit กับ GitHub</p>
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

        <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Server className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Replit Source Code</h2>
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">Local</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetchLocal()}
                disabled={localFetching}
                className="h-7 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                data-testid="button-refresh-local"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${localFetching ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          {localLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
              <span className="ml-2 text-sm text-gray-500">Loading local info...</span>
            </div>
          ) : localError ? (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm text-red-700 font-medium">Failed to load local info</p>
                <p className="text-xs text-red-600 mt-1">{(localError as any)?.message || "Unknown error"}</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => refetchLocal()}>Retry</Button>
              </div>
            </div>
          ) : localInfo ? (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card className="lg:col-span-2 shadow-sm">
                  <CardContent className="p-4">
                    <InfoRow icon={GitBranch} label="Branch" value={localInfo.branch} mono />
                    <InfoRow icon={GitCommit} label="Commit" value={localInfo.commit} mono />
                    <InfoRow icon={Clock} label="Last Changed" value={formatDate(localInfo.lastCommitDate)} />
                    <InfoRow icon={User} label="Author" value={localInfo.lastCommitAuthor} />
                    <InfoRow icon={Hash} label="Message" value={localInfo.lastCommitMsg} />
                    <InfoRow icon={Tag} label="Version" value={localInfo.version} mono />
                    <InfoRow icon={GitCommit} label="Total Commits" value={localInfo.totalCommits.toLocaleString()} />
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  <Card className="shadow-sm">
                    <CardContent className="p-4">
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Codebase Stats</p>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                            <Code className="h-4 w-4 text-blue-500" />
                          </div>
                          <div>
                            <p className="text-base font-semibold text-gray-900">{localInfo.totalLines.toLocaleString()}</p>
                            <p className="text-[10px] text-gray-500">Lines of Code</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                            <FileCode className="h-4 w-4 text-green-500" />
                          </div>
                          <div>
                            <p className="text-base font-semibold text-gray-900">{localInfo.tsFiles.toLocaleString()}</p>
                            <p className="text-[10px] text-gray-500">TS/TSX Files</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
                            <Files className="h-4 w-4 text-purple-500" />
                          </div>
                          <div>
                            <p className="text-base font-semibold text-gray-900">{localInfo.trackedFiles.toLocaleString()}</p>
                            <p className="text-[10px] text-gray-500">Tracked Files</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-sm border-blue-300 bg-white">
                    <CardContent className="p-4 space-y-3">
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Commit Message</label>
                        <Input
                          value={commitMessage}
                          onChange={(e) => setCommitMessage(e.target.value)}
                          placeholder={`Manual push ${new Date().toISOString().slice(0, 10)}`}
                          className="text-sm"
                          data-testid="input-commit-message"
                        />
                        {commitMessage.length > 0 && commitMessage.length < 30 && (
                          <p className="text-[11px] text-amber-500 mt-1">{30 - commitMessage.length} ตัวอักษรอีก (ขั้นต่ำ 30)</p>
                        )}
                      </div>
                      <Button
                        onClick={handlePush}
                        disabled={pushLoading || !(remoteInfo?.hasRemote) || commitMessage.trim().length < 30}
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
                </div>
              </div>

              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-orange-500" />
                    Largest Files by Line Count
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3">
                      {([5, 10, 20] as const).map((n) => (
                        <label key={n} className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="largestLimit"
                            checked={largestLimit === n}
                            onChange={() => setLargestLimit(n)}
                            className="accent-orange-500"
                            data-testid={`radio-top-${n}`}
                          />
                          <span className="text-sm text-gray-600">Top {n}</span>
                        </label>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchLargestFiles(largestLimit)}
                      disabled={largestLoading}
                      data-testid="button-scan-largest"
                    >
                      {largestLoading ? (
                        <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Scanning...</>
                      ) : (
                        <><BarChart3 className="h-3.5 w-3.5 mr-1.5" />Scan</>
                      )}
                    </Button>
                  </div>

                  {largestFiles && (
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 text-left">
                            <th className="px-3 py-2 text-xs font-medium text-gray-500 w-8">#</th>
                            <th className="px-3 py-2 text-xs font-medium text-gray-500">File</th>
                            <th className="px-3 py-2 text-xs font-medium text-gray-500 text-right w-24">Lines</th>
                            <th className="px-3 py-2 text-xs font-medium text-gray-500 w-32"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {largestFiles.map((f, i) => {
                            const maxLines = largestFiles[0]?.lines || 1;
                            const pct = Math.round((f.lines / maxLines) * 100);
                            return (
                              <tr key={f.file} className="border-t border-gray-100 hover:bg-gray-50/50">
                                <td className="px-3 py-1.5 text-xs text-gray-400">{i + 1}</td>
                                <td className="px-3 py-1.5 font-mono text-xs text-gray-800 truncate max-w-[400px]" title={f.file}>{f.file}</td>
                                <td className="px-3 py-1.5 text-right font-mono text-xs font-semibold text-gray-900">{f.lines.toLocaleString()}</td>
                                <td className="px-3 py-1.5">
                                  <div className="w-full bg-gray-100 rounded-full h-2">
                                    <div className="h-2 rounded-full bg-orange-400" style={{ width: `${pct}%` }} />
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>

        <div className="rounded-xl border border-gray-200 bg-gray-50/30 p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Globe className="h-5 w-5 text-gray-700" />
            <h2 className="text-lg font-semibold text-gray-900">GitHub Source Code</h2>
            <div className="flex items-center gap-2 ml-auto">
              {remoteInfo?.hasRemote && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${remoteInfo.reachable ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                  {remoteInfo.reachable ? "Connected" : "Unreachable"}
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetchRemote()}
                disabled={remoteFetching}
                className="h-7 px-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                data-testid="button-refresh-remote"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${remoteFetching ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          {remoteLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              <span className="ml-2 text-sm text-gray-500">Loading GitHub info...</span>
            </div>
          ) : remoteError ? (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm text-red-700 font-medium">Failed to load GitHub info</p>
                <p className="text-xs text-red-600 mt-1">{(remoteError as any)?.message || "Unknown error"}</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => refetchRemote()}>Retry</Button>
              </div>
            </div>
          ) : remoteInfo && !remoteInfo.hasRemote ? (
            <div className="text-center py-10 text-gray-400">
              <Globe className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No GitHub remote configured</p>
              <p className="text-xs mt-1">Add a remote named "github" to enable push/pull</p>
            </div>
          ) : remoteInfo ? (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              <Card className="lg:col-span-2 shadow-sm">
                <CardContent className="p-4">
                  <InfoRow icon={Globe} label="Remote URL" value={remoteInfo.remoteUrl} mono />
                  <InfoRow icon={GitBranch} label="Branch" value={remoteInfo.branch || "—"} mono />
                  <InfoRow icon={GitCommit} label="Commit" value={remoteInfo.commit || "—"} mono />
                  <InfoRow icon={Clock} label="Last Changed" value={formatDate(remoteInfo.commitDate)} />
                  <InfoRow icon={Hash} label="Message" value={remoteInfo.commitMsg || "—"} />

                  {remoteInfo.reachable && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Sync Status</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className={`flex items-center gap-2 p-2 rounded-lg ${remoteInfo.aheadCount > 0 ? "bg-blue-50" : "bg-gray-50"}`}>
                          <ArrowUpCircle className={`h-5 w-5 ${remoteInfo.aheadCount > 0 ? "text-blue-500" : "text-gray-300"}`} />
                          <div>
                            <p className="text-lg font-semibold text-gray-900">{remoteInfo.aheadCount}</p>
                            <p className="text-[10px] text-gray-500">Ahead (local new)</p>
                          </div>
                        </div>
                        <div className={`flex items-center gap-2 p-2 rounded-lg ${remoteInfo.behindCount > 0 ? "bg-amber-50" : "bg-gray-50"}`}>
                          <ArrowDownCircle className={`h-5 w-5 ${remoteInfo.behindCount > 0 ? "text-amber-500" : "text-gray-300"}`} />
                          <div>
                            <p className="text-lg font-semibold text-gray-900">{remoteInfo.behindCount}</p>
                            <p className="text-[10px] text-gray-500">Behind (github new)</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="lg:col-span-3 space-y-4">
                <Card className="shadow-sm border-green-300 bg-white">
                  <CardContent className="p-4 space-y-3">
                    <p className="text-sm text-gray-500">
                      ดาวน์โหลด source code ล่าสุดจาก GitHub เป็นไฟล์ ZIP
                    </p>
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-[11px] text-amber-700">ไฟล์จะถูกดาวน์โหลดเป็น ZIP — ไม่ได้ merge เข้า local โดยตรง เหมาะสำหรับนำไปใช้กับ etaxerp</p>
                    </div>
                    <Button
                      onClick={handlePull}
                      disabled={pullLoading || !remoteInfo.hasRemote}
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

                <Card className="shadow-sm border-gray-200 bg-white">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Key className="h-4 w-4 text-gray-500" />
                      <p className="text-sm font-medium text-gray-700">Personal Access Token</p>
                    </div>

                    {tokenInfo?.hasToken && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 shrink-0">Current:</span>
                          <code className="text-xs font-mono text-gray-600 bg-gray-100 px-2 py-1 rounded flex-1 break-all" data-testid="text-current-token">
                            {showCurrentToken ? tokenInfo.full : tokenInfo.masked}
                          </code>
                          <button
                            type="button"
                            onClick={() => setShowCurrentToken(!showCurrentToken)}
                            className="text-gray-400 hover:text-gray-600 shrink-0"
                            data-testid="button-toggle-current-token"
                          >
                            {showCurrentToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                        {tokenInfo.expiresAt ? (
                          <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded ${
                            new Date(tokenInfo.expiresAt) < new Date() ? "bg-red-50 text-red-600" :
                            new Date(tokenInfo.expiresAt) < new Date(Date.now() + 7 * 86400000) ? "bg-amber-50 text-amber-600" :
                            "bg-green-50 text-green-600"
                          }`} data-testid="text-token-expiry">
                            <Clock className="h-3 w-3" />
                            {new Date(tokenInfo.expiresAt) < new Date()
                              ? `หมดอายุแล้ว (${tokenInfo.expiresAt})`
                              : `หมดอายุ ${tokenInfo.expiresAt}`}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs text-gray-400 px-2 py-1 bg-gray-50 rounded" data-testid="text-token-no-expiry">
                            <Clock className="h-3 w-3" />
                            ไม่มีวันหมดอายุ (หรือไม่สามารถตรวจสอบได้)
                          </div>
                        )}
                      </div>
                    )}

                    <div className="pt-1 border-t border-gray-100">
                      <p className="text-xs text-gray-400 mb-2">ใส่ Token ใหม่เพื่ออัปเดต</p>
                      <div className="relative">
                        <Input
                          type={showToken ? "text" : "password"}
                          placeholder="ghp_xxxxxxxxxxxx..."
                          value={newToken}
                          onChange={(e) => setNewToken(e.target.value)}
                          className={`pr-10 font-mono text-xs ${newToken.trim() && !(/^(ghp_[A-Za-z0-9_]{36,}|github_pat_[A-Za-z0-9_]{22,})$/.test(newToken.trim())) ? "border-amber-400 focus-visible:ring-amber-400" : ""}`}
                          data-testid="input-github-token"
                        />
                        <button
                          type="button"
                          onClick={() => setShowToken(!showToken)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          data-testid="button-toggle-token-visibility"
                        >
                          {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {newToken.trim() && (
                        /^ghp_[A-Za-z0-9_]{36,}$/.test(newToken.trim()) ? (
                          <p className="text-[11px] text-green-600 mt-1 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Classic token (ghp_) — รูปแบบถูกต้อง
                          </p>
                        ) : /^github_pat_[A-Za-z0-9_]{22,}$/.test(newToken.trim()) ? (
                          <p className="text-[11px] text-green-600 mt-1 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Fine-grained token (github_pat_) — รูปแบบถูกต้อง
                          </p>
                        ) : (
                          <p className="text-[11px] text-amber-500 mt-1 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" /> รูปแบบไม่ตรง — ควรขึ้นต้นด้วย ghp_ หรือ github_pat_
                          </p>
                        )
                      )}
                    </div>
                    <Button
                      onClick={handleUpdateToken}
                      disabled={tokenLoading || !newToken.trim() || newToken.trim().length < 10}
                      variant="outline"
                      className="w-full border-gray-300"
                      data-testid="button-update-token"
                    >
                      {tokenLoading ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Verifying...</>
                      ) : (
                        <><Key className="h-4 w-4 mr-2" />Update Token</>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </PlatformLayout>
  );
}
