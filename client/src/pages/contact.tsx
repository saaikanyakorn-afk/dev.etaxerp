import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Mail, Phone, MapPin, Clock, MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

export default function Contact() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "", message: "" });
  const [sending, setSending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) {
      toast({ title: "กรุณากรอกข้อมูลให้ครบ", description: "ชื่อ, อีเมล และข้อความ จำเป็นต้องกรอก", variant: "destructive" });
      return;
    }
    setSending(true);
    setTimeout(() => {
      toast({ title: "ส่งข้อความสำเร็จ", description: "ทีมงานจะติดต่อกลับโดยเร็วที่สุด" });
      setForm({ name: "", email: "", phone: "", subject: "", message: "" });
      setSending(false);
    }, 1000);
  }

  return (
    <div className="min-h-screen bg-gray-50 force-light-mode">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => setLocation("/landing")}
            className="flex items-center gap-2 text-gray-600 hover:text-[#fb9678] transition-colors"
            data-testid="btn-back-landing"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">กลับหน้าหลัก</span>
          </button>
          <h1 className="text-xl font-bold text-gray-800">ติดต่อเรา</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white rounded-xl shadow-sm p-8 space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-800" data-testid="text-contact-title">ติดต่อเรา</h2>
              <p className="text-gray-500 mt-1">เรายินดีให้บริการคุณ</p>
            </div>

            <div className="space-y-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-[#fb9678]/10 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-5 h-5 text-[#fb9678]" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800">อีเมล</p>
                  <p className="text-gray-600 text-sm" data-testid="text-email-support">support@etaxcenter.com</p>
                  <p className="text-gray-600 text-sm" data-testid="text-email-sales">info@etaxcenter.com</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-[#05b187]/10 flex items-center justify-center flex-shrink-0">
                  <Phone className="w-5 h-5 text-[#05b187]" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800">โทรศัพท์</p>
                  <p className="text-gray-600 text-sm" data-testid="text-phone-main">063-523-9999</p>
                  <p className="text-gray-600 text-sm" data-testid="text-phone-sales">099-496-5000</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-[#03c9d7]/10 flex items-center justify-center flex-shrink-0">
                  <MessageCircle className="w-5 h-5 text-[#03c9d7]" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800">LINE Official</p>
                  <p className="text-gray-600 text-sm" data-testid="text-line-id">@etaxcenter</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-[#fb9678]/10 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-5 h-5 text-[#fb9678]" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800">เวลาทำการ</p>
                  <p className="text-gray-600 text-sm" data-testid="text-hours-weekday">จันทร์ - ศุกร์: 09:00 - 18:00 น.</p>
                  <p className="text-gray-600 text-sm" data-testid="text-hours-saturday">เสาร์: 09:00 - 12:00 น.</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-[#fec90f]/10 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-5 h-5 text-[#fec90f]" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800">ที่อยู่</p>
                  <p className="text-gray-600 text-sm" data-testid="text-address">54 ซอยคลังมนตรี แขวงจตุจักร เขตจตุจักร กรุงเทพมหานคร 10900</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Send className="w-5 h-5 text-[#fb9678]" />
              ส่งข้อความถึงเรา
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>ชื่อ-นามสกุล *</Label>
                <Input data-testid="input-contact-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="กรอกชื่อของคุณ" />
              </div>
              <div>
                <Label>อีเมล *</Label>
                <Input data-testid="input-contact-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="your@email.com" />
              </div>
              <div>
                <Label>โทรศัพท์</Label>
                <Input data-testid="input-contact-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="08x-xxx-xxxx" />
              </div>
              <div>
                <Label>หัวข้อ</Label>
                <Input data-testid="input-contact-subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="เรื่องที่ต้องการสอบถาม" />
              </div>
              <div>
                <Label>ข้อความ *</Label>
                <Textarea data-testid="input-contact-message" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="รายละเอียด..." rows={4} />
              </div>
              <Button data-testid="btn-send-contact" type="submit" className="w-full bg-[#fb9678] hover:bg-[#e8856a]" disabled={sending}>
                {sending ? "กำลังส่ง..." : "ส่งข้อความ"}
              </Button>
            </form>
          </div>
        </div>
      </main>

      <footer className="bg-gray-800 text-gray-400 text-center py-6 mt-8 text-sm">
        &copy; 2026 E-Tax Center. All rights reserved.
      </footer>
    </div>
  );
}
