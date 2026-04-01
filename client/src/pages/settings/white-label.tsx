import { useState, useEffect, useRef } from "react";
import { objectPathToUrl } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/layout";
import SettingsTabs from "@/components/settings-tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import {
  Palette, Globe, Upload, Save, Loader2, CheckCircle2, XCircle,
  Image, Type, Mail, Phone, Eye, RefreshCw, Lock, ArrowUpCircle, ShoppingCart, Check,
} from "lucide-react";

interface WhiteLabelSettings {
  id: number;
  tenantId: number;
  subdomain: string | null;
  brandName: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  loginBgColor: string;
  sidebarColor: string;
  footerText: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  active: boolean;
}

const defaultColors = {
  primaryColor: "#fb9678",
  secondaryColor: "#03c9d7",
  accentColor: "#fec90f",
  loginBgColor: "#fff5f0",
  sidebarColor: "#ffffff",
};

export default function WhiteLabelPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  const { data: subInfo } = useQuery<any>({
    queryKey: ["/api/my-subscription-info"],
    staleTime: 60_000,
  });

  const plan = subInfo?.plan;
  const isSuperAdmin = user?.role === "super_admin";
  const hasAccess = isSuperAdmin || !plan || plan.hasWhiteLabel;

  const [form, setForm] = useState({
    subdomain: "",
    brandName: "",
    logoUrl: "",
    faviconUrl: "",
    primaryColor: defaultColors.primaryColor,
    secondaryColor: defaultColors.secondaryColor,
    accentColor: defaultColors.accentColor,
    loginBgColor: defaultColors.loginBgColor,
    sidebarColor: defaultColors.sidebarColor,
    footerText: "",
    supportEmail: "",
    supportPhone: "",
    active: false,
  });

  const [subdomainStatus, setSubdomainStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);

  const { data: settings, isLoading } = useQuery<WhiteLabelSettings | null>({
    queryKey: ["/api/white-label/settings"],
  });

  useEffect(() => {
    if (settings) {
      setForm({
        subdomain: settings.subdomain || "",
        brandName: settings.brandName || "",
        logoUrl: settings.logoUrl || "",
        faviconUrl: settings.faviconUrl || "",
        primaryColor: settings.primaryColor || defaultColors.primaryColor,
        secondaryColor: settings.secondaryColor || defaultColors.secondaryColor,
        accentColor: settings.accentColor || defaultColors.accentColor,
        loginBgColor: settings.loginBgColor || defaultColors.loginBgColor,
        sidebarColor: settings.sidebarColor || defaultColors.sidebarColor,
        footerText: settings.footerText || "",
        supportEmail: settings.supportEmail || "",
        supportPhone: settings.supportPhone || "",
        active: settings.active || false,
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const r = await fetch("/api/white-label/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.message || "บันทึกล้มเหลว");
      }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/white-label/settings"] });
      toast({ title: "บันทึกสำเร็จ", description: "ตั้งค่า White Label ถูกบันทึกแล้ว" });
    },
    onError: (err: Error) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  const checkSubdomain = async (subdomain: string) => {
    if (!subdomain || subdomain.length < 3) {
      setSubdomainStatus("idle");
      return;
    }
    setSubdomainStatus("checking");
    try {
      const r = await fetch(`/api/white-label/check-subdomain?subdomain=${encodeURIComponent(subdomain)}`, { credentials: "include" });
      const data = await r.json();
      setSubdomainStatus(data.available ? "available" : "taken");
    } catch {
      setSubdomainStatus("idle");
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => checkSubdomain(form.subdomain), 500);
    return () => clearTimeout(timer);
  }, [form.subdomain]);

  const handleUpload = async (file: File, type: "logo" | "favicon") => {
    if (type === "logo") setUploadingLogo(true);
    else setUploadingFavicon(true);

    try {
      const formData = new FormData();
      formData.append("logo", file);
      const r = await fetch("/api/white-label/upload-logo", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!r.ok) throw new Error("อัปโหลดล้มเหลว");
      const data = await r.json();
      if (type === "logo") {
        setForm((prev) => ({ ...prev, logoUrl: data.url }));
      } else {
        setForm((prev) => ({ ...prev, faviconUrl: data.url }));
      }
      toast({ title: "อัปโหลดสำเร็จ" });
    } catch (err: any) {
      toast({ title: "อัปโหลดล้มเหลว", description: err.message, variant: "destructive" });
    } finally {
      setUploadingLogo(false);
      setUploadingFavicon(false);
    }
  };

  const resetColors = () => {
    setForm((prev) => ({ ...prev, ...defaultColors }));
  };

  if (isLoading) {
    return (
      <Layout>
        <SettingsTabs />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </Layout>
    );
  }

  const { data: availableAddons } = useQuery<any[]>({
    queryKey: ["/api/subscription-addons"],
    enabled: !hasAccess,
  });

  const whiteLabelAddon = availableAddons?.find((a: any) => a.code === "white-label");

  const subscribeMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/my-addons/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ addonId: whiteLabelAddon?.id, billingCycle: "monthly" }),
      });
      if (!r.ok) { const err = await r.json(); throw new Error(err.message); }
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "สมัครโมดูล White Label สำเร็จ", description: "กำลังโหลดหน้าตั้งค่า..." });
      queryClient.invalidateQueries({ queryKey: ["/api/my-subscription-info"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-addons"] });
    },
    onError: (err: Error) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  if (!hasAccess) {
    return (
      <Layout>
        <SettingsTabs />
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
            <Lock className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <h2 className="text-xl font-bold mb-2">White Label</h2>
          <p className="text-sm text-muted-foreground max-w-md mb-4">
            ปรับแต่งระบบให้เป็นแบรนด์ของคุณเอง — โลโก้ สีธีม โดเมน
          </p>

          {whiteLabelAddon && (
            <Card className="max-w-sm mx-auto mt-2 mb-4 border-[#fb9678]/30">
              <CardContent className="pt-5 pb-4 text-center space-y-3">
                <div className="flex items-center justify-center gap-2">
                  <Palette className="h-5 w-5" style={{ color: "#fb9678" }} />
                  <span className="font-semibold">{whiteLabelAddon.name}</span>
                  <Badge variant="outline" className="border-[#fb9678]/50 text-[#fb9678] text-xs">โมดูลเสริม</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{whiteLabelAddon.description}</p>
                <div className="text-lg font-bold" style={{ color: "#fb9678" }}>
                  ฿{Number(whiteLabelAddon.monthlyPrice).toLocaleString()}<span className="text-xs font-normal text-muted-foreground">/เดือน</span>
                </div>
                <ul className="text-xs text-left space-y-1 text-muted-foreground mx-auto max-w-[200px]">
                  <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-green-500 shrink-0" /> โลโก้และ Favicon</li>
                  <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-green-500 shrink-0" /> ธีมสีแบรนด์</li>
                  <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-green-500 shrink-0" /> Subdomain ของคุณ</li>
                  <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-green-500 shrink-0" /> ซ่อนแบรนด์ E-Tax Center</li>
                </ul>
                <Button
                  className="w-full text-white mt-2"
                  style={{ backgroundColor: "#fb9678" }}
                  onClick={() => subscribeMutation.mutate()}
                  disabled={subscribeMutation.isPending}
                  data-testid="button-buy-addon-white-label"
                >
                  {subscribeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShoppingCart className="h-4 w-4 mr-2" />}
                  ซื้อโมดูลเสริม
                </Button>
              </CardContent>
            </Card>
          )}

          {!whiteLabelAddon && (
            <Button
              className="text-white"
              style={{ backgroundColor: "#fb9678" }}
              onClick={() => navigate("/choose-plan")}
              data-testid="button-upgrade-white-label"
            >
              <ArrowUpCircle className="h-4 w-4 mr-2" />
              อัปเกรดแพ็คเกจ
            </Button>
          )}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <SettingsTabs />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Palette className="h-6 w-6" style={{ color: "#fb9678" }} />
              ตั้งค่า White Label
            </h1>
            <p className="text-sm text-gray-500 mt-1">ปรับแต่งระบบให้เป็นแบรนด์ของคุณเอง</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="wl-active" className="text-sm font-medium">เปิดใช้งาน White Label</Label>
              <Switch
                id="wl-active"
                checked={form.active}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, active: checked }))}
                data-testid="switch-white-label-active"
              />
            </div>
            <Button
              onClick={() => saveMutation.mutate(form)}
              disabled={saveMutation.isPending}
              className="text-white"
              style={{ backgroundColor: "#fb9678" }}
              data-testid="button-save-white-label"
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              บันทึก
            </Button>
          </div>
        </div>

        {form.active && (
          <Badge className="bg-green-100 text-green-700 border-green-200">
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            White Label เปิดใช้งานอยู่
          </Badge>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="h-5 w-5" style={{ color: "#03c9d7" }} />
                Subdomain & แบรนด์
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Subdomain</Label>
                <div className="flex items-center gap-2 mt-1">
                  <div className="relative flex-1">
                    <Input
                      value={form.subdomain}
                      onChange={(e) => setForm((prev) => ({ ...prev, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))}
                      placeholder="ชื่อบริษัทของคุณ"
                      className="pr-10"
                      data-testid="input-subdomain"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {subdomainStatus === "checking" && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
                      {subdomainStatus === "available" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                      {subdomainStatus === "taken" && <XCircle className="h-4 w-4 text-red-500" />}
                    </div>
                  </div>
                  <span className="text-sm text-gray-500 whitespace-nowrap">.etaxcenter.com</span>
                </div>
                {subdomainStatus === "available" && (
                  <p className="text-xs text-green-600 mt-1">Subdomain นี้ใช้ได้</p>
                )}
                {subdomainStatus === "taken" && (
                  <p className="text-xs text-red-600 mt-1">Subdomain นี้ถูกใช้แล้ว</p>
                )}
                <p className="text-xs text-gray-400 mt-1">ตัวอักษรภาษาอังกฤษพิมพ์เล็ก ตัวเลข และขีด (-) เท่านั้น</p>
              </div>

              <div>
                <Label className="text-sm font-medium">ชื่อแบรนด์</Label>
                <Input
                  value={form.brandName}
                  onChange={(e) => setForm((prev) => ({ ...prev, brandName: e.target.value }))}
                  placeholder="เช่น สำนักงานบัญชี ABC"
                  className="mt-1"
                  data-testid="input-brand-name"
                />
                <p className="text-xs text-gray-400 mt-1">แสดงบนหน้า Login และ Sidebar แทน E-Tax Center</p>
              </div>

              <div>
                <Label className="text-sm font-medium">ข้อความท้ายหน้า (Footer)</Label>
                <Input
                  value={form.footerText}
                  onChange={(e) => setForm((prev) => ({ ...prev, footerText: e.target.value }))}
                  placeholder="เช่น © 2025 สำนักงานบัญชี ABC"
                  className="mt-1"
                  data-testid="input-footer-text"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" /> อีเมลฝ่ายสนับสนุน
                  </Label>
                  <Input
                    value={form.supportEmail}
                    onChange={(e) => setForm((prev) => ({ ...prev, supportEmail: e.target.value }))}
                    placeholder="support@example.com"
                    className="mt-1"
                    data-testid="input-support-email"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" /> โทรศัพท์ฝ่ายสนับสนุน
                  </Label>
                  <Input
                    value={form.supportPhone}
                    onChange={(e) => setForm((prev) => ({ ...prev, supportPhone: e.target.value }))}
                    placeholder="02-xxx-xxxx"
                    className="mt-1"
                    data-testid="input-support-phone"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Image className="h-5 w-5" style={{ color: "#03c9d7" }} />
                โลโก้ & Favicon
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium">โลโก้บริษัท</Label>
                <p className="text-xs text-gray-400 mb-2">แนะนำขนาด 200x60 px, รูปแบบ PNG/SVG พื้นหลังโปร่งใส</p>
                <div className="flex items-center gap-3">
                  <div className="w-48 h-16 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center bg-gray-50 overflow-hidden">
                    {form.logoUrl ? (
                      <img src={objectPathToUrl(form.logoUrl)} alt="Logo" className="max-h-14 max-w-44 object-contain" />
                    ) : (
                      <span className="text-xs text-gray-400">ไม่มีโลโก้</span>
                    )}
                  </div>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], "logo")}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={uploadingLogo}
                    data-testid="button-upload-logo"
                  >
                    {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                    อัปโหลดโลโก้
                  </Button>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Favicon</Label>
                <p className="text-xs text-gray-400 mb-2">ไอคอนเล็กบนแท็บเบราว์เซอร์ แนะนำ 32x32 px</p>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center bg-gray-50 overflow-hidden">
                    {form.faviconUrl ? (
                      <img src={form.faviconUrl} alt="Favicon" className="max-h-12 max-w-12 object-contain" />
                    ) : (
                      <span className="text-xs text-gray-400">ไม่มี</span>
                    )}
                  </div>
                  <input
                    ref={faviconInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], "favicon")}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => faviconInputRef.current?.click()}
                    disabled={uploadingFavicon}
                    data-testid="button-upload-favicon"
                  >
                    {uploadingFavicon ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                    อัปโหลด Favicon
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Palette className="h-5 w-5" style={{ color: "#fec90f" }} />
                สีธีม
              </span>
              <Button variant="ghost" size="sm" onClick={resetColors} className="text-gray-500 hover:text-gray-700">
                <RefreshCw className="h-4 w-4 mr-1" /> รีเซ็ตเป็นค่าเริ่มต้น
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
              {[
                { key: "primaryColor", label: "สีหลัก (Primary)", desc: "ปุ่ม, Sidebar, ลิงก์" },
                { key: "secondaryColor", label: "สีรอง (Secondary)", desc: "ไอคอน, Badge" },
                { key: "accentColor", label: "สีเน้น (Accent)", desc: "แจ้งเตือน, เน้นข้อมูล" },
                { key: "loginBgColor", label: "พื้นหลัง Login", desc: "หน้า Login" },
                { key: "sidebarColor", label: "พื้นหลัง Sidebar", desc: "แถบเมนูด้านข้าง" },
              ].map((colorItem) => (
                <div key={colorItem.key} className="text-center">
                  <Label className="text-sm font-medium block mb-2">{colorItem.label}</Label>
                  <div className="flex flex-col items-center gap-2">
                    <div
                      className="w-16 h-16 rounded-xl border-2 border-gray-200 shadow-sm cursor-pointer relative overflow-hidden"
                      style={{ backgroundColor: (form as any)[colorItem.key] }}
                    >
                      <input
                        type="color"
                        value={(form as any)[colorItem.key]}
                        onChange={(e) => setForm((prev) => ({ ...prev, [colorItem.key]: e.target.value }))}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        data-testid={`input-color-${colorItem.key}`}
                      />
                    </div>
                    <Input
                      value={(form as any)[colorItem.key]}
                      onChange={(e) => setForm((prev) => ({ ...prev, [colorItem.key]: e.target.value }))}
                      className="text-center text-xs w-24 h-7"
                      data-testid={`input-hex-${colorItem.key}`}
                    />
                    <p className="text-xs text-gray-400">{colorItem.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="h-5 w-5" style={{ color: "#05b187" }} />
              ตัวอย่างหน้า Login
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="rounded-xl border overflow-hidden"
              style={{ backgroundColor: form.loginBgColor, minHeight: 280 }}
            >
              <div className="flex items-center justify-center py-10">
                <div className="bg-white rounded-2xl shadow-lg p-8 w-80">
                  <div className="text-center mb-6">
                    {form.logoUrl ? (
                      <img src={objectPathToUrl(form.logoUrl)} alt="Logo" className="h-12 mx-auto mb-3 object-contain" />
                    ) : (
                      <div className="h-12 flex items-center justify-center mb-3">
                        <Type className="h-8 w-8" style={{ color: form.primaryColor }} />
                      </div>
                    )}
                    <h2 className="text-lg font-bold" style={{ color: form.primaryColor }}>
                      {form.brandName || "ชื่อแบรนด์ของคุณ"}
                    </h2>
                    <p className="text-xs text-gray-400 mt-1">เข้าสู่ระบบ</p>
                  </div>
                  <div className="space-y-3">
                    <div className="h-9 bg-gray-100 rounded-lg" />
                    <div className="h-9 bg-gray-100 rounded-lg" />
                    <div
                      className="h-9 rounded-lg flex items-center justify-center text-white text-sm font-medium"
                      style={{ backgroundColor: form.primaryColor }}
                    >
                      เข้าสู่ระบบ
                    </div>
                  </div>
                  {form.footerText && (
                    <p className="text-xs text-gray-400 text-center mt-4">{form.footerText}</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-blue-100 bg-blue-50/30">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Globe className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-gray-600">
                <p className="font-medium text-gray-700 mb-1">เมื่อเปิดใช้งาน White Label</p>
                <ul className="list-disc list-inside space-y-1 text-xs text-gray-500">
                  <li>ลูกค้าของคุณจะเข้าระบบผ่าน <strong>{form.subdomain || "ชื่อ"}.etaxcenter.com</strong></li>
                  <li>หน้า Login, Sidebar จะแสดงโลโก้และสีธีมของคุณ</li>
                  <li>ข้อมูลฝ่ายสนับสนุนจะแสดงเป็นของคุณแทน</li>
                  <li>ลูกค้าจะไม่เห็นแบรนด์ E-Tax Center</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
