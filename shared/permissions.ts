export type Role = "super_admin" | "admin" | "manager" | "accountant" | "employee" | "cashier" | "client";

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "เจ้าของแพลตฟอร์ม",
  admin: "ผู้ดูแลระบบ",
  manager: "ผู้จัดการ",
  accountant: "นักบัญชี",
  employee: "พนักงาน",
  cashier: "แคชเชียร์",
  client: "ผู้เยี่ยมชม (Guest)",
};

export interface PermissionModule {
  key: string;
  label: string;
  description: string;
  allowedRoles: Role[];
}

export const PERMISSION_MODULES: PermissionModule[] = [
  { key: "dashboard", label: "แผงควบคุม", description: "ดูภาพรวมระบบและสถิติ", allowedRoles: ["admin", "manager", "accountant"] },
  { key: "accounting", label: "การบัญชี", description: "สมุดบัญชีรายวัน, ผังบัญชี, ตั้งค่าสูตรบัญชี", allowedRoles: ["admin", "manager", "accountant"] },
  { key: "petty-cash", label: "เงินสดย่อย", description: "ดูวงเงิน, เบิก-จ่าย, เติมเงิน เงินสดย่อย", allowedRoles: ["admin", "manager", "accountant", "employee"] },
  { key: "sales", label: "การขาย & รายได้", description: "ใบเสนอราคา, ใบสั่งขาย, ใบแจ้งหนี้, ใบกำกับภาษี", allowedRoles: ["admin", "manager", "accountant"] },
  { key: "purchases", label: "การซื้อ & รายจ่าย", description: "ใบขอซื้อ, ใบสั่งซื้อ, เอกสารซื้อ, รายจ่าย", allowedRoles: ["admin", "manager", "accountant"] },
  { key: "finance", label: "การเงิน", description: "รับเงิน, ชำระเงิน, เช็ค, ภาษีหัก ณ ที่จ่าย", allowedRoles: ["admin", "manager", "accountant"] },
  { key: "contacts", label: "ประวัติคู่ค้า", description: "จัดการรายชื่อคู่ค้า", allowedRoles: ["admin", "manager", "accountant"] },
  { key: "inventory", label: "คลังสินค้า", description: "จัดการสินค้าและสต็อก", allowedRoles: ["admin", "manager", "accountant", "employee"] },
  { key: "assets", label: "ทะเบียนสินทรัพย์", description: "บันทึกสินทรัพย์และค่าเสื่อมราคา", allowedRoles: ["admin", "manager", "accountant"] },
  { key: "reports", label: "รายงาน", description: "ดูรายงานทั่วไปและบัญชีต้นทุน", allowedRoles: ["admin", "manager", "accountant"] },
  { key: "firm-mgmt", label: "บริหารสำนักงาน", description: "จัดการลูกค้า, ค่าบริการ, ติดตามงาน", allowedRoles: ["admin", "manager", "accountant"] },
  { key: "hr", label: "HR & เวลาทำงาน", description: "ลงเวลา, OT, ทะเบียนพนักงาน, เงินเดือน", allowedRoles: ["admin", "manager", "accountant", "employee"] },
  { key: "ecommerce", label: "eCommerce Hub", description: "เชื่อมต่อ Shopee/Lazada/TikTok, จัดการออเดอร์, ซิงค์สต๊อก, ไลฟ์ขายของ", allowedRoles: ["admin", "manager", "accountant", "employee"] },
  { key: "pos", label: "POS ขายหน้าร้าน", description: "ขายหน้าร้าน, เปิด/ปิดกะ, รายงานยอดขาย", allowedRoles: ["admin", "manager", "accountant", "employee", "cashier"] },
  { key: "commerce-intelligence", label: "Commerce Intelligence", description: "วิเคราะห์ธุรกิจ eCommerce: Executive, Channel, Product, Campaign, Live", allowedRoles: ["admin", "manager", "accountant"] },
  { key: "etax-hub", label: "E-Tax Hub", description: "จัดการงานลูกค้า, มอบหมายงาน, แชร์เอกสาร (Monday.com style)", allowedRoles: ["admin", "manager", "accountant"] },
  { key: "gas-station", label: "ปั๊มน้ำมัน", description: "บัญชีปั๊มน้ำมัน, ยอดขายรายวัน, สต็อก, มิเตอร์, Oil Loss/Gain, ภาษีท้องถิ่น", allowedRoles: ["admin", "manager", "accountant"] },
  { key: "job-costing", label: "ต้นทุนงานก่อสร้าง", description: "บัญชีต้นทุนงาน, กำไรขาดทุนแต่ละโปรเจค, ต้นทุนต่อยูนิต", allowedRoles: ["admin", "manager", "accountant"] },
  { key: "settings", label: "ตั้งค่า", description: "กำหนดสิทธิ์ผู้ใช้งาน, ตั้งค่าระบบ", allowedRoles: ["admin"] },
  { key: "client-portal", label: "ดูข้อมูลบริษัท (ลูกค้า)", description: "ดูรายงาน, ใบแจ้งหนี้ของบริษัทตนเอง", allowedRoles: ["client"] },
];

export const NAV_KEY_MAP: Record<string, string> = {
  "/": "dashboard",
  "/accounting": "accounting",
  "/journal": "accounting",
  "/coa": "accounting",
  "/accounting-mgmt": "accounting",
  "/accounting-config": "accounting",
  "/petty-cash": "petty-cash",
  "/sales": "sales",
  "/sales/pipeline": "sales",
  "/sales/quote": "sales",
  "/sales/order": "sales",
  "/sales/invoice": "sales",
  "/sales/tax-invoice": "sales",
  "/sales/receipt": "sales",
  "/sales/tax-report": "sales",
  "/purchases": "purchases",
  "/purchases/pr": "purchases",
  "/purchases/bid": "purchases",
  "/purchases/po": "purchases",
  "/purchases/invoice": "purchases",
  "/purchases/expense": "purchases",
  "/purchases/tax-report": "purchases",
  "/finance": "finance",
  "/finance/loans": "finance",
  "/finance/receipt-billing": "finance",
  "/finance/payments": "finance",
  "/finance/cheques": "finance",
  "/finance/cheque-history": "finance",
  "/finance/wht": "finance",
  "/finance/cash-flow-forecast": "finance",
  "/contacts": "contacts",
  "/contacts/list": "contacts",
  "/contacts/history": "contacts",
  "/contacts/settings": "contacts",
  "/inventory": "inventory",
  "/inventory/list": "inventory",
  "/inventory/warehouse": "inventory",
  "/inventory/sets": "inventory",
  "/inventory/control": "inventory",
  "/inventory/shipping": "inventory",
  "/inventory/receiving": "inventory",
  "/inventory/requisition": "inventory",
  "/inventory/stock-card": "inventory",
  "/inventory/extra": "inventory",
  "/assets": "assets",
  "/assets/registry": "assets",
  "/assets/depreciation": "assets",
  "/assets/sales": "assets",
  "/assets/expired": "assets",
  "/assets/summary": "assets",
  "/assets/history": "assets",
  "/reports": "reports",
  "/reports/general": "reports",
  "/reports/cost": "reports",
  "/firm-mgmt": "firm-mgmt",
  "/firm-mgmt/clients": "firm-mgmt",
  "/firm-mgmt/billing": "firm-mgmt",
  "/firm-mgmt/workflow": "firm-mgmt",
  "/firm-mgmt/pricing": "firm-mgmt",
  "/hr": "hr",
  "/hr/attendance": "hr",
  "/hr/leave": "hr",
  "/hr/ot": "hr",
  "/hr/employees": "hr",
  "/hr/payroll": "hr",
  "/hr/payslip": "hr",
  "/hr/salary-certificate": "hr",
  "/hr/work-certificate": "hr",
  "/hr/holidays": "hr",
  "/hr/payroll-tax": "hr",
  "/hr/pnd1": "hr",
  "/hr/pnd1a": "hr",
  "/hr/tax-attachment": "hr",
  "/hr/fifty-tawi": "hr",
  "/office/chat": "dashboard",
  "/office/meetings": "dashboard",
  "/office/calendar": "dashboard",
  "/gas-station": "gas-station",
  "/gas-station/setup": "gas-station",
  "/gas-station/daily-sales": "gas-station",
  "/gas-station/fuel-stock": "gas-station",
  "/gas-station/oil-loss-gain": "gas-station",
  "/gas-station/local-tax": "gas-station",
  "/gas-station/reports": "gas-station",
  "/ci": "commerce-intelligence",
  "/ci/executive": "commerce-intelligence",
  "/ci/channel": "commerce-intelligence",
  "/ci/product": "commerce-intelligence",
  "/ci/campaign": "commerce-intelligence",
  "/ci/live": "commerce-intelligence",
  "/ci/alerts": "commerce-intelligence",
  "/ecommerce": "ecommerce",
  "/ecommerce/hub": "ecommerce",
  "/ecommerce/connections": "ecommerce",
  "/ecommerce/orders": "ecommerce",
  "/ecommerce/product-sync": "ecommerce",
  "/ecommerce/fees": "ecommerce",
  "/ecommerce/stock-sync": "ecommerce",
  "/ecommerce/live-selling": "ecommerce",
  "/pos": "pos",
  "/pos/terminal": "pos",
  "/pos/sessions": "pos",
  "/etax-hub": "etax-hub",
  "/etax-hub/board": "etax-hub",
  "/job-costing": "job-costing",
  "/job-costing/projects": "job-costing",
  "/settings": "settings",
  "/settings/users": "settings",
  "/settings/general": "settings",
  "/settings/document-templates": "settings",
  "/settings/company-info": "settings",
  "/settings/profile": "settings",
};

export function hasPermission(role: string, moduleKey: string): boolean {
  const mod = PERMISSION_MODULES.find(m => m.key === moduleKey);
  if (!mod) return false;
  return mod.allowedRoles.includes(role as Role);
}

export function canAccessRoute(role: string, path: string): boolean {
  const moduleKey = NAV_KEY_MAP[path];
  if (!moduleKey) return true;
  return hasPermission(role, moduleKey);
}

export const PRIMARY_ONLY_MODULES = ["hr", "firm-mgmt", "settings"];
export const FIRM_ONLY_MODULES = ["firm-mgmt"];

export const CONFIDENTIAL_SUB_MODULES = [
  "hr/payroll",
  "hr/payslip",
  "hr/payroll-tax",
  "hr/certificates",
  "hr/pnd1",
  "hr/pnd1a",
  "hr/tax-attachment",
  "hr/fifty-tawi",
  "hr/salary-certificate",
  "hr/work-certificate",
];

export const HR_PERSONAL_SUB_MODULES = [
  "hr/ess",
  "hr/attendance",
  "hr/attendance-report",
  "hr/leave",
  "hr/ot",
];

export const HR_ADMIN_SUB_MODULES = [
  "hr/employees",
  "hr/payroll",
  "hr/payslip",
  "hr/payroll-tax",
  "hr/certificates",
  "hr/salary-certificate",
  "hr/work-certificate",
  "hr/holidays",
  "hr/work-schedule",
  "hr/performance",
];

export interface SubModule {
  key: string;
  label: string;
  parentModule: string;
  href: string;
}

export const SUB_MODULES: SubModule[] = [
  { key: "dashboard/analytical", label: "Analytical", parentModule: "dashboard", href: "/dashboard/analytical" },
  { key: "dashboard/ecommerce", label: "eCommerce", parentModule: "dashboard", href: "/dashboard/ecommerce" },
  { key: "dashboard/hrm", label: "HRM Dashboard", parentModule: "dashboard", href: "/hr/dashboard" },

  { key: "firm-mgmt/clients", label: "รายชื่อลูกค้าทั้งหมด", parentModule: "firm-mgmt", href: "/firm-mgmt/clients" },
  { key: "firm-mgmt/billing", label: "สรุปค่างวด/ค่าบริการ", parentModule: "firm-mgmt", href: "/firm-mgmt/billing" },

  { key: "firm-mgmt/pricing", label: "ตั้งค่าราคาบริการ", parentModule: "firm-mgmt", href: "/firm-mgmt/pricing" },

  { key: "accounting/journal", label: "สมุดบัญชีรายวัน", parentModule: "accounting", href: "/journal" },
  { key: "accounting/coa", label: "ผังบัญชี", parentModule: "accounting", href: "/coa" },
  { key: "accounting/mgmt", label: "การจัดการบัญชี", parentModule: "accounting", href: "/accounting-mgmt" },
  { key: "accounting/config", label: "ตั้งค่าสูตรบัญชี", parentModule: "accounting", href: "/accounting-config" },
  { key: "accounting/petty-cash", label: "เงินสดย่อย", parentModule: "accounting", href: "/petty-cash" },

  { key: "sales/pipeline", label: "Sales Pipeline", parentModule: "sales", href: "/sales/pipeline" },
  { key: "sales/quote", label: "ใบเสนอราคา [QO]", parentModule: "sales", href: "/sales/quote" },
  { key: "sales/order", label: "ใบสั่งขาย [SO]", parentModule: "sales", href: "/sales/order" },
  { key: "sales/invoice", label: "ใบแจ้งหนี้ [IV]", parentModule: "sales", href: "/sales/invoice" },
  { key: "sales/tax-invoice", label: "ใบกำกับภาษี [TX]", parentModule: "sales", href: "/sales/tax-invoice" },
  { key: "sales/receipt", label: "ใบเสร็จรับเงิน [RC]", parentModule: "sales", href: "/sales/receipt" },
  { key: "sales/tax-report", label: "รายงานภาษีขาย", parentModule: "sales", href: "/sales/tax-report" },

  { key: "purchases/pr", label: "ใบขอซื้อ [PR]", parentModule: "purchases", href: "/purchases/pr" },
  { key: "purchases/bid", label: "เปรียบเทียบราคา [BID]", parentModule: "purchases", href: "/purchases/bid" },
  { key: "purchases/po", label: "ใบสั่งซื้อ [PO]", parentModule: "purchases", href: "/purchases/po" },
  { key: "purchases/invoice", label: "เอกสารซื้อ [AP]", parentModule: "purchases", href: "/purchases/invoice" },
  { key: "purchases/expense", label: "รายจ่ายอื่น (EXP)", parentModule: "purchases", href: "/purchases/expense" },
  { key: "purchases/tax-report", label: "รายงานภาษีซื้อ", parentModule: "purchases", href: "/purchases/tax-report" },

  { key: "finance/loans", label: "ดูผู้กู้", parentModule: "finance", href: "/finance/loans" },
  { key: "finance/receipt-billing", label: "รับเงิน/วางบิล", parentModule: "finance", href: "/finance/receipt-billing" },
  { key: "finance/payments", label: "รายการชำระเงิน", parentModule: "finance", href: "/finance/payments" },
  { key: "finance/cheques", label: "จัดการเช็ครับ/เช็คเงินโอน", parentModule: "finance", href: "/finance/cheques" },
  { key: "finance/cheque-history", label: "ประวัติเช็ค", parentModule: "finance", href: "/finance/cheque-history" },
  { key: "finance/wht", label: "ภาษีหัก ณ ที่จ่าย", parentModule: "finance", href: "/finance/wht" },
  { key: "finance/cash-flow-forecast", label: "พยากรณ์เงินสด+ทุนหมุนเวียน", parentModule: "finance", href: "/finance/cash-flow-forecast" },

  { key: "contacts/list", label: "รายชื่อคู่ค้า", parentModule: "contacts", href: "/contacts/list" },
  { key: "contacts/history", label: "ประวัติการดูคู่ค้า", parentModule: "contacts", href: "/contacts/history" },
  { key: "contacts/settings", label: "ตั้งค่าประวัติ", parentModule: "contacts", href: "/contacts/settings" },

  { key: "inventory/list", label: "สรุปรายการสินค้า", parentModule: "inventory", href: "/inventory/list" },
  { key: "inventory/warehouse", label: "คลังสินค้า", parentModule: "inventory", href: "/inventory/warehouse" },
  { key: "inventory/sets", label: "เซตสินค้า", parentModule: "inventory", href: "/inventory/sets" },
  { key: "inventory/control", label: "ควบคุมสินค้า", parentModule: "inventory", href: "/inventory/control" },
  { key: "inventory/shipping", label: "ส่งสินค้าจาก SO", parentModule: "inventory", href: "/inventory/shipping" },
  { key: "inventory/receiving", label: "รับสินค้าจาก PO", parentModule: "inventory", href: "/inventory/receiving" },
  { key: "inventory/extra", label: "ฟังก์ชันเพิ่มเติม", parentModule: "inventory", href: "/inventory/extra" },

  { key: "assets/registry", label: "ทะเบียนสินทรัพย์", parentModule: "assets", href: "/assets/registry" },
  { key: "assets/depreciation", label: "รายงานค่าเสื่อมราคา", parentModule: "assets", href: "/assets/depreciation" },
  { key: "assets/sales", label: "รายงานการขายทรัพย์สิน", parentModule: "assets", href: "/assets/sales" },
  { key: "assets/expired", label: "รายงานทรัพย์สินหมดอายุ", parentModule: "assets", href: "/assets/expired" },
  { key: "assets/summary", label: "สรุปรายการ", parentModule: "assets", href: "/assets/summary" },
  { key: "assets/history", label: "ประวัติการลงบัญชี", parentModule: "assets", href: "/assets/history" },

  { key: "reports/general", label: "รายงานทั่วไป", parentModule: "reports", href: "/reports/general" },
  { key: "reports/cost", label: "บัญชีต้นทุน", parentModule: "reports", href: "/reports/cost" },

  { key: "hr/ess", label: "บริการตนเอง (ESS)", parentModule: "hr", href: "/settings/profile" },
  { key: "hr/attendance", label: "ลงเวลาเข้า-ออกงาน", parentModule: "hr", href: "/hr/attendance" },
  { key: "hr/attendance-report", label: "รายงานลงเวลา", parentModule: "hr", href: "/hr/attendance-report" },
  { key: "hr/leave", label: "ขอลา / อนุมัติลา", parentModule: "hr", href: "/hr/leave" },
  { key: "hr/ot", label: "จัดการ OT", parentModule: "hr", href: "/hr/ot" },
  { key: "hr/employees", label: "ทะเบียนพนักงาน", parentModule: "hr", href: "/hr/employees" },
  { key: "hr/payroll", label: "สรุปเงินเดือน", parentModule: "hr", href: "/hr/payroll" },
  { key: "hr/payslip", label: "สลิปเงินเดือน", parentModule: "hr", href: "/hr/payslip" },
  { key: "hr/payroll-tax", label: "จ่ายเงินเดือน / ภาษี", parentModule: "hr", href: "/hr/payroll-tax" },
  { key: "hr/certificates", label: "หนังสือรับรอง", parentModule: "hr", href: "/hr/certificates" },
  { key: "hr/salary-certificate", label: "หนังสือรับรองเงินเดือน", parentModule: "hr", href: "/hr/salary-certificate" },
  { key: "hr/work-certificate", label: "หนังสือรับรองการทำงาน", parentModule: "hr", href: "/hr/work-certificate" },
  { key: "hr/holidays", label: "ปฏิทินวันหยุด", parentModule: "hr", href: "/hr/holidays" },
  { key: "hr/work-schedule", label: "ตั้งค่าเวลาทำงาน", parentModule: "hr", href: "/hr/work-schedule" },
  { key: "hr/performance", label: "AI ประเมินผลงาน", parentModule: "hr", href: "/hr/performance" },
  { key: "hr/commission-rules", label: "กฎคอมมิชชั่น", parentModule: "hr", href: "/hr/commission-rules" },
  { key: "hr/commission", label: "คำนวณค่าคอมมิชชั่น", parentModule: "hr", href: "/hr/commission" },

  { key: "commerce-intelligence/executive", label: "Executive Dashboard", parentModule: "commerce-intelligence", href: "/ci/executive" },
  { key: "commerce-intelligence/channel", label: "Channel Dashboard", parentModule: "commerce-intelligence", href: "/ci/channel" },
  { key: "commerce-intelligence/product", label: "Product & Profit", parentModule: "commerce-intelligence", href: "/ci/product" },
  { key: "commerce-intelligence/campaign", label: "Campaign Dashboard", parentModule: "commerce-intelligence", href: "/ci/campaign" },
  { key: "commerce-intelligence/live", label: "Live Commerce", parentModule: "commerce-intelligence", href: "/ci/live" },
  { key: "commerce-intelligence/alerts", label: "แจ้งเตือนอัจฉริยะ", parentModule: "commerce-intelligence", href: "/ci/alerts" },

  { key: "ecommerce/connections", label: "เชื่อมต่อแพลตฟอร์ม", parentModule: "ecommerce", href: "/ecommerce/connections" },
  { key: "ecommerce/orders", label: "คำสั่งซื้อรวม", parentModule: "ecommerce", href: "/ecommerce/orders" },
  { key: "ecommerce/product-sync", label: "เชื่อมโยงสินค้า", parentModule: "ecommerce", href: "/ecommerce/product-sync" },
  { key: "ecommerce/fees", label: "ค่าธรรมเนียม", parentModule: "ecommerce", href: "/ecommerce/fees" },
  { key: "ecommerce/stock-sync", label: "ซิงค์สต๊อก", parentModule: "ecommerce", href: "/ecommerce/stock-sync" },

  { key: "ecommerce/live-selling", label: "ไลฟ์ขายของ", parentModule: "ecommerce", href: "/ecommerce/live-selling" },

  { key: "settings/users", label: "กำหนดสิทธิ์ผู้ใช้งาน", parentModule: "settings", href: "/settings/users" },
  { key: "settings/profile", label: "โปรไฟล์ / ลายเซ็น", parentModule: "settings", href: "/settings/profile" },
  { key: "settings/company-info", label: "ข้อมูลบริษัท", parentModule: "settings", href: "/settings/company-info" },
  { key: "settings/document-templates", label: "ตั้งค่าเอกสาร", parentModule: "settings", href: "/settings/document-templates" },
  { key: "settings/general", label: "ตั้งค่าทั่วไป", parentModule: "settings", href: "/settings/general" },
];

export function getSubModulesForModule(moduleKey: string): SubModule[] {
  return SUB_MODULES.filter(s => s.parentModule === moduleKey);
}

export function getSubModuleByHref(href: string): SubModule | undefined {
  return SUB_MODULES.find(s => s.href === href);
}

export function getNavModuleKey(href: string): string | undefined {
  if (href === "/") return "dashboard";
  const prefix = href.split("/").filter(Boolean)[0];
  return prefix || undefined;
}
