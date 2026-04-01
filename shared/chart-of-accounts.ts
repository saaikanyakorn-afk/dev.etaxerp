export interface ChartAccountTemplate {
  code: string;
  name: string;
  nameTh: string;
  nameZh: string;
  type: string;
  parentCode: string | null;
  isHeader?: boolean;
}

function computeHeaders(list: ChartAccountTemplate[]): (ChartAccountTemplate & { isHeader: boolean })[] {
  const parentCodes = new Set(list.map(a => a.parentCode).filter(Boolean));
  return list.map(a => ({ ...a, isHeader: parentCodes.has(a.code) }));
}

export const STANDARD_CHART_OF_ACCOUNTS: ChartAccountTemplate[] = [
  // ═══════════════════════════════════════════════════════════
  // ASSETS (100-199)
  // ═══════════════════════════════════════════════════════════

  // --- Cash & Cash Equivalents ---
  { code: "100", name: "Cash and Cash Equivalents", nameTh: "เงินสดและรายการเทียบเท่าเงินสด", nameZh: "现金及现金等价物", type: "asset", parentCode: null },
  { code: "1001000", name: "Cash", nameTh: "เงินสด", nameZh: "库存现金", type: "asset", parentCode: "100" },
  { code: "1001100", name: "Cash in Transit", nameTh: "เงินสดระหว่างทาง", nameZh: "在途现金", type: "asset", parentCode: "100" },
  { code: "1001200", name: "Petty Cash", nameTh: "เงินสดย่อย", nameZh: "零用金", type: "asset", parentCode: "100" },
  { code: "1001300", name: "E-Wallet", nameTh: "เงินในกระเป๋าเงินอิเล็กทรอนิกส์", nameZh: "电子钱包", type: "asset", parentCode: "100" },

  // --- Savings Accounts (per bank) ---
  { code: "101", name: "Cash at Bank - Savings", nameTh: "เงินฝากออมทรัพย์", nameZh: "储蓄存款", type: "asset", parentCode: "100" },
  { code: "1011000", name: "Savings - BBL", nameTh: "เงินฝากออมทรัพย์ - ธ.กรุงเทพ", nameZh: "储蓄存款 - 盘谷银行", type: "asset", parentCode: "101" },
  { code: "1012000", name: "Savings - KBANK", nameTh: "เงินฝากออมทรัพย์-ธนาคารกสิกรไทย", nameZh: "储蓄存款 - 开泰银行", type: "asset", parentCode: "101" },
  { code: "1013000", name: "Savings - SCB", nameTh: "เงินฝากออมทรัพย์-ธนาคารไทยพาณิชย์", nameZh: "储蓄存款 - 汇商银行", type: "asset", parentCode: "101" },
  { code: "1014000", name: "Savings - KTB", nameTh: "เงินฝากออมทรัพย์-ธนาคารกรุงไทย", nameZh: "储蓄存款 - 泰京银行", type: "asset", parentCode: "101" },
  { code: "1015000", name: "Savings - BAY", nameTh: "เงินฝากออมทรัพย์-ธนาคารกรุงศรีอยุธยา", nameZh: "储蓄存款 - 大城银行", type: "asset", parentCode: "101" },
  { code: "1016000", name: "Savings - TTB", nameTh: "เงินฝากออมทรัพย์ - ธ.ทีเอ็มบีธนชาต", nameZh: "储蓄存款 - TMB", type: "asset", parentCode: "101" },
  { code: "1017000", name: "Savings - KKP", nameTh: "เงินฝากออมทรัพย์ - ธ.เกียรตินาคินภัทร", nameZh: "储蓄存款 - KKP", type: "asset", parentCode: "101" },

  // --- Current Accounts (per bank) ---
  { code: "102", name: "Cash at Bank - Current", nameTh: "เงินฝากกระแสรายวัน", nameZh: "活期存款", type: "asset", parentCode: "100" },
  { code: "1021000", name: "Current - BBL", nameTh: "เงินฝากกระแสรายวัน - ธ.กรุงเทพ", nameZh: "活期存款 - 盘谷银行", type: "asset", parentCode: "102" },
  { code: "1022000", name: "Current - KBANK", nameTh: "เงินฝากกระแสรายวัน-ธนาคารกสิกรไทย", nameZh: "活期存款 - 开泰银行", type: "asset", parentCode: "102" },
  { code: "1023000", name: "Current - SCB", nameTh: "เงินฝากกระแสรายวัน-ธนาคารไทยพาณิชย์", nameZh: "活期存款 - 汇商银行", type: "asset", parentCode: "102" },
  { code: "1024000", name: "Current - KTB", nameTh: "เงินฝากกระแสรายวัน-ธนาคารกรุงไทย", nameZh: "活期存款 - 泰京银行", type: "asset", parentCode: "102" },
  { code: "1025000", name: "Current - BAY", nameTh: "เงินฝากกระแสรายวัน-ธนาคารกรุงศรีอยุธยา", nameZh: "活期存款 - 大城银行", type: "asset", parentCode: "102" },
  { code: "1026000", name: "Current - TTB", nameTh: "เงินฝากกระแสรายวัน - ธ.ทีเอ็มบีธนชาต", nameZh: "活期存款 - TMB", type: "asset", parentCode: "102" },
  { code: "1027000", name: "Current - KKP", nameTh: "เงินฝากกระแสรายวัน - ธ.เกียรตินาคินภัทร", nameZh: "活期存款 - KKP", type: "asset", parentCode: "102" },

  // --- Fixed Deposit Accounts (per bank) ---
  { code: "103", name: "Cash at Bank - Fixed Deposit", nameTh: "เงินฝากประจำ", nameZh: "定期存款", type: "asset", parentCode: "100" },
  { code: "1031000", name: "Fixed Deposit - BBL", nameTh: "เงินฝากประจำ-ธนาคารกรุงเทพ", nameZh: "定期存款 - 盘谷银行", type: "asset", parentCode: "103" },
  { code: "1032000", name: "Fixed Deposit - KBANK", nameTh: "เงินฝากประจำ-ธนาคารกสิกรไทย", nameZh: "定期存款 - 开泰银行", type: "asset", parentCode: "103" },
  { code: "1033000", name: "Fixed Deposit - SCB", nameTh: "เงินฝากประจำ-ธนาคารไทยพาณิชย์", nameZh: "定期存款 - 汇商银行", type: "asset", parentCode: "103" },
  { code: "1034000", name: "Fixed Deposit - KTB", nameTh: "เงินฝากประจำ-ธนาคารกรุงไทย", nameZh: "定期存款 - 泰京银行", type: "asset", parentCode: "103" },
  { code: "1035000", name: "Fixed Deposit - BAY", nameTh: "เงินฝากประจำ-ธนาคารกรุงศรีอยุธยา", nameZh: "定期存款 - 大城银行", type: "asset", parentCode: "103" },
  { code: "1036000", name: "Fixed Deposit - TTB", nameTh: "เงินฝากประจำ - ธ.ทีเอ็มบีธนชาต", nameZh: "定期存款 - TMB", type: "asset", parentCode: "103" },
  { code: "1037000", name: "Fixed Deposit - KKP", nameTh: "เงินฝากประจำ - ธ.เกียรตินาคินภัทร", nameZh: "定期存款 - KKP", type: "asset", parentCode: "103" },

  // --- Short-Term Investments ---
  { code: "110", name: "Short-Term Investments", nameTh: "เงินลงทุนระยะสั้น", nameZh: "短期投资", type: "asset", parentCode: null },
  { code: "1101000", name: "Short-Term Investments", nameTh: "เงินลงทุนระยะสั้น", nameZh: "短期投资", type: "asset", parentCode: "110" },

  // --- Trade & Other Receivables ---
  { code: "120", name: "Trade & Other Receivables", nameTh: "ลูกหนี้การค้าและลูกหนี้อื่น", nameZh: "应收账款及其他应收款", type: "asset", parentCode: null },
  { code: "1201000", name: "Trade Receivable - Domestic", nameTh: "ลูกหนี้การค้า - ในประเทศ", nameZh: "应收贸易款 - 国内", type: "asset", parentCode: "120" },
  { code: "1202000", name: "Trade Receivable - Overseas", nameTh: "ลูกหนี้การค้าต่างประเทศ", nameZh: "应收贸易款 - 海外", type: "asset", parentCode: "120" },
  { code: "1203000", name: "Other Receivables", nameTh: "ลูกหนี้อื่น", nameZh: "其他应收款", type: "asset", parentCode: "120" },
  { code: "1203100", name: "Pending Receivable", nameTh: "ลูกหนี้รอยกมา", nameZh: "待处理应收款", type: "asset", parentCode: "120" },
  { code: "1203200", name: "Cash Sales Clearing", nameTh: "เงินสดจากการขายรอนำฝากธนาคาร", nameZh: "现销清算", type: "asset", parentCode: "120" },
  { code: "1204000", name: "Post-Dated Checks Receivable", nameTh: "เช็ครับล่วงหน้า", nameZh: "应收远期支票", type: "asset", parentCode: "120" },
  { code: "1204100", name: "Checks in Transit", nameTh: "เช็คเงินฝากระหว่างทาง", nameZh: "在途支票", type: "asset", parentCode: "120" },
  { code: "1204200", name: "Returned Checks", nameTh: "เช็คคืน", nameZh: "退票", type: "asset", parentCode: "120" },
  { code: "1205000", name: "Credit Card Receivable", nameTh: "เครดิตการ์ด", nameZh: "应收信用卡款", type: "asset", parentCode: "120" },
  { code: "1209000", name: "Allowance for Doubtful Accounts", nameTh: "ค่าเผื่อหนี้สงสัยจะสูญ", nameZh: "坏账准备", type: "asset", parentCode: "120" },

  // --- Short-Term Loans ---
  { code: "121", name: "Short-Term Loans", nameTh: "เงินให้กู้ยืมระยะสั้น", nameZh: "短期贷款", type: "asset", parentCode: null },
  { code: "1211000", name: "Short-Term Loans", nameTh: "เงินให้กู้ยืมระยะสั้น", nameZh: "短期贷款", type: "asset", parentCode: "121" },

  // --- Loans to Directors & Employees ---
  { code: "122", name: "Loans to Directors & Employees", nameTh: "เงินให้กู้ยืมกรรมการและพนักงาน", nameZh: "应收董事及员工贷款", type: "asset", parentCode: null },
  { code: "1221000", name: "Loans to Directors", nameTh: "เงินให้กู้ยืมกรรมการ", nameZh: "应收董事贷款", type: "asset", parentCode: "122" },
  { code: "1222000", name: "Loans to Employees", nameTh: "ลูกหนี้เงินให้กู้ยืมแก่ลูกจ้าง", nameZh: "应收员工贷款", type: "asset", parentCode: "122" },
  { code: "1223000", name: "Loans to Subsidiaries", nameTh: "ลูกหนี้เงินให้กู้ยืมแก่บริษัท.....", nameZh: "应收子公司贷款", type: "asset", parentCode: "122" },

  // --- Other Receivables ---
  { code: "129", name: "Other Receivables", nameTh: "ลูกหนี้อื่น ๆ", nameZh: "其他应收款项", type: "asset", parentCode: null },
  { code: "1291000", name: "Other Receivables", nameTh: "ลูกหนี้อื่น ๆ", nameZh: "其他应收款项", type: "asset", parentCode: "129" },
  { code: "1292000", name: "Pending Other Receivables", nameTh: "ลูกหนี้อื่นรอตัดบัญชี", nameZh: "待处理其他应收款", type: "asset", parentCode: "129" },

  // --- Inventories ---
  { code: "130", name: "Inventories", nameTh: "สินค้าคงเหลือ", nameZh: "存货", type: "asset", parentCode: null },
  { code: "1301000", name: "Finished Goods", nameTh: "สินค้าสำเร็จรูป", nameZh: "产成品", type: "asset", parentCode: "130" },
  { code: "1302000", name: "Raw Materials", nameTh: "วัตถุดิบ", nameZh: "原材料", type: "asset", parentCode: "130" },
  { code: "1303000", name: "Supplies", nameTh: "วัสดุสิ้นเปลือง", nameZh: "低值易耗品", type: "asset", parentCode: "130" },
  { code: "1304000", name: "Work in Process", nameTh: "งานระหว่างทำ", nameZh: "在制品", type: "asset", parentCode: "130" },
  { code: "1305000", name: "Goods in Transit", nameTh: "สินค้าระหว่างทาง", nameZh: "在途商品", type: "asset", parentCode: "130" },
  { code: "1306000", name: "Goods in Warehouse", nameTh: "สินค้าในคลัง", nameZh: "仓库商品", type: "asset", parentCode: "130" },
  { code: "1307000", name: "Returned Goods Pending", nameTh: "สินค้ารอตรวจคืน", nameZh: "待检退货商品", type: "asset", parentCode: "130" },
  { code: "1309000", name: "Allowance for Inventory Impairment", nameTh: "ค่าเผื่อสินค้าด้อยค่า", nameZh: "存货减值准备", type: "asset", parentCode: "130" },

  // --- Prepaid Expenses ---
  { code: "140", name: "Prepaid Expenses", nameTh: "ค่าใช้จ่ายจ่ายล่วงหน้า", nameZh: "预付费用", type: "asset", parentCode: null },
  { code: "1401000", name: "Prepaid Expenses", nameTh: "ค่าใช้จ่ายจ่ายล่วงหน้า", nameZh: "预付费用", type: "asset", parentCode: "140" },
  { code: "1402000", name: "Prepaid Corporate Income Tax", nameTh: "ภาษีเงินได้นิติบุคคลจ่ายล่วงหน้า (ภ.ง.ด.51)", nameZh: "预缴企业所得税", type: "asset", parentCode: "140" },
  { code: "1403000", name: "Prepaid Deposits", nameTh: "เงินมัดจำจ่ายล่วงหน้า", nameZh: "预付保证金", type: "asset", parentCode: "140" },
  { code: "1404000", name: "Prepaid Insurance", nameTh: "ค่าประกันภัยจ่ายล่วงหน้า", nameZh: "预付保险费", type: "asset", parentCode: "140" },

  // --- Advance/Deposits ---
  { code: "141", name: "Advances & Deposits", nameTh: "เงินทดรองจ่าย/เงินมัดจำ", nameZh: "预付款项及保证金", type: "asset", parentCode: null },
  { code: "1411000", name: "Advance to Employees", nameTh: "เงินทดรองจ่ายพนักงาน", nameZh: "员工预付款", type: "asset", parentCode: "141" },
  { code: "1412000", name: "Advance to Others", nameTh: "เงินทดรองจ่าย-บุคคลภายนอก", nameZh: "其他预付款", type: "asset", parentCode: "141" },
  { code: "1413000", name: "Short-Term Deposits", nameTh: "เงินมัดจำระยะสั้น", nameZh: "短期保证金", type: "asset", parentCode: "141" },
  { code: "1414000", name: "Short-Term Margin Deposits", nameTh: "เงินประกันระยะสั้น", nameZh: "短期保证金", type: "asset", parentCode: "141" },

  // --- Accrued Revenue ---
  { code: "142", name: "Accrued Revenue", nameTh: "รายได้ค้างรับ", nameZh: "应计收入", type: "asset", parentCode: null },
  { code: "1421000", name: "Accrued Revenue - Transportation", nameTh: "รายได้ค่าขนส่งค้างรับ", nameZh: "应计收入 - 运输", type: "asset", parentCode: "142" },
  { code: "1422000", name: "Accrued Revenue - Service", nameTh: "รายได้ค่าบริการค้างรับ", nameZh: "应计收入 - 服务", type: "asset", parentCode: "142" },
  { code: "1423000", name: "Accrued Interest Receivable", nameTh: "ดอกเบี้ยค้างรับ", nameZh: "应收利息", type: "asset", parentCode: "142" },

  // --- Tax Receivable ---
  { code: "143", name: "Tax Receivable", nameTh: "ลูกหนี้สรรพากร", nameZh: "应收税款", type: "asset", parentCode: null },
  { code: "1431000", name: "Card Tax", nameTh: "ภาษีบัตร", nameZh: "信用卡税", type: "asset", parentCode: "143" },
  { code: "1432000", name: "Input VAT", nameTh: "ภาษีซื้อ", nameZh: "进项税额", type: "asset", parentCode: "143" },
  { code: "1433000", name: "Undue Input VAT", nameTh: "ภาษีซื้อยังไม่ถึงกำหนด", nameZh: "待抵扣进项税额", type: "asset", parentCode: "143" },
  { code: "1434000", name: "Withholding Tax Receivable", nameTh: "ภาษีหัก ณ ที่จ่าย (ถูกหัก)", nameZh: "预扣税款（被扣）", type: "asset", parentCode: "143" },

  // --- Non-Current Assets (header) ---
  { code: "150", name: "Non-Current Assets", nameTh: "สินทรัพย์ไม่หมุนเวียน", nameZh: "非流动资产", type: "asset", parentCode: null },

  // --- Investments ---
  { code: "160", name: "Investments", nameTh: "เงินลงทุน", nameZh: "投资", type: "asset", parentCode: null },
  { code: "1601000", name: "Bonds", nameTh: "พันธบัตร", nameZh: "债券", type: "asset", parentCode: "160" },
  { code: "1602000", name: "Investment In...", nameTh: "เงินลงทุนใน บจก...", nameZh: "投资于...", type: "asset", parentCode: "160" },
  { code: "1609000", name: "Other Investments", nameTh: "เงินลงทุนระยะยาวอื่น", nameZh: "其他投资", type: "asset", parentCode: "160" },

  // --- Long-Term Loans ---
  { code: "161", name: "Long-Term Loans Receivable", nameTh: "เงินให้กู้ยืมระยะยาว", nameZh: "长期贷款", type: "asset", parentCode: null },
  { code: "1611000", name: "Long-Term Loans Receivable", nameTh: "เงินให้กู้ยืมระยะยาว", nameZh: "长期贷款", type: "asset", parentCode: "161" },

  // --- Property, Plant & Equipment ---
  { code: "170", name: "Property, Plant & Equipment", nameTh: "ที่ดิน อาคาร และอุปกรณ์", nameZh: "固定资产", type: "asset", parentCode: null },
  { code: "1701000", name: "Land", nameTh: "ที่ดิน", nameZh: "土地", type: "asset", parentCode: "170" },
  { code: "1702000", name: "Building", nameTh: "อาคาร", nameZh: "建筑物", type: "asset", parentCode: "170" },
  { code: "1702100", name: "Building Improvement", nameTh: "ส่วนต่อเติมอาคาร", nameZh: "建筑物改良", type: "asset", parentCode: "170" },
  { code: "1702200", name: "Factory Building", nameTh: "อาคารโรงงาน", nameZh: "厂房", type: "asset", parentCode: "170" },
  { code: "1703000", name: "Factory Tools & Equipment", nameTh: "เครื่องมือเครื่องใช้ในโรงงาน", nameZh: "工厂设备", type: "asset", parentCode: "170" },
  { code: "1703100", name: "Machinery", nameTh: "เครื่องจักร", nameZh: "机器", type: "asset", parentCode: "170" },
  { code: "1704000", name: "Office Equipment", nameTh: "อุปกรณ์สำนักงาน", nameZh: "办公设备", type: "asset", parentCode: "170" },
  { code: "1705000", name: "Computer Equipment", nameTh: "อุปกรณ์คอมพิวเตอร์", nameZh: "计算机设备", type: "asset", parentCode: "170" },
  { code: "1706000", name: "Vehicles", nameTh: "ยานพาหนะ", nameZh: "车辆", type: "asset", parentCode: "170" },
  { code: "1707000", name: "Furniture & Fixtures", nameTh: "เครื่องตกแต่งและติดตั้ง", nameZh: "家具及装置", type: "asset", parentCode: "170" },
  { code: "1708000", name: "Right-of-Use Assets", nameTh: "สินทรัพย์สิทธิการใช้", nameZh: "使用权资产", type: "asset", parentCode: "170" },

  // --- Accumulated Depreciation ---
  { code: "171", name: "Accumulated Depreciation", nameTh: "ค่าเสื่อมราคาสะสม", nameZh: "累计折旧", type: "asset", parentCode: null },
  { code: "1712000", name: "Accum. Dep. - Building", nameTh: "ค่าเสื่อมราคาสะสม - อาคาร", nameZh: "累计折旧 - 建筑物", type: "asset", parentCode: "171" },
  { code: "1712100", name: "Accum. Dep. - Building Improvement", nameTh: "ค่าเสื่อมราคาสะสม - ส่วนต่อเติมอาคาร", nameZh: "累计折旧 - 建筑物改良", type: "asset", parentCode: "171" },
  { code: "1712200", name: "Accum. Dep. - Factory Building", nameTh: "ค่าเสื่อมราคาสะสม – อาคารโรงงาน", nameZh: "累计折旧 - 厂房", type: "asset", parentCode: "171" },
  { code: "1713000", name: "Accum. Dep. - Factory Equipment", nameTh: "ค่าเสื่อมราคาสะสม – เครื่องมือเครื่องใช้ในโรงงาน", nameZh: "累计折旧 - 工厂设备", type: "asset", parentCode: "171" },
  { code: "1713100", name: "Accum. Dep. - Machinery", nameTh: "ค่าเสื่อมราคาสะสม – เครื่องจักร", nameZh: "累计折旧 - 机器", type: "asset", parentCode: "171" },
  { code: "1714000", name: "Accum. Dep. - Office Equipment", nameTh: "ค่าเสื่อมราคาสะสม - อุปกรณ์สำนักงาน", nameZh: "累计折旧 - 办公设备", type: "asset", parentCode: "171" },
  { code: "1715000", name: "Accum. Dep. - Computer", nameTh: "ค่าเสื่อมราคาสะสม - คอมพิวเตอร์", nameZh: "累计折旧 - 计算机", type: "asset", parentCode: "171" },
  { code: "1716000", name: "Accum. Dep. - Vehicles", nameTh: "ค่าเสื่อมราคาสะสม - ยานพาหนะ", nameZh: "累计折旧 - 车辆", type: "asset", parentCode: "171" },
  { code: "1717000", name: "Accum. Dep. - Furniture", nameTh: "ค่าเสื่อมราคาสะสม - เครื่องตกแต่ง", nameZh: "累计折旧 - 家具", type: "asset", parentCode: "171" },
  { code: "1718000", name: "Accum. Dep. - Right-of-Use Assets", nameTh: "ค่าเสื่อมราคาสะสม - สินทรัพย์สิทธิการใช้", nameZh: "累计折旧 - 使用权资产", type: "asset", parentCode: "171" },

  // --- Intangible Assets ---
  { code: "180", name: "Intangible Assets", nameTh: "สินทรัพย์ไม่มีตัวตน", nameZh: "无形资产", type: "asset", parentCode: null },
  { code: "1801000", name: "Software & Application", nameTh: "ซอฟต์แวร์", nameZh: "软件", type: "asset", parentCode: "180" },
  { code: "1802000", name: "Copyright / License", nameTh: "ค่าลิขสิทธิ์", nameZh: "版权/许可证", type: "asset", parentCode: "180" },
  { code: "1803000", name: "Goodwill", nameTh: "ค่าความนิยม", nameZh: "商誉", type: "asset", parentCode: "180" },
  { code: "1804000", name: "Patent", nameTh: "ค่าสิทธิบัตร", nameZh: "专利", type: "asset", parentCode: "180" },

  // --- Accumulated Amortization ---
  { code: "181", name: "Accumulated Amortization", nameTh: "ค่าตัดจำหน่ายสะสม", nameZh: "累计摊销", type: "asset", parentCode: null },
  { code: "1811000", name: "Accum. Amort. - Software", nameTh: "ค่าตัดจำหน่ายสะสม - ซอฟต์แวร์", nameZh: "累计摊销 - 软件", type: "asset", parentCode: "181" },
  { code: "1812000", name: "Accum. Amort. - Copyright", nameTh: "ค่าตัดจำหน่ายสะสม – ค่าลิขสิทธิ์", nameZh: "累计摊销 - 版权", type: "asset", parentCode: "181" },
  { code: "1813000", name: "Accum. Amort. - Goodwill", nameTh: "ค่าตัดจำหน่ายสะสม – ค่าความนิยม", nameZh: "累计摊销 - 商誉", type: "asset", parentCode: "181" },
  { code: "1814000", name: "Accum. Amort. - Patent", nameTh: "ค่าตัดจำหน่ายสะสม – ค่าสิทธิบัตร", nameZh: "累计摊销 - 专利", type: "asset", parentCode: "181" },

  // --- Other Non-Current Assets ---
  { code: "190", name: "Other Non-Current Assets", nameTh: "สินทรัพย์ไม่หมุนเวียนอื่น", nameZh: "其他非流动资产", type: "asset", parentCode: null },
  { code: "1901000", name: "Long-Term Deposits", nameTh: "เงินมัดจำระยะยาว", nameZh: "长期保证金", type: "asset", parentCode: "190" },

  // ═══════════════════════════════════════════════════════════
  // LIABILITIES (200-299)
  // ═══════════════════════════════════════════════════════════

  // --- Bank Overdrafts & Short-Term Borrowings ---
  { code: "200", name: "Bank Overdrafts & Short-Term Bank Loans", nameTh: "เงินเบิกเกินบัญชีและเงินกู้ยืมระยะสั้นจากสถาบันการเงิน", nameZh: "银行透支及短期银行贷款", type: "liability", parentCode: null },
  { code: "2001000", name: "Bank Overdraft", nameTh: "เงินเบิกเกินบัญชีธนาคาร", nameZh: "银行透支", type: "liability", parentCode: "200" },
  { code: "2002000", name: "Short-Term Bank Loan", nameTh: "เงินกู้ยืมระยะสั้นจากสถาบันการเงิน", nameZh: "短期银行贷款", type: "liability", parentCode: "200" },

  // --- Trade & Other Payables ---
  { code: "210", name: "Trade & Other Payables", nameTh: "เจ้าหนี้การค้าและเจ้าหนี้อื่น", nameZh: "应付账款及其他应付款", type: "liability", parentCode: null },
  { code: "2101000", name: "Trade Payable - Domestic", nameTh: "เจ้าหนี้การค้า - ในประเทศ", nameZh: "应付贸易款 - 国内", type: "liability", parentCode: "210" },
  { code: "2102000", name: "Trade Payable - Overseas", nameTh: "เจ้าหนี้การค้าต่างประเทศ", nameZh: "应付贸易款 - 海外", type: "liability", parentCode: "210" },
  { code: "2103000", name: "Other Payables", nameTh: "เจ้าหนี้อื่น", nameZh: "其他应付款", type: "liability", parentCode: "210" },
  { code: "2103100", name: "Pending Payable", nameTh: "เจ้าหนี้รอยกมา", nameZh: "待处理应付款", type: "liability", parentCode: "210" },
  { code: "2103200", name: "AP Clearing", nameTh: "เจ้าหนี้รอเคลีย์ริ่ง", nameZh: "应付清算", type: "liability", parentCode: "210" },
  { code: "2103300", name: "AP Consignment", nameTh: "เจ้าหนี้สินค้ารับฝากขาย", nameZh: "寄售应付款", type: "liability", parentCode: "210" },
  { code: "2103400", name: "Hire Purchase Payable", nameTh: "เจ้าหนี้เช่าซื้อ", nameZh: "融资租赁应付款", type: "liability", parentCode: "210" },
  { code: "2103500", name: "Lease Liability", nameTh: "หนี้สินตามสัญญาเช่า", nameZh: "租赁负债", type: "liability", parentCode: "210" },
  { code: "2104000", name: "Post-Dated Checks Payable", nameTh: "เช็คจ่ายล่วงหน้า", nameZh: "应付远期支票", type: "liability", parentCode: "210" },
  { code: "2104100", name: "Returned Checks Payable", nameTh: "เช็คจ่าย-รับคืน", nameZh: "退票应付", type: "liability", parentCode: "210" },
  { code: "2105000", name: "Credit Card Payable", nameTh: "เครดิตการ์ด - ค้างจ่าย", nameZh: "信用卡应付", type: "liability", parentCode: "210" },
  { code: "2106000", name: "Director Advance Payable", nameTh: "เจ้าหนี้กรรมการ (จ่ายแทนบริษัท)", nameZh: "应付董事垫付款", type: "liability", parentCode: "210" },

  // --- Current Portion of Long-Term Liabilities ---
  { code: "220", name: "Current Portion of Long-Term Liabilities", nameTh: "ส่วนของหนี้สินระยะยาวที่ถึงกำหนดชำระภายในหนึ่งปี", nameZh: "一年内到期长期负债", type: "liability", parentCode: null },
  { code: "2201000", name: "Current Portion of Long-Term Liabilities", nameTh: "ส่วนของหนี้สินระยะยาวที่ถึงกำหนดใน 1 ปี", nameZh: "一年内到期长期负债", type: "liability", parentCode: "220" },

  // --- Short-Term Borrowings ---
  { code: "230", name: "Short-Term Borrowings", nameTh: "เงินกู้ยืมระยะสั้น", nameZh: "短期借款", type: "liability", parentCode: null },
  { code: "2301000", name: "Loans from Directors", nameTh: "เงินกู้ยืมกรรมการ", nameZh: "应付董事贷款", type: "liability", parentCode: "230" },
  { code: "2302000", name: "Loans from Subsidiaries", nameTh: "เจ้าหนี้เงินกู้ยืม บริษัทในเครือ", nameZh: "关联方借款", type: "liability", parentCode: "230" },

  // --- Accrued Expenses ---
  { code: "231", name: "Accrued Expenses", nameTh: "ค่าใช้จ่ายค้างจ่าย", nameZh: "应计费用", type: "liability", parentCode: null },
  { code: "2311000", name: "Accrued Wages", nameTh: "ค่าจ้างค้างจ่าย", nameZh: "应付工资", type: "liability", parentCode: "231" },
  { code: "2311100", name: "Accrued Salary", nameTh: "เงินเดือนค้างจ่าย", nameZh: "应付薪金", type: "liability", parentCode: "231" },
  { code: "2311200", name: "Accrued Bonus", nameTh: "โบนัสค้างจ่าย", nameZh: "应付奖金", type: "liability", parentCode: "231" },
  { code: "2311300", name: "Accrued Interest", nameTh: "ดอกเบี้ยค้างจ่าย", nameZh: "应付利息", type: "liability", parentCode: "231" },
  { code: "2311400", name: "Accrued Brokerage", nameTh: "ค่านายหน้าค้างจ่าย", nameZh: "应付佣金", type: "liability", parentCode: "231" },
  { code: "2311500", name: "Accrued Electricity", nameTh: "ค่าไฟฟ้าค้างจ่าย", nameZh: "应付电费", type: "liability", parentCode: "231" },
  { code: "2311600", name: "Accrued Water", nameTh: "ค่าน้ำประปาค้างจ่าย", nameZh: "应付水费", type: "liability", parentCode: "231" },
  { code: "2311700", name: "Accrued Telephone", nameTh: "ค่าโทรศัพท์ค้างจ่าย", nameZh: "应付电话费", type: "liability", parentCode: "231" },
  { code: "2311800", name: "Accrued Audit Fee", nameTh: "ค่าสอบบัญชีค้างจ่าย", nameZh: "应付审计费", type: "liability", parentCode: "231" },
  { code: "2311900", name: "Accrued Accounting Fee", nameTh: "ค่าทำบัญชีค้างจ่าย", nameZh: "应付记账费", type: "liability", parentCode: "231" },
  { code: "2312000", name: "Accrued Social Security", nameTh: "เงินสมทบประกันสังคมค้างจ่าย", nameZh: "应付社会保险", type: "liability", parentCode: "231" },
  { code: "2312100", name: "Accrued Legal Fees", nameTh: "ค่าปรึกษากฎหมายค้างจ่าย", nameZh: "应付法律费", type: "liability", parentCode: "231" },
  { code: "2312200", name: "Accrued Marketplace Fees", nameTh: "ค่าธรรมเนียมแพลตฟอร์มรอเอกสาร", nameZh: "待收据平台费用", type: "liability", parentCode: "231" },
  { code: "2319000", name: "Accrued Other Expenses", nameTh: "ค่าใช้จ่ายค้างจ่ายอื่น", nameZh: "其他应计费用", type: "liability", parentCode: "231" },

  // --- Accrued Taxes ---
  { code: "232", name: "Accrued Taxes", nameTh: "ภาษีค้างจ่าย", nameZh: "应付税款", type: "liability", parentCode: null },
  { code: "2320100", name: "Accrued WHT PND 1", nameTh: "ภาษีหัก ณ ที่จ่าย ภ.ง.ด.1 ค้างจ่าย", nameZh: "预扣税 PND 1", type: "liability", parentCode: "232" },
  { code: "2320300", name: "Accrued WHT PND 3", nameTh: "ภาษีหัก ณ ที่จ่าย ภ.ง.ด.3 ค้างจ่าย", nameZh: "预扣税 PND 3", type: "liability", parentCode: "232" },
  { code: "2325300", name: "Accrued WHT PND 53", nameTh: "ภาษีหัก ณ ที่จ่าย ภ.ง.ด.53 ค้างจ่าย", nameZh: "预扣税 PND 53", type: "liability", parentCode: "232" },
  { code: "2325400", name: "Accrued WHT PND 54", nameTh: "ภาษีหัก ณ ที่จ่าย ภ.ง.ด.54 ค้างจ่าย", nameZh: "预扣税 PND 54", type: "liability", parentCode: "232" },
  { code: "2328000", name: "Accrued Corporate Income Tax", nameTh: "ภาษีเงินได้นิติบุคคลค้างจ่าย", nameZh: "应付企业所得税", type: "liability", parentCode: "232" },
  { code: "2329000", name: "Accrued Other Tax", nameTh: "ภาษีอื่นค้างจ่าย", nameZh: "其他应付税款", type: "liability", parentCode: "232" },

  // --- Deferred Revenue ---
  { code: "233", name: "Deferred Revenue", nameTh: "รายได้รับล่วงหน้า", nameZh: "预收收入", type: "liability", parentCode: null },
  { code: "2331000", name: "Deferred Revenue - Goods", nameTh: "รายได้รับล่วงหน้า - สินค้า", nameZh: "预收收入 - 商品", type: "liability", parentCode: "233" },
  { code: "2332000", name: "Deferred Revenue - Service", nameTh: "รายได้รับล่วงหน้า-ค่าบริการ", nameZh: "预收收入 - 服务", type: "liability", parentCode: "233" },
  { code: "2333000", name: "Deferred Revenue - Commission", nameTh: "รายได้รับล่วงหน้า-ค่านายหน้า", nameZh: "预收收入 - 佣金", type: "liability", parentCode: "233" },
  { code: "2334000", name: "Customer Deposits", nameTh: "เงินมัดจำรับล่วงหน้า", nameZh: "客户保证金", type: "liability", parentCode: "233" },

  // --- Tax Payable ---
  { code: "234", name: "Tax Payable", nameTh: "ภาษีค้างจ่าย (VAT/WHT)", nameZh: "应付税款 (增值税)", type: "liability", parentCode: null },
  { code: "2341000", name: "Output VAT", nameTh: "ภาษีขาย", nameZh: "销项税额", type: "liability", parentCode: "234" },
  { code: "2342000", name: "Undue Output VAT", nameTh: "ภาษีขายยังไม่ถึงกำหนด", nameZh: "递延销项税额", type: "liability", parentCode: "234" },
  { code: "2343000", name: "VAT Payable (PP30)", nameTh: "เจ้าหนี้กรมสรรพากร ภพ 30", nameZh: "应付增值税", type: "liability", parentCode: "234" },
  { code: "2344000", name: "WHT Payable PND 1", nameTh: "ภาษีหัก ณ ที่จ่าย ภ.ง.ด.1", nameZh: "预扣税 PND 1", type: "liability", parentCode: "234" },
  { code: "2345000", name: "WHT Payable PND 3", nameTh: "ภาษีหัก ณ ที่จ่าย ภ.ง.ด.3", nameZh: "预扣税 PND 3", type: "liability", parentCode: "234" },
  { code: "2346000", name: "WHT Payable PND 53", nameTh: "ภาษีหัก ณ ที่จ่าย ภ.ง.ด.53", nameZh: "预扣税 PND 53", type: "liability", parentCode: "234" },
  { code: "2347000", name: "VAT Payable (PP36)", nameTh: "เจ้าหนี้กรมสรรพากร ภพ 36", nameZh: "应付税务局 PP36", type: "liability", parentCode: "234" },
  { code: "2348000", name: "WHT Payable PND 2", nameTh: "ภาษีหัก ณ ที่จ่าย ภ.ง.ด.2", nameZh: "预扣税 PND 2", type: "liability", parentCode: "234" },

  // --- Short-Term Provisions ---
  { code: "238", name: "Short-Term Provisions", nameTh: "ประมาณการหนี้สินระยะสั้น", nameZh: "短期准备金", type: "liability", parentCode: null },
  { code: "2381000", name: "Short-Term Provisions", nameTh: "ประมาณการหนี้สินระยะสั้น", nameZh: "短期准备金", type: "liability", parentCode: "238" },

  // --- Other Current Liabilities ---
  { code: "239", name: "Other Current Liabilities", nameTh: "หนี้สินหมุนเวียนอื่น", nameZh: "其他流动负债", type: "liability", parentCode: null },
  { code: "2391000", name: "Other Current Liabilities", nameTh: "หนี้สินหมุนเวียนอื่น", nameZh: "其他流动负债", type: "liability", parentCode: "239" },

  // --- Long-Term Borrowings ---
  { code: "240", name: "Long-Term Borrowings", nameTh: "เงินกู้ยืมระยะยาว", nameZh: "长期借款", type: "liability", parentCode: null },
  { code: "2401000", name: "Long-Term Loan - BBL", nameTh: "เงินกู้ยืมระยะยาว - ธ.กรุงเทพ", nameZh: "长期贷款 - 盘谷银行", type: "liability", parentCode: "240" },
  { code: "2401100", name: "Long-Term Loan - KBANK", nameTh: "เงินกู้ยืมระยะยาวจากธนาคารกสิกรไทย", nameZh: "长期贷款 - 开泰银行", type: "liability", parentCode: "240" },
  { code: "2401200", name: "Long-Term Loan - SCB", nameTh: "เงินกู้ยืมระยะยาวจากธนาคารไทยพาณิชย์", nameZh: "长期贷款 - 汇商银行", type: "liability", parentCode: "240" },
  { code: "2401300", name: "Long-Term Loan - KTB", nameTh: "เงินกู้ยืมระยะยาวจากธนาคารกรุงไทย", nameZh: "长期贷款 - 泰京银行", type: "liability", parentCode: "240" },
  { code: "2401400", name: "Long-Term Loan - BAY", nameTh: "เงินกู้ยืมระยะยาวจากธนาคารกรุงศรีอยุธยา", nameZh: "长期贷款 - 大城银行", type: "liability", parentCode: "240" },
  { code: "2401500", name: "Long-Term Loan - TTB", nameTh: "เงินกู้ยืมระยะยาวจากธนาคารทหารไทย", nameZh: "长期贷款 - TMB", type: "liability", parentCode: "240" },
  { code: "2401600", name: "Long-Term Loan - Thanachart", nameTh: "เงินกู้ยืมระยะยาวจากธนาคารธนชาติ", nameZh: "长期贷款 - 财纳昌银行", type: "liability", parentCode: "240" },
  { code: "2402000", name: "Long-Term Loan - Financial Institution", nameTh: "เงินกู้ยืมระยะยาว - สถาบันการเงิน", nameZh: "长期贷款 - 金融机构", type: "liability", parentCode: "240" },
  { code: "2403000", name: "Long-Term Loan - Subsidiaries", nameTh: "เงินกู้ยืมระยะยาว - บริษัทในเครือ", nameZh: "长期贷款 - 子公司", type: "liability", parentCode: "240" },

  // --- Deferred Tax ---
  { code: "241", name: "Deferred Tax Liabilities", nameTh: "หนี้สินภาษีเงินได้รอการตัดบัญชี", nameZh: "递延所得税负债", type: "liability", parentCode: null },
  { code: "2411000", name: "Deferred Tax Liabilities", nameTh: "ภาษีเงินได้รอตัดบัญชี", nameZh: "递延所得税负债", type: "liability", parentCode: "241" },

  // --- Long-Term Employee Benefits ---
  { code: "242", name: "Long-Term Employee Benefits", nameTh: "ผลประโยชน์พนักงานระยะยาว", nameZh: "长期职工福利", type: "liability", parentCode: null },
  { code: "2421000", name: "Employee Benefit Obligations", nameTh: "ประมาณการหนี้สินผลประโยชน์พนักงาน", nameZh: "应付职工福利", type: "liability", parentCode: "242" },

  // --- Long-Term Provisions ---
  { code: "243", name: "Long-Term Provisions", nameTh: "ประมาณการหนี้สินระยะยาว", nameZh: "长期准备金", type: "liability", parentCode: null },
  { code: "2431000", name: "Long-Term Provisions", nameTh: "ประมาณการหนี้สินระยะยาว", nameZh: "长期准备金", type: "liability", parentCode: "243" },

  // --- Other Non-Current Liabilities ---
  { code: "249", name: "Other Non-Current Liabilities", nameTh: "หนี้สินไม่หมุนเวียนอื่น", nameZh: "其他非流动负债", type: "liability", parentCode: null },
  { code: "2491000", name: "Other Non-Current Liabilities", nameTh: "หนี้สินไม่หมุนเวียนอื่น", nameZh: "其他非流动负债", type: "liability", parentCode: "249" },

  // ═══════════════════════════════════════════════════════════
  // EQUITY (300-399)
  // ═══════════════════════════════════════════════════════════
  { code: "301", name: "Ordinary Shares", nameTh: "ทุนจดทะเบียน - หุ้นสามัญ", nameZh: "普通股", type: "equity", parentCode: null },
  { code: "3011000", name: "Ordinary Shares - A", nameTh: "หุ้นสามัญ ก", nameZh: "普通股 A", type: "equity", parentCode: "301" },
  { code: "3011001", name: "Ordinary Shares - B", nameTh: "หุ้นสามัญ – นาย B", nameZh: "普通股 B", type: "equity", parentCode: "301" },
  { code: "3011002", name: "Ordinary Shares - C", nameTh: "หุ้นสามัญ – นาย C", nameZh: "普通股 C", type: "equity", parentCode: "301" },

  { code: "302", name: "Preference Shares", nameTh: "หุ้นบุริมสิทธิ", nameZh: "优先股", type: "equity", parentCode: null },
  { code: "3021000", name: "Preference Shares", nameTh: "หุ้นบุริมสิทธิ", nameZh: "优先股", type: "equity", parentCode: "302" },

  { code: "303", name: "Retained Earnings", nameTh: "กำไรสะสม", nameZh: "留存收益", type: "equity", parentCode: null },
  { code: "3031000", name: "Appropriated Retained Earnings", nameTh: "กำไรสะสม - จัดสรรแล้ว", nameZh: "留存收益 - 已分配", type: "equity", parentCode: "303" },
  { code: "3032000", name: "Unappropriated Retained Earnings", nameTh: "กำไรสะสม - ยังไม่ได้จัดสรร", nameZh: "留存收益 - 未分配", type: "equity", parentCode: "303" },

  { code: "320", name: "Current Year Profit/Loss", nameTh: "กำไร(ขาดทุน)สุทธิประจำปี", nameZh: "本年度净利润（亏损）", type: "equity", parentCode: null },
  { code: "3201000", name: "Current Year Profit/Loss", nameTh: "กำไร(ขาดทุน)สุทธิประจำปี", nameZh: "本年度净利润（亏损）", type: "equity", parentCode: "320" },

  { code: "330", name: "Owner's Drawing", nameTh: "ถอนใช้ส่วนตัว", nameZh: "业主提款", type: "equity", parentCode: null },
  { code: "3301000", name: "Owner's Drawing", nameTh: "ถอนใช้ส่วนตัว", nameZh: "业主提款", type: "equity", parentCode: "330" },

  { code: "390", name: "Other Components of Equity", nameTh: "องค์ประกอบอื่นของส่วนของผู้ถือหุ้น", nameZh: "其他权益组成部分", type: "equity", parentCode: null },
  { code: "3901000", name: "Other Components of Equity", nameTh: "องค์ประกอบอื่นของส่วนของผู้ถือหุ้น", nameZh: "其他权益组成部分", type: "equity", parentCode: "390" },

  // ═══════════════════════════════════════════════════════════
  // REVENUE (400-499)
  // ═══════════════════════════════════════════════════════════
  { code: "400", name: "Revenue from Sale of Goods", nameTh: "รายได้จากการขายสินค้า", nameZh: "商品销售收入", type: "revenue", parentCode: null },
  { code: "4001000", name: "Sales", nameTh: "รายได้จากการขาย", nameZh: "销售收入", type: "revenue", parentCode: "400" },
  { code: "4002000", name: "Sales Discounts", nameTh: "ส่วนลดจ่าย", nameZh: "销售折扣", type: "revenue", parentCode: "400" },
  { code: "4003000", name: "Sales Returns", nameTh: "รับคืนสินค้า", nameZh: "销售退回", type: "revenue", parentCode: "400" },
  { code: "4004000", name: "Shipping Income", nameTh: "รายได้ค่าขนส่ง", nameZh: "运费收入", type: "revenue", parentCode: "400" },

  { code: "410", name: "Revenue from Rendering Services", nameTh: "รายได้จากการให้บริการ", nameZh: "服务收入", type: "revenue", parentCode: null },
  { code: "4100100", name: "Service Revenue", nameTh: "รายได้จากการให้บริการ", nameZh: "服务收入", type: "revenue", parentCode: "410" },
  { code: "4100200", name: "Installation Revenue", nameTh: "รายได้ค่าติดตั้ง", nameZh: "安装收入", type: "revenue", parentCode: "410" },
  { code: "4100300", name: "Repair Revenue", nameTh: "รายได้ค่าซ่อมแซม", nameZh: "维修收入", type: "revenue", parentCode: "410" },
  { code: "4100400", name: "Rental Revenue", nameTh: "รายได้ค่าเช่า", nameZh: "租赁收入", type: "revenue", parentCode: "410" },

  { code: "420", name: "Other Revenue", nameTh: "รายได้อื่น", nameZh: "其他收入", type: "revenue", parentCode: null },
  { code: "4200100", name: "Interest Income", nameTh: "รายได้ดอกเบี้ย", nameZh: "利息收入", type: "revenue", parentCode: "420" },
  { code: "4200200", name: "Gain on Share of Assets", nameTh: "กำไรจากส่วนแบ่งสินทรัพย์", nameZh: "资产份额收益", type: "revenue", parentCode: "420" },
  { code: "4200300", name: "Gain on Asset Disposal", nameTh: "กำไรจากการจำหน่ายสินทรัพย์", nameZh: "资产处置收益", type: "revenue", parentCode: "420" },
  { code: "4200400", name: "Cost of Sale of Fixed Assets", nameTh: "ต้นทุนการขายทรัพย์สินถาวร", nameZh: "固定资产出售成本", type: "revenue", parentCode: "420" },
  { code: "4200500", name: "Gain on Foreign Exchange", nameTh: "กำไรจากอัตราแลกเปลี่ยน", nameZh: "汇兑收益", type: "revenue", parentCode: "420" },
  { code: "4200600", name: "Revenue from Subsidiaries", nameTh: "รายได้จากการขายสินค้า/บริการให้บริษัทในเครือ", nameZh: "子公司收入", type: "revenue", parentCode: "420" },
  { code: "4200700", name: "Other Revenue", nameTh: "รายได้เบ็ดเตล็ด", nameZh: "杂项收入", type: "revenue", parentCode: "420" },

  // ═══════════════════════════════════════════════════════════
  // EXPENSES (500-599)
  // ═══════════════════════════════════════════════════════════

  // --- Cost of Revenue ---
  { code: "510", name: "Cost of Revenue", nameTh: "ต้นทุนขายและหรือต้นทุนการให้บริการ", nameZh: "销售成本", type: "expense", parentCode: null },
  { code: "5101000", name: "Cost of Goods Sold", nameTh: "ต้นทุนสินค้าเพื่อขาย", nameZh: "商品销售成本", type: "expense", parentCode: "510" },
  { code: "5101100", name: "Beginning Inventory", nameTh: "สินค้าคงเหลือต้นงวด", nameZh: "期初存货", type: "expense", parentCode: "510" },
  { code: "5101200", name: "Ending Inventory", nameTh: "สินค้าคงเหลือปลายงวด", nameZh: "期末存货", type: "expense", parentCode: "510" },
  { code: "5101300", name: "Purchases", nameTh: "ซื้อสินค้า", nameZh: "采购", type: "expense", parentCode: "510" },
  { code: "5101400", name: "Freight & Delivery Charges", nameTh: "ค่าขนส่งเข้า", nameZh: "进货运费", type: "expense", parentCode: "510" },
  { code: "5101500", name: "Purchase Discounts", nameTh: "ส่วนลดรับ", nameZh: "采购折扣", type: "expense", parentCode: "510" },
  { code: "5101600", name: "Purchase Returns", nameTh: "ส่งคืนสินค้า", nameZh: "采购退回", type: "expense", parentCode: "510" },
  { code: "5102000", name: "Cost of Services", nameTh: "ต้นทุนบริการ", nameZh: "服务成本", type: "expense", parentCode: "510" },
  { code: "5102100", name: "Service Cost - Supplies", nameTh: "ต้นทุนวัสดุอุปกรณ์ใช้ไป", nameZh: "服务成本 - 物料", type: "expense", parentCode: "510" },
  { code: "5102200", name: "Service Cost - Labor", nameTh: "ต้นทุนเงินเดือนและแรงงานทางตรง", nameZh: "服务成本 - 人工", type: "expense", parentCode: "510" },
  { code: "5102300", name: "Service Cost - Third Party", nameTh: "ต้นทุนแรงงานภายนอก", nameZh: "服务成本 - 外包", type: "expense", parentCode: "510" },
  { code: "5102400", name: "Service Cost - Overhead", nameTh: "โสหุ้ยการบริการ", nameZh: "服务成本 - 间接费", type: "expense", parentCode: "510" },
  { code: "5103000", name: "Raw Material Purchases", nameTh: "ซื้อวัตถุดิบ", nameZh: "原材料采购", type: "expense", parentCode: "510" },
  { code: "5103100", name: "Raw Material Returns", nameTh: "ส่งคืน - วัตถุดิบ", nameZh: "原材料退回", type: "expense", parentCode: "510" },
  { code: "5103200", name: "Raw Material Discounts", nameTh: "ส่วนลดรับ - วัตถุดิบ", nameZh: "原材料折扣", type: "expense", parentCode: "510" },
  { code: "5104000", name: "Supplies Purchases", nameTh: "ซื้อวัสดุสิ้นเปลือง", nameZh: "耗材采购", type: "expense", parentCode: "510" },
  { code: "5104100", name: "Supplies Returns", nameTh: "ส่งคืน - วัสดุสิ้นเปลือง", nameZh: "耗材退回", type: "expense", parentCode: "510" },
  { code: "5104200", name: "Supplies Discounts", nameTh: "ส่วนลดรับ - วัสดุสิ้นเปลือง", nameZh: "耗材折扣", type: "expense", parentCode: "510" },
  { code: "5105000", name: "Direct Labor Cost", nameTh: "ต้นทุนแรงงานทางตรง", nameZh: "直接人工费", type: "expense", parentCode: "510" },
  { code: "5105100", name: "Direct Third-Party Cost", nameTh: "ต้นทุนแรงงานภายนอก", nameZh: "直接外包费", type: "expense", parentCode: "510" },
  { code: "5105200", name: "Direct Overhead", nameTh: "โสหุ้ยการผลิตทางตรง", nameZh: "直接制造费用", type: "expense", parentCode: "510" },
  { code: "5105300", name: "Indirect Overhead", nameTh: "โสหุ้ยการผลิตทางอ้อม", nameZh: "间接制造费用", type: "expense", parentCode: "510" },
  { code: "5105400", name: "Depreciation - Manufacturing", nameTh: "ปันส่วนต้นทุนค่าเสื่อมราคา", nameZh: "折旧 - 制造", type: "expense", parentCode: "510" },
  { code: "5105500", name: "Standard Cost Variance", nameTh: "ผลต่างต้นทุนมาตรฐาน", nameZh: "标准成本差异", type: "expense", parentCode: "510" },
  { code: "5105600", name: "Variance - Raw Material", nameTh: "ผลต่าง-วัตถุดิบ-ปลายงวด - ต้นงวด", nameZh: "原材料差异", type: "expense", parentCode: "510" },
  { code: "5105700", name: "Variance - Finished Goods", nameTh: "ผลต่าง-สินค้าคงเหลือ-ปลายงวด - ต้นงวด", nameZh: "产成品差异", type: "expense", parentCode: "510" },
  { code: "5105800", name: "Variance - Other Costs", nameTh: "ผลต่าง- ต้นทุนค่าใช้จ่ายอื่น - ปลายงวด - ต้นงวด", nameZh: "其他成本差异", type: "expense", parentCode: "510" },
  { code: "5108000", name: "Import Duty & Customs", nameTh: "อากรขาเข้าและพิธีการศุลกากร", nameZh: "进口关税及海关费", type: "expense", parentCode: "510" },

  // --- Selling Expenses ---
  { code: "520", name: "Selling Expenses", nameTh: "ค่าใช้จ่ายในการขาย", nameZh: "销售费用", type: "expense", parentCode: null },
  { code: "5200100", name: "Sales Staff Wages & Benefits", nameTh: "ค่าแรงและผลประโยชน์พนักงานขายชั่วคราว", nameZh: "销售人员工资福利", type: "expense", parentCode: "520" },
  { code: "5200200", name: "Commission & Rebate", nameTh: "ค่าคอมมิชชั่นและส่วนลดจ่าย", nameZh: "佣金及折扣", type: "expense", parentCode: "520" },
  { code: "5200300", name: "Third-Party Commission", nameTh: "ค่านายหน้าและการส่งเสริมการขายบุคคลภายนอก", nameZh: "第三方佣金", type: "expense", parentCode: "520" },
  { code: "5200400", name: "Travel Expense - Selling", nameTh: "ค่าเดินทาง - การขาย", nameZh: "差旅费 - 销售", type: "expense", parentCode: "520" },
  { code: "5200500", name: "Advertising Expense", nameTh: "ค่าโฆษณา", nameZh: "广告费", type: "expense", parentCode: "520" },
  { code: "5200600", name: "Entertainment Expense - Selling", nameTh: "ค่ารับรองขาย", nameZh: "招待费 - 销售", type: "expense", parentCode: "520" },
  { code: "5200700", name: "Other Selling Expenses", nameTh: "ค่าใช้จ่ายในการขายอื่น", nameZh: "其他销售费用", type: "expense", parentCode: "520" },

  // --- Administrative Expenses ---
  { code: "521", name: "Administrative Expenses", nameTh: "ค่าใช้จ่ายในการบริหาร", nameZh: "管理费用", type: "expense", parentCode: null },
  { code: "5210010", name: "Wages", nameTh: "ค่าแรง", nameZh: "工资", type: "expense", parentCode: "521" },
  { code: "5210020", name: "Salary", nameTh: "เงินเดือน", nameZh: "薪金", type: "expense", parentCode: "521" },
  { code: "5210030", name: "Overtime", nameTh: "ค่าล่วงเวลา", nameZh: "加班费", type: "expense", parentCode: "521" },
  { code: "5210040", name: "Welfare", nameTh: "ค่าสวัสดิการ", nameZh: "福利", type: "expense", parentCode: "521" },
  { code: "5210050", name: "Bonus", nameTh: "โบนัส", nameZh: "奖金", type: "expense", parentCode: "521" },
  { code: "5210060", name: "Special Bonus", nameTh: "เงินเพิ่มพิเศษ", nameZh: "特别奖金", type: "expense", parentCode: "521" },
  { code: "5210070", name: "Traveling Expense", nameTh: "ค่าเดินทาง", nameZh: "差旅费", type: "expense", parentCode: "521" },
  { code: "5210080", name: "Commission Expense", nameTh: "ค่าคอมมิชชั่น", nameZh: "佣金支出", type: "expense", parentCode: "521" },
  { code: "5210090", name: "Social Security", nameTh: "เงินสมทบประกันสังคม", nameZh: "社会保险费", type: "expense", parentCode: "521" },
  { code: "5210100", name: "Workmen's Compensation", nameTh: "เงินสมทบกองทุนทดแทน", nameZh: "工伤保险", type: "expense", parentCode: "521" },
  { code: "5210110", name: "Medical Expense", nameTh: "ค่ารักษาพยาบาล", nameZh: "医疗费", type: "expense", parentCode: "521" },
  { code: "5210120", name: "Seminar/Training", nameTh: "ค่าฝึกอบรม/สัมมนา", nameZh: "培训费", type: "expense", parentCode: "521" },
  { code: "5210130", name: "Uniform Expense", nameTh: "ค่าแบบฟอร์มพนักงาน", nameZh: "制服费", type: "expense", parentCode: "521" },
  { code: "5210140", name: "Insurance Premium - Employee", nameTh: "ค่าเบี้ยประกันชีวิตและอุบัติเหตุ", nameZh: "员工保险费", type: "expense", parentCode: "521" },
  { code: "5210150", name: "Food & Beverage", nameTh: "ค่าอาหารและเครื่องดื่ม", nameZh: "餐饮费", type: "expense", parentCode: "521" },
  { code: "5210160", name: "Catering", nameTh: "ค่าจัดเลี้ยงและสันทนาการ", nameZh: "宴会费", type: "expense", parentCode: "521" },
  { code: "5210170", name: "Other Welfare", nameTh: "ค่าสวัสดิการอื่น ๆ", nameZh: "其他福利", type: "expense", parentCode: "521" },
  { code: "5210180", name: "Accounting Fee", nameTh: "ค่าทำบัญชี", nameZh: "会计费", type: "expense", parentCode: "521" },
  { code: "5210190", name: "Audit Fee", nameTh: "ค่าสอบบัญชี", nameZh: "审计费", type: "expense", parentCode: "521" },
  { code: "5210200", name: "Legal Fee", nameTh: "ค่าที่ปรึกษากฎหมาย", nameZh: "法律顾问费", type: "expense", parentCode: "521" },
  { code: "5210210", name: "Other Professional Fee", nameTh: "ค่าธรรมเนียมวิชาชีพอื่น", nameZh: "其他专业服务费", type: "expense", parentCode: "521" },
  { code: "5210220", name: "Bank Fee", nameTh: "ค่าธรรมเนียมธนาคาร", nameZh: "银行手续费", type: "expense", parentCode: "521" },
  { code: "5210230", name: "License Fee", nameTh: "ค่าธรรมเนียมใบอนุญาต", nameZh: "许可证费", type: "expense", parentCode: "521" },
  { code: "5210240", name: "Property Tax", nameTh: "ภาษีที่ดินและสิ่งปลูกสร้าง", nameZh: "房产税", type: "expense", parentCode: "521" },
  { code: "5210250", name: "Stamp Duty", nameTh: "ค่าอากรแสตมป์", nameZh: "印花税", type: "expense", parentCode: "521" },
  { code: "5210260", name: "Vehicle Tax", nameTh: "ค่าภาษียานพาหนะ", nameZh: "车辆税", type: "expense", parentCode: "521" },
  { code: "5210270", name: "Signboard Tax", nameTh: "ภาษีป้าย", nameZh: "招牌税", type: "expense", parentCode: "521" },
  { code: "5210280", name: "Other Fees", nameTh: "ค่าธรรมเนียมอื่น", nameZh: "其他手续费", type: "expense", parentCode: "521" },
  { code: "5210290", name: "Consulting Fee", nameTh: "ค่าที่ปรึกษา", nameZh: "咨询费", type: "expense", parentCode: "521" },
  { code: "5210300", name: "Insurance Expense", nameTh: "ค่าประกันภัย", nameZh: "保险费", type: "expense", parentCode: "521" },
  { code: "5210310", name: "Office Supply", nameTh: "ค่าวัสดุสำนักงาน", nameZh: "办公用品费", type: "expense", parentCode: "521" },
  { code: "5210320", name: "Stationery", nameTh: "ค่าเครื่องเขียนแบบพิมพ์", nameZh: "文具费", type: "expense", parentCode: "521" },
  { code: "5210330", name: "Repair & Maintenance", nameTh: "ค่าซ่อมแซมและบำรุงรักษา", nameZh: "维修保养费", type: "expense", parentCode: "521" },
  { code: "5210340", name: "Supplies Expense", nameTh: "วัสดุสิ้นเปลือง", nameZh: "物料费", type: "expense", parentCode: "521" },
  { code: "5210350", name: "Membership Fee", nameTh: "ค่าวารสารและสมาชิก", nameZh: "会员费", type: "expense", parentCode: "521" },
  { code: "5210360", name: "Rent Expense", nameTh: "ค่าเช่า", nameZh: "租金费用", type: "expense", parentCode: "521" },
  { code: "5210370", name: "Security Expense", nameTh: "ค่ารักษาความปลอดภัย", nameZh: "安保费", type: "expense", parentCode: "521" },
  { code: "5210380", name: "Cleaning Expense", nameTh: "ค่ารักษาความสะอาด", nameZh: "清洁费", type: "expense", parentCode: "521" },
  { code: "5210390", name: "Central Expense", nameTh: "ค่าใช้จ่ายส่วนกลาง", nameZh: "公共费用", type: "expense", parentCode: "521" },
  { code: "5210400", name: "Training Expense", nameTh: "ค่าฝึกอบรม", nameZh: "培训费", type: "expense", parentCode: "521" },
  { code: "5210410", name: "Employee Welfare - General", nameTh: "สวัสดิการพนักงาน - ทั่วไป", nameZh: "员工福利 - 一般", type: "expense", parentCode: "521" },
  { code: "5210420", name: "Repair & Maintenance - Admin", nameTh: "ค่าซ่อมแซม - บริหาร", nameZh: "维修保养 - 管理", type: "expense", parentCode: "521" },
  { code: "5210430", name: "Third-Party Services", nameTh: "ค่าบริการจากบุคคลภายนอก", nameZh: "外部服务费", type: "expense", parentCode: "521" },
  { code: "5210440", name: "Donation - Taxable", nameTh: "เงินบริจาค-เข้าเกณฑ์", nameZh: "捐赠（可抵税）", type: "expense", parentCode: "521" },
  { code: "5210450", name: "Miscellaneous Expense", nameTh: "ค่าใช้จ่ายเบ็ดเตล็ด", nameZh: "杂项费用", type: "expense", parentCode: "521" },
  { code: "5210460", name: "Excess or Shortage", nameTh: "ส่วนขาดเกินบัญชี", nameZh: "现金溢缺", type: "expense", parentCode: "521" },

  // --- Utilities ---
  { code: "522", name: "Utilities & Communication", nameTh: "ค่าสาธารณูปโภค", nameZh: "水电通讯费", type: "expense", parentCode: null },
  { code: "5220010", name: "Telephone & Internet", nameTh: "ค่าโทรศัพท์และอินเทอร์เน็ต", nameZh: "电话及网络费", type: "expense", parentCode: "522" },
  { code: "5220020", name: "Electricity", nameTh: "ค่าไฟฟ้า", nameZh: "电费", type: "expense", parentCode: "522" },
  { code: "5220030", name: "Water", nameTh: "ค่าน้ำประปา", nameZh: "水费", type: "expense", parentCode: "522" },
  { code: "5220040", name: "Postage & Stamp", nameTh: "ค่าไปรษณีย์และอากรแสตมป์", nameZh: "邮费", type: "expense", parentCode: "522" },

  // --- Depreciation Expense ---
  { code: "530", name: "Depreciation Expense", nameTh: "ค่าเสื่อมราคาและค่าตัดจำหน่าย", nameZh: "折旧费", type: "expense", parentCode: null },
  { code: "5301000", name: "Depreciation - Building", nameTh: "ค่าเสื่อมราคา - อาคาร", nameZh: "折旧 - 建筑物", type: "expense", parentCode: "530" },
  { code: "5301100", name: "Depreciation - Building Improvement", nameTh: "ค่าเสื่อมราคา – อาคารส่วนปรับปรุ่งเพิ่ม", nameZh: "折旧 - 建筑物改良", type: "expense", parentCode: "530" },
  { code: "5301200", name: "Depreciation - Factory Building", nameTh: "ค่าเสื่อมราคา – อาคารโรงงาน", nameZh: "折旧 - 厂房", type: "expense", parentCode: "530" },
  { code: "5301300", name: "Depreciation - Factory Equipment", nameTh: "ค่าเสื่อมราคา – เครื่องมือเครื่องใช้ในโรงงาน", nameZh: "折旧 - 工厂设备", type: "expense", parentCode: "530" },
  { code: "5301400", name: "Depreciation - Machinery", nameTh: "ค่าเสื่อมราคา – เครื่องจักร", nameZh: "折旧 - 机器", type: "expense", parentCode: "530" },
  { code: "5301500", name: "Depreciation - Office Equipment", nameTh: "ค่าเสื่อมราคา - อุปกรณ์สำนักงาน", nameZh: "折旧 - 办公设备", type: "expense", parentCode: "530" },
  { code: "5301600", name: "Depreciation - Vehicles", nameTh: "ค่าเสื่อมราคา – ยานพาหนะ", nameZh: "折旧 - 车辆", type: "expense", parentCode: "530" },
  { code: "5301700", name: "Depreciation - Computer", nameTh: "ค่าเสื่อมราคา – คอมพิวเตอร์", nameZh: "折旧 - 计算机", type: "expense", parentCode: "530" },
  { code: "5301800", name: "Depreciation - Right-of-Use Assets", nameTh: "ค่าเสื่อมราคา – สินทรัพย์สิทธิการใช้", nameZh: "折旧 - 使用权资产", type: "expense", parentCode: "530" },
  { code: "5303000", name: "Other Non-Operating Expenses", nameTh: "ค่าใช้จ่ายนอกดำเนินงานอื่น", nameZh: "其他营业外支出", type: "expense", parentCode: "530" },

  // --- Amortization Expense ---
  { code: "531", name: "Amortization Expense", nameTh: "ค่าตัดจำหน่าย", nameZh: "摊销费", type: "expense", parentCode: null },
  { code: "5311000", name: "Amortization - Software", nameTh: "ค่าตัดจำหน่าย - ซอฟต์แวร์", nameZh: "摊销 - 软件", type: "expense", parentCode: "531" },
  { code: "5311100", name: "Amortization - Copyright", nameTh: "ค่าตัดจำหน่าย – ค่าลิขสิทธิ์", nameZh: "摊销 - 版权", type: "expense", parentCode: "531" },
  { code: "5311200", name: "Amortization - Goodwill", nameTh: "ค่าตัดจำหน่าย – ค่าความนิยม", nameZh: "摊销 - 商誉", type: "expense", parentCode: "531" },
  { code: "5311300", name: "Amortization - Patent", nameTh: "ค่าตัดจำหน่าย – ค่าสิทธิบัตร", nameZh: "摊销 - 专利", type: "expense", parentCode: "531" },

  // --- Allowance for Impairment ---
  { code: "532", name: "Allowance for Impairment", nameTh: "ค่าเผื่อการด้อยค่า", nameZh: "减值损失", type: "expense", parentCode: null },
  { code: "5321000", name: "Bad Debt Expense", nameTh: "หนี้สูญ", nameZh: "坏账损失", type: "expense", parentCode: "532" },
  { code: "5321100", name: "Impairment - Debt", nameTh: "ปรับปรุงหนี้สงสัยจะสูญ", nameZh: "减值 - 应收款", type: "expense", parentCode: "532" },
  { code: "5321200", name: "Impairment - Inventory", nameTh: "ปรับปรุงสินค้าด้อยค่า", nameZh: "减值 - 存货", type: "expense", parentCode: "532" },
  { code: "5321300", name: "Provision - Employee Benefits", nameTh: "ปรับปรุงการตั้งผลประโยชน์พนักงาน", nameZh: "员工福利准备", type: "expense", parentCode: "532" },
  { code: "5321400", name: "Loss on Foreign Exchange", nameTh: "ขาดทุนจากอัตราแลกเปลี่ยน", nameZh: "汇兑损失", type: "expense", parentCode: "532" },

  // --- Financial Charges ---
  { code: "540", name: "Financial Charges", nameTh: "ค่าใช้จ่ายทางการเงิน", nameZh: "财务费用", type: "expense", parentCode: null },
  { code: "5401000", name: "Bank Charges", nameTh: "ค่าธรรมเนียมธนาคาร (ทางการเงิน)", nameZh: "金融手续费", type: "expense", parentCode: "540" },

  // --- Interest Expense ---
  { code: "541", name: "Interest Expense", nameTh: "ดอกเบี้ยจ่าย", nameZh: "利息支出", type: "expense", parentCode: null },
  { code: "5411000", name: "Lease Interest", nameTh: "ดอกเบี้ยตามสัญญาเช่า", nameZh: "租赁利息", type: "expense", parentCode: "541" },

  // --- Insurance Expense ---
  { code: "542", name: "Insurance Expense", nameTh: "ค่าเบี้ยประกันภัย", nameZh: "保险费", type: "expense", parentCode: null },
  { code: "5421000", name: "Insurance - Building", nameTh: "ค่าเบี้ยประกัน - อาคาร", nameZh: "保险费 - 建筑物", type: "expense", parentCode: "542" },
  { code: "5421100", name: "Insurance - Equipment", nameTh: "ค่าเบี้ยประกัน - อุปกรณ์สำนักงาน", nameZh: "保险费 - 办公设备", type: "expense", parentCode: "542" },
  { code: "5421200", name: "Insurance - Furniture", nameTh: "ค่าเบี้ยประกัน - เครื่องตกแต่งสำนักงาน", nameZh: "保险费 - 家具", type: "expense", parentCode: "542" },
  { code: "5421300", name: "Insurance - Vehicles", nameTh: "ค่าเบี้ยประกัน - ยานพาหนะ", nameZh: "保险费 - 车辆", type: "expense", parentCode: "542" },

  // --- Other Expenses ---
  { code: "590", name: "Other Expenses", nameTh: "ค่าใช้จ่ายอื่น", nameZh: "其他费用", type: "expense", parentCode: null },
  { code: "5901000", name: "Interest Expense", nameTh: "ดอกเบี้ยจ่าย", nameZh: "利息支出", type: "expense", parentCode: "590" },
  { code: "5901100", name: "Doubtful Accounts Expense", nameTh: "หนี้สงสัยจะสูญ", nameZh: "坏账准备费用", type: "expense", parentCode: "590" },
  { code: "5901200", name: "Entertainment Expense", nameTh: "ค่ารับรอง", nameZh: "业务招待费", type: "expense", parentCode: "590" },
  { code: "5901300", name: "Donation Expense", nameTh: "ค่าบริจาคการกุศล", nameZh: "捐赠费用", type: "expense", parentCode: "590" },
  { code: "5901400", name: "Discount on Check Sale", nameTh: "ส่วนลดจากการขายลดเช็ค", nameZh: "支票贴现", type: "expense", parentCode: "590" },
  { code: "5901500", name: "Miscellaneous Expense", nameTh: "ค่าใช้จ่ายเบ็ดเตล็ด", nameZh: "杂项费用", type: "expense", parentCode: "590" },
  { code: "5901600", name: "Other Expenses", nameTh: "ค่าใช้จ่ายอื่น", nameZh: "其他费用", type: "expense", parentCode: "590" },
  { code: "5901700", name: "Bad Debts Written Off", nameTh: "หนี้สูญ", nameZh: "坏账核销", type: "expense", parentCode: "590" },

  // --- Non-Deductible Expenses ---
  { code: "591", name: "Non-Deductible Expenses", nameTh: "รายจ่ายต้องห้าม", nameZh: "不可扣除费用", type: "expense", parentCode: null },
  { code: "5911000", name: "Tax Penalty", nameTh: "ค่าปรับภาษี/เบี้ยปรับ", nameZh: "税务罚款", type: "expense", parentCode: "591" },
  { code: "5911100", name: "Unclaimed Input VAT", nameTh: "ภาษีซื้อไม่ขอคืน", nameZh: "不申请退还的进项税额", type: "expense", parentCode: "591" },
  { code: "5911200", name: "Excess Bad Debt Provision", nameTh: "ค่าเผื่อหนี้สูญเกินสิทธิ์", nameZh: "超额坏账准备", type: "expense", parentCode: "591" },
  { code: "5911300", name: "Non-Taxable Donation", nameTh: "เงินบริจาคเกินสิทธิ์", nameZh: "不可抵税捐赠", type: "expense", parentCode: "591" },
  { code: "5911400", name: "Expense without Documents", nameTh: "รายจ่ายที่ไม่มีใบเสร็จ", nameZh: "无凭证费用", type: "expense", parentCode: "591" },
  { code: "5911500", name: "Unidentified Expense", nameTh: "รายจ่ายที่ไม่สามารถระบุได้", nameZh: "不明费用", type: "expense", parentCode: "591" },
  { code: "5911600", name: "Prior Year Expense", nameTh: "ค่าใช้จ่ายปีก่อน", nameZh: "以前年度费用", type: "expense", parentCode: "591" },
  { code: "5911700", name: "Personal Expense", nameTh: "รายจ่ายส่วนตัว", nameZh: "个人费用", type: "expense", parentCode: "591" },
  { code: "5911800", name: "Excess Entertainment", nameTh: "ค่ารับรองเกินกำหนด", nameZh: "超额招待费", type: "expense", parentCode: "591" },
  { code: "5911900", name: "Excess Depreciation", nameTh: "ค่าเสื่อมราคาส่วนเกิน", nameZh: "超额折旧", type: "expense", parentCode: "591" },
  { code: "5919000", name: "Input VAT Non-Refundable", nameTh: "ภาษีซื้อขอคืนไม่ได้", nameZh: "不可退还的进项税额", type: "expense", parentCode: "591" },
  { code: "5919999", name: "Uncategorized Expense", nameTh: "รายจ่ายต้องห้ามอื่น", nameZh: "其他不可扣除费用", type: "expense", parentCode: "591" },

  // --- Corporate Income Tax ---
  { code: "592", name: "Corporate Income Tax", nameTh: "ภาษีเงินได้นิติบุคคล", nameZh: "企业所得税", type: "expense", parentCode: null },
  { code: "5921000", name: "Corporate Income Tax", nameTh: "ภาษีเงินได้นิติบุคคล", nameZh: "企业所得税", type: "expense", parentCode: "592" },

  // --- Operational Statistics ---
  { code: "900", name: "Operational Statistics", nameTh: "สถิติการดำเนินงาน", nameZh: "运营统计", type: "equity", parentCode: null },
  { code: "9001000", name: "Customer Count", nameTh: "จำนวนลูกค้า", nameZh: "客户数", type: "equity", parentCode: "900" },
  { code: "9002000", name: "Occupancy by SQM", nameTh: "พื้นที่ใช้งาน (ตร.ม.)", nameZh: "使用面积（平方米）", type: "equity", parentCode: "900" },
  { code: "9003000", name: "Logistics Weight", nameTh: "น้ำหนักขนส่ง", nameZh: "物流重量", type: "equity", parentCode: "900" },
  { code: "9009999", name: "Clearing Cover & Units", nameTh: "หน่วยครอบคลุมและเคลียร์", nameZh: "清算单位", type: "equity", parentCode: "900" },
];

export const ECOMMERCE_EXTRA_ACCOUNTS: ChartAccountTemplate[] = [
  // --- Marketplace Wallet ---
  { code: "104", name: "Marketplace Wallet", nameTh: "เงินฝากแพลตฟอร์ม", nameZh: "电商平台钱包", type: "asset", parentCode: "100" },
  { code: "1041000", name: "Shopee Wallet", nameTh: "เงินฝาก Shopee Wallet", nameZh: "Shopee钱包", type: "asset", parentCode: "104" },
  { code: "1042000", name: "Lazada Wallet", nameTh: "เงินฝาก Lazada Wallet", nameZh: "Lazada钱包", type: "asset", parentCode: "104" },
  { code: "1043000", name: "TikTok Shop Wallet", nameTh: "เงินฝาก TikTok Shop Wallet", nameZh: "TikTok Shop钱包", type: "asset", parentCode: "104" },
  { code: "1044000", name: "Other Marketplace Wallet", nameTh: "เงินฝากแพลตฟอร์มอื่น", nameZh: "其他平台钱包", type: "asset", parentCode: "104" },

  // --- Marketplace Receivable ---
  { code: "123", name: "Marketplace Receivable", nameTh: "ลูกหนี้แพลตฟอร์ม", nameZh: "电商平台应收款", type: "asset", parentCode: null },
  { code: "1231000", name: "Shopee Receivable", nameTh: "ลูกหนี้ Shopee", nameZh: "Shopee应收款", type: "asset", parentCode: "123" },
  { code: "1232000", name: "Lazada Receivable", nameTh: "ลูกหนี้ Lazada", nameZh: "Lazada应收款", type: "asset", parentCode: "123" },
  { code: "1233000", name: "TikTok Shop Receivable", nameTh: "ลูกหนี้ TikTok Shop", nameZh: "TikTok Shop应收款", type: "asset", parentCode: "123" },
  { code: "1234000", name: "Other Marketplace Receivable", nameTh: "ลูกหนี้แพลตฟอร์มอื่น", nameZh: "其他平台应收款", type: "asset", parentCode: "123" },

  // --- E-Commerce Sales Revenue ---
  { code: "401", name: "E-Commerce Sales", nameTh: "รายได้จากการขายออนไลน์", nameZh: "电商销售收入", type: "revenue", parentCode: "400" },
  { code: "4011000", name: "Shopee Sales", nameTh: "รายได้จากการขาย Shopee", nameZh: "Shopee销售收入", type: "revenue", parentCode: "401" },
  { code: "4012000", name: "Lazada Sales", nameTh: "รายได้จากการขาย Lazada", nameZh: "Lazada销售收入", type: "revenue", parentCode: "401" },
  { code: "4013000", name: "TikTok Shop Sales", nameTh: "รายได้จากการขาย TikTok Shop", nameZh: "TikTok Shop销售收入", type: "revenue", parentCode: "401" },
  { code: "4014000", name: "Website/Direct Sales", nameTh: "รายได้จากเว็บไซต์/ขายตรง", nameZh: "网站/直销收入", type: "revenue", parentCode: "401" },
  { code: "4015000", name: "LINE Shopping Sales", nameTh: "รายได้จากการขาย LINE Shopping", nameZh: "LINE Shopping销售收入", type: "revenue", parentCode: "401" },
  { code: "4016000", name: "Facebook Sales", nameTh: "รายได้จากการขาย Facebook", nameZh: "Facebook销售收入", type: "revenue", parentCode: "401" },

  { code: "4210000", name: "Platform Shipping Subsidy", nameTh: "เงินอุดหนุนค่าขนส่งแพลตฟอร์ม", nameZh: "平台运费补贴", type: "revenue", parentCode: "420" },

  // --- Accrued Marketplace Expenses ---
  { code: "235", name: "Accrued Marketplace Expenses", nameTh: "ค่าใช้จ่ายค้างจ่ายแพลตฟอร์ม", nameZh: "电商平台应计费用", type: "liability", parentCode: null },
  { code: "2351000", name: "Accrued Shopee Fees", nameTh: "ค่าใช้จ่ายค้างจ่าย Shopee", nameZh: "Shopee应计费用", type: "liability", parentCode: "235" },
  { code: "2352000", name: "Accrued Lazada Fees", nameTh: "ค่าใช้จ่ายค้างจ่าย Lazada", nameZh: "Lazada应计费用", type: "liability", parentCode: "235" },
  { code: "2353000", name: "Accrued TikTok Shop Fees", nameTh: "ค่าใช้จ่ายค้างจ่าย TikTok Shop", nameZh: "TikTok Shop应计费用", type: "liability", parentCode: "235" },
  { code: "2354000", name: "Accrued Other Marketplace Fees", nameTh: "ค่าใช้จ่ายค้างจ่ายแพลตฟอร์มอื่น", nameZh: "其他平台应计费用", type: "liability", parentCode: "235" },

  // --- E-Commerce Selling Expenses ---
  { code: "523", name: "E-Commerce Expenses", nameTh: "ค่าใช้จ่าย E-Commerce", nameZh: "电商费用", type: "expense", parentCode: null },
  { code: "5230100", name: "Platform Subscription", nameTh: "ค่าสมาชิกแพลตฟอร์ม", nameZh: "平台订阅费", type: "expense", parentCode: "523" },
  { code: "5230200", name: "Return & Refund Cost", nameTh: "ค่าใช้จ่ายคืนสินค้า/คืนเงิน", nameZh: "退货退款费用", type: "expense", parentCode: "523" },
  { code: "5230300", name: "Packaging Expense", nameTh: "ค่าบรรจุภัณฑ์/แพ็คสินค้า", nameZh: "包装费用", type: "expense", parentCode: "523" },
  { code: "5230400", name: "Photography & Content", nameTh: "ค่าถ่ายภาพและทำคอนเทนต์", nameZh: "摄影及内容制作费", type: "expense", parentCode: "523" },

  // --- Marketplace Commission ---
  { code: "524", name: "Marketplace Commission", nameTh: "ค่าคอมมิชชั่น Marketplace", nameZh: "平台佣金", type: "expense", parentCode: null },
  { code: "5241000", name: "Shopee Commission", nameTh: "ค่าคอมมิชชั่น Shopee", nameZh: "Shopee佣金", type: "expense", parentCode: "524" },
  { code: "5242000", name: "Lazada Commission", nameTh: "ค่าคอมมิชชั่น Lazada", nameZh: "Lazada佣金", type: "expense", parentCode: "524" },
  { code: "5243000", name: "TikTok Shop Commission", nameTh: "ค่าคอมมิชชั่น TikTok Shop", nameZh: "TikTok Shop佣金", type: "expense", parentCode: "524" },
  { code: "5244000", name: "Other Marketplace Commission", nameTh: "ค่าคอมมิชชั่นแพลตฟอร์มอื่น", nameZh: "其他平台佣金", type: "expense", parentCode: "524" },

  // --- Platform Service Fees ---
  { code: "525", name: "Platform Service Fees", nameTh: "ค่าบริการแพลตฟอร์ม", nameZh: "平台服务费", type: "expense", parentCode: null },
  { code: "5251000", name: "Shopee Service Fee", nameTh: "ค่าบริการ Shopee", nameZh: "Shopee服务费", type: "expense", parentCode: "525" },
  { code: "5252000", name: "Lazada Service Fee", nameTh: "ค่าบริการ Lazada", nameZh: "Lazada服务费", type: "expense", parentCode: "525" },
  { code: "5253000", name: "TikTok Shop Service Fee", nameTh: "ค่าบริการ TikTok Shop", nameZh: "TikTok Shop服务费", type: "expense", parentCode: "525" },

  // --- E-Commerce Shipping Costs ---
  { code: "526", name: "E-Commerce Shipping Costs", nameTh: "ค่าขนส่ง E-Commerce", nameZh: "电商运费", type: "expense", parentCode: null },
  { code: "5261000", name: "Shipping - Flash Express", nameTh: "ค่าขนส่ง Flash Express", nameZh: "Flash Express运费", type: "expense", parentCode: "526" },
  { code: "5262000", name: "Shipping - Kerry Express", nameTh: "ค่าขนส่ง Kerry Express", nameZh: "Kerry Express运费", type: "expense", parentCode: "526" },
  { code: "5263000", name: "Shipping - Thailand Post", nameTh: "ค่าขนส่ง ไปรษณีย์ไทย", nameZh: "泰国邮政运费", type: "expense", parentCode: "526" },
  { code: "5264000", name: "Shipping - J&T Express", nameTh: "ค่าขนส่ง J&T Express", nameZh: "J&T Express运费", type: "expense", parentCode: "526" },
  { code: "5265000", name: "Shipping - SPX Express", nameTh: "ค่าขนส่ง SPX Express", nameZh: "SPX Express运费", type: "expense", parentCode: "526" },
  { code: "5269000", name: "Shipping - Other", nameTh: "ค่าขนส่งอื่น", nameZh: "其他运费", type: "expense", parentCode: "526" },

  // --- Marketplace Advertising ---
  { code: "527", name: "Marketplace Advertising", nameTh: "ค่าโฆษณา Marketplace", nameZh: "平台广告费", type: "expense", parentCode: null },
  { code: "5271000", name: "Shopee Ads", nameTh: "ค่าโฆษณา Shopee Ads", nameZh: "Shopee广告费", type: "expense", parentCode: "527" },
  { code: "5272000", name: "Lazada Sponsored", nameTh: "ค่าโฆษณา Lazada Sponsored", nameZh: "Lazada推广费", type: "expense", parentCode: "527" },
  { code: "5273000", name: "TikTok Ads", nameTh: "ค่าโฆษณา TikTok Ads", nameZh: "TikTok广告费", type: "expense", parentCode: "527" },
  { code: "5274000", name: "Facebook/Meta Ads", nameTh: "ค่าโฆษณา Facebook/Meta", nameZh: "Facebook/Meta广告费", type: "expense", parentCode: "527" },
  { code: "5275000", name: "Google Ads", nameTh: "ค่าโฆษณา Google Ads", nameZh: "Google广告费", type: "expense", parentCode: "527" },

  // --- Warehouse & Fulfillment ---
  { code: "528", name: "Warehouse & Fulfillment", nameTh: "ค่าคลังสินค้าและจัดส่ง", nameZh: "仓储及履约费", type: "expense", parentCode: null },
  { code: "5281000", name: "Warehouse Rent", nameTh: "ค่าเช่าคลังสินค้า", nameZh: "仓库租金", type: "expense", parentCode: "528" },
  { code: "5282000", name: "Fulfillment Fee", nameTh: "ค่าบริการ Fulfillment", nameZh: "履约服务费", type: "expense", parentCode: "528" },

  // --- Estimated Platform Expenses ---
  { code: "529", name: "Estimated Platform Expenses", nameTh: "ประมาณการค่าใช้จ่ายแพลตฟอร์ม", nameZh: "预估平台费用", type: "expense", parentCode: null },
  { code: "5291000", name: "Estimated Commission", nameTh: "ประมาณการค่าคอมมิชชั่น", nameZh: "预估佣金", type: "expense", parentCode: "529" },
  { code: "5292000", name: "Estimated Service Fee", nameTh: "ประมาณการค่าบริการแพลตฟอร์ม", nameZh: "预估平台服务费", type: "expense", parentCode: "529" },
  { code: "5293000", name: "Estimated Infrastructure Fee", nameTh: "ประมาณการค่าโครงสร้างพื้นฐาน", nameZh: "预估平台基础设施费", type: "expense", parentCode: "529" },
  { code: "5294000", name: "Estimated Transaction Fee", nameTh: "ประมาณการค่าธรรมเนียมธุรกรรม", nameZh: "预估交易手续费", type: "expense", parentCode: "529" },
  { code: "5295000", name: "Estimated Shipping Cost", nameTh: "ประมาณการค่าขนส่ง", nameZh: "预估运费", type: "expense", parentCode: "529" },
  { code: "5296000", name: "Buyer Refund Expense", nameTh: "ค่าใช้จ่ายเงินคืนผู้ซื้อ", nameZh: "买家退款费用", type: "expense", parentCode: "529" },
  { code: "5297000", name: "Seller Shipping Promotion", nameTh: "โปรโมชั่นค่าส่งผู้ขาย", nameZh: "卖家运费促销", type: "expense", parentCode: "529" },
  { code: "5298000", name: "Return Shipping Cost", nameTh: "ค่าจัดส่งสินค้าคืน", nameZh: "退货运费", type: "expense", parentCode: "529" },

  // --- WHT Receivable from Platform ---
  { code: "114", name: "Withholding Tax Receivable", nameTh: "ภาษีหัก ณ ที่จ่ายรอเครดิต", nameZh: "预扣税待抵扣", type: "asset", parentCode: null },
  { code: "1143000", name: "WHT from E-Commerce Platform", nameTh: "ภาษีหัก ณ ที่จ่ายจากแพลตฟอร์ม", nameZh: "电商平台预扣税", type: "asset", parentCode: "114" },
];

export const ACCOUNTING_FIRM_EXTRA_ACCOUNTS: ChartAccountTemplate[] = [
  // --- Service Fee Receivable ---
  { code: "124", name: "Service Fee Receivable", nameTh: "ลูกหนี้ค่าบริการ", nameZh: "应收服务费", type: "asset", parentCode: null },
  { code: "1241000", name: "Accounting Fee Receivable", nameTh: "ลูกหนี้ค่าทำบัญชี", nameZh: "应收会计费", type: "asset", parentCode: "124" },
  { code: "1242000", name: "Audit Fee Receivable", nameTh: "ลูกหนี้ค่าสอบบัญชี", nameZh: "应收审计费", type: "asset", parentCode: "124" },
  { code: "1243000", name: "Tax Filing Fee Receivable", nameTh: "ลูกหนี้ค่ายื่นภาษี", nameZh: "应收报税费", type: "asset", parentCode: "124" },
  { code: "1244000", name: "Registration Fee Receivable", nameTh: "ลูกหนี้ค่าจดทะเบียน", nameZh: "应收登记费", type: "asset", parentCode: "124" },

  // --- Accounting Service Revenue ---
  { code: "411", name: "Accounting Service Revenue", nameTh: "รายได้ค่าทำบัญชี", nameZh: "会计服务收入", type: "revenue", parentCode: "410" },
  { code: "4111000", name: "Monthly Accounting Fee", nameTh: "รายได้ค่าทำบัญชีรายเดือน", nameZh: "月度会计费收入", type: "revenue", parentCode: "411" },
  { code: "4112000", name: "Year-End Closing Fee", nameTh: "รายได้ค่าปิดงบการเงิน", nameZh: "年度结账费收入", type: "revenue", parentCode: "411" },
  { code: "4113000", name: "Financial Statement Fee", nameTh: "รายได้ค่าจัดทำงบการเงิน", nameZh: "财务报表编制费收入", type: "revenue", parentCode: "411" },

  { code: "412", name: "Audit Service Revenue", nameTh: "รายได้ค่าสอบบัญชี", nameZh: "审计服务收入", type: "revenue", parentCode: "410" },
  { code: "4121000", name: "Audit Service Revenue", nameTh: "รายได้ค่าสอบบัญชี", nameZh: "审计服务收入", type: "revenue", parentCode: "412" },

  { code: "413", name: "Tax Service Revenue", nameTh: "รายได้ค่าบริการภาษี", nameZh: "税务服务收入", type: "revenue", parentCode: "410" },
  { code: "4131000", name: "Monthly Tax Filing Fee", nameTh: "รายได้ค่ายื่นภาษีรายเดือน", nameZh: "月度报税费收入", type: "revenue", parentCode: "413" },
  { code: "4132000", name: "Annual Tax Filing Fee", nameTh: "รายได้ค่ายื่นภาษีประจำปี", nameZh: "年度报税费收入", type: "revenue", parentCode: "413" },
  { code: "4133000", name: "Tax Planning Fee", nameTh: "รายได้ค่าวางแผนภาษี", nameZh: "税务筹划费收入", type: "revenue", parentCode: "413" },

  { code: "4105000", name: "Social Security Service Fee", nameTh: "รายได้ค่าบริการประกันสังคม", nameZh: "社保服务费收入", type: "revenue", parentCode: "410" },
  { code: "4106000", name: "Payroll Service Fee", nameTh: "รายได้ค่าบริการทำเงินเดือน", nameZh: "薪资服务费收入", type: "revenue", parentCode: "410" },
  { code: "4107000", name: "Other Professional Service Fee", nameTh: "รายได้ค่าบริการวิชาชีพอื่น", nameZh: "其他专业服务费收入", type: "revenue", parentCode: "410" },

  { code: "414", name: "Registration Service Revenue", nameTh: "รายได้ค่าจดทะเบียน", nameZh: "登记服务收入", type: "revenue", parentCode: "410" },
  { code: "4141000", name: "Company Registration Fee", nameTh: "รายได้ค่าจดทะเบียนบริษัท", nameZh: "公司注册费收入", type: "revenue", parentCode: "414" },
  { code: "4142000", name: "VAT Registration Fee", nameTh: "รายได้ค่าจดทะเบียน VAT", nameZh: "增值税登记费收入", type: "revenue", parentCode: "414" },
  { code: "4143000", name: "Amendment Registration Fee", nameTh: "รายได้ค่าจดทะเบียนแก้ไขเปลี่ยนแปลง", nameZh: "变更登记费收入", type: "revenue", parentCode: "414" },

  { code: "415", name: "Consulting Fee Revenue", nameTh: "รายได้ค่าที่ปรึกษา", nameZh: "咨询费收入", type: "revenue", parentCode: "410" },
  { code: "4151000", name: "Business Consulting Fee", nameTh: "รายได้ค่าที่ปรึกษาธุรกิจ", nameZh: "商业咨询费收入", type: "revenue", parentCode: "415" },
  { code: "4152000", name: "Financial Consulting Fee", nameTh: "รายได้ค่าที่ปรึกษาการเงิน", nameZh: "财务咨询费收入", type: "revenue", parentCode: "415" },

  // --- Cost of Accounting Services ---
  { code: "511", name: "Cost of Accounting Services", nameTh: "ต้นทุนบริการทำบัญชี", nameZh: "会计服务成本", type: "expense", parentCode: "510" },
  { code: "5111000", name: "Outsource Accountant Fee", nameTh: "ค่าจ้างผู้ทำบัญชีภายนอก", nameZh: "外包会计费", type: "expense", parentCode: "511" },
  { code: "5112000", name: "Outsource Auditor Fee", nameTh: "ค่าจ้างผู้สอบบัญชี (Subcontract)", nameZh: "外包审计费", type: "expense", parentCode: "511" },

  // --- Accounting Firm Operating Expenses ---
  { code: "533", name: "Accounting Firm Operating Expenses", nameTh: "ค่าใช้จ่ายดำเนินงานสำนักงานบัญชี", nameZh: "会计事务所运营费用", type: "expense", parentCode: null },
  { code: "5331000", name: "Accounting Software Subscription", nameTh: "ค่าซอฟต์แวร์บัญชี", nameZh: "会计软件订阅费", type: "expense", parentCode: "533" },
  { code: "5332000", name: "CPD Training Expense", nameTh: "ค่าอบรมพัฒนาความรู้วิชาชีพ (CPD)", nameZh: "持续专业发展培训费", type: "expense", parentCode: "533" },
  { code: "5333000", name: "Professional License Renewal", nameTh: "ค่าต่อทะเบียนผู้ทำบัญชี/ผู้สอบบัญชี", nameZh: "执照续期费", type: "expense", parentCode: "533" },
  { code: "5334000", name: "Professional Association Fee", nameTh: "ค่าสมาชิกสภาวิชาชีพบัญชี", nameZh: "专业协会会费", type: "expense", parentCode: "533" },
  { code: "5335000", name: "DBD e-Filing Fee", nameTh: "ค่าบริการ DBD e-Filing", nameZh: "DBD电子申报费", type: "expense", parentCode: "533" },
  { code: "5336000", name: "Revenue Dept e-Filing Fee", nameTh: "ค่าบริการ RD e-Filing", nameZh: "税务局电子申报费", type: "expense", parentCode: "533" },
  { code: "5337000", name: "Document Storage Expense", nameTh: "ค่าเก็บรักษาเอกสาร", nameZh: "文件保管费", type: "expense", parentCode: "533" },
  { code: "5338000", name: "Client Document Delivery", nameTh: "ค่าจัดส่งเอกสารลูกค้า", nameZh: "客户文件寄送费", type: "expense", parentCode: "533" },
  { code: "5339000", name: "Professional Indemnity Insurance", nameTh: "ค่าประกันภัยวิชาชีพ", nameZh: "职业责任保险费", type: "expense", parentCode: "533" },
];



export const GAS_STATION_EXTRA_ACCOUNTS: ChartAccountTemplate[] = [
  // --- Fuel Inventory ---
  { code: "131", name: "Fuel Inventory", nameTh: "สินค้าคงเหลือ-น้ำมันเชื้อเพลิง", nameZh: "燃油库存", type: "asset", parentCode: "130" },
  { code: "1311000", name: "Gasoline 91", nameTh: "น้ำมันเบนซิน 91", nameZh: "91号汽油", type: "asset", parentCode: "131" },
  { code: "1312000", name: "Gasohol 95", nameTh: "น้ำมันแก๊สโซฮอล์ 95", nameZh: "95号乙醇汽油", type: "asset", parentCode: "131" },
  { code: "1313000", name: "Gasohol E20", nameTh: "น้ำมันแก๊สโซฮอล์ E20", nameZh: "E20乙醇汽油", type: "asset", parentCode: "131" },
  { code: "1314000", name: "Gasohol E85", nameTh: "น้ำมันแก๊สโซฮอล์ E85", nameZh: "E85乙醇汽油", type: "asset", parentCode: "131" },
  { code: "1315000", name: "Diesel B7", nameTh: "น้ำมันดีเซล B7", nameZh: "B7柴油", type: "asset", parentCode: "131" },
  { code: "1316000", name: "Diesel B20", nameTh: "น้ำมันดีเซล B20", nameZh: "B20柴油", type: "asset", parentCode: "131" },
  { code: "1317000", name: "Premium Diesel", nameTh: "น้ำมันดีเซลพรีเมี่ยม", nameZh: "优质柴油", type: "asset", parentCode: "131" },
  { code: "1318000", name: "LPG", nameTh: "ก๊าซ LPG", nameZh: "液化石油气", type: "asset", parentCode: "131" },
  { code: "1319000", name: "Other Fuel", nameTh: "น้ำมันเชื้อเพลิงอื่น", nameZh: "其他燃料", type: "asset", parentCode: "131" },

  // --- Fuel Sales Revenue ---
  { code: "403", name: "Fuel Sales Revenue", nameTh: "รายได้จากการขายน้ำมัน", nameZh: "燃油销售收入", type: "revenue", parentCode: "400" },
  { code: "4031000", name: "Gasoline 91 Sales", nameTh: "รายได้ขายเบนซิน 91", nameZh: "91号汽油销售", type: "revenue", parentCode: "403" },
  { code: "4032000", name: "Gasohol 95 Sales", nameTh: "รายได้ขายแก๊สโซฮอล์ 95", nameZh: "95号乙醇汽油销售", type: "revenue", parentCode: "403" },
  { code: "4033000", name: "Gasohol E20 Sales", nameTh: "รายได้ขายแก๊สโซฮอล์ E20", nameZh: "E20乙醇汽油销售", type: "revenue", parentCode: "403" },
  { code: "4034000", name: "Gasohol E85 Sales", nameTh: "รายได้ขายแก๊สโซฮอล์ E85", nameZh: "E85乙醇汽油销售", type: "revenue", parentCode: "403" },
  { code: "4035000", name: "Diesel B7 Sales", nameTh: "รายได้ขายดีเซล B7", nameZh: "B7柴油销售", type: "revenue", parentCode: "403" },
  { code: "4036000", name: "Diesel B20 Sales", nameTh: "รายได้ขายดีเซล B20", nameZh: "B20柴油销售", type: "revenue", parentCode: "403" },
  { code: "4037000", name: "Premium Diesel Sales", nameTh: "รายได้ขายดีเซลพรีเมี่ยม", nameZh: "优质柴油销售", type: "revenue", parentCode: "403" },
  { code: "4038000", name: "LPG Sales", nameTh: "รายได้ขายก๊าซ LPG", nameZh: "液化石油气销售", type: "revenue", parentCode: "403" },
  { code: "4039000", name: "Other Fuel Sales", nameTh: "รายได้ขายน้ำมันอื่น", nameZh: "其他燃料销售", type: "revenue", parentCode: "403" },

  // --- Minimart/Service Revenue ---
  { code: "404", name: "Minimart & Service Revenue", nameTh: "รายได้ร้านสะดวกซื้อและบริการ", nameZh: "便利店及服务收入", type: "revenue", parentCode: "400" },
  { code: "4041000", name: "Minimart Sales", nameTh: "รายได้ร้านสะดวกซื้อ", nameZh: "便利店销售", type: "revenue", parentCode: "404" },
  { code: "4042000", name: "Car Wash Revenue", nameTh: "รายได้ล้างรถ", nameZh: "洗车收入", type: "revenue", parentCode: "404" },
  { code: "4043000", name: "Lube Service Revenue", nameTh: "รายได้เปลี่ยนถ่ายน้ำมันเครื่อง", nameZh: "润滑油服务收入", type: "revenue", parentCode: "404" },
  { code: "4044000", name: "Space Rental Revenue", nameTh: "รายได้ค่าเช่าพื้นที่", nameZh: "场地租赁收入", type: "revenue", parentCode: "404" },

  // --- Fuel Cost of Goods Sold ---
  { code: "513", name: "Cost of Fuel Sold", nameTh: "ต้นทุนขายน้ำมัน", nameZh: "燃油销售成本", type: "expense", parentCode: "510" },
  { code: "5131000", name: "Cost of Gasoline 91", nameTh: "ต้นทุนเบนซิน 91", nameZh: "91号汽油成本", type: "expense", parentCode: "513" },
  { code: "5132000", name: "Cost of Gasohol 95", nameTh: "ต้นทุนแก๊สโซฮอล์ 95", nameZh: "95号乙醇汽油成本", type: "expense", parentCode: "513" },
  { code: "5133000", name: "Cost of Gasohol E20", nameTh: "ต้นทุนแก๊สโซฮอล์ E20", nameZh: "E20乙醇汽油成本", type: "expense", parentCode: "513" },
  { code: "5134000", name: "Cost of Gasohol E85", nameTh: "ต้นทุนแก๊สโซฮอล์ E85", nameZh: "E85乙醇汽油成本", type: "expense", parentCode: "513" },
  { code: "5135000", name: "Cost of Diesel B7", nameTh: "ต้นทุนดีเซล B7", nameZh: "B7柴油成本", type: "expense", parentCode: "513" },
  { code: "5136000", name: "Cost of Diesel B20", nameTh: "ต้นทุนดีเซล B20", nameZh: "B20柴油成本", type: "expense", parentCode: "513" },
  { code: "5137000", name: "Cost of Premium Diesel", nameTh: "ต้นทุนดีเซลพรีเมี่ยม", nameZh: "优质柴油成本", type: "expense", parentCode: "513" },
  { code: "5138000", name: "Cost of LPG", nameTh: "ต้นทุนก๊าซ LPG", nameZh: "液化石油气成本", type: "expense", parentCode: "513" },

  // --- Oil Loss/Gain ---
  { code: "5139000", name: "Oil Loss (Evaporation)", nameTh: "การสูญเสียน้ำมัน (ระเหย)", nameZh: "油耗损失(蒸发)", type: "expense", parentCode: "513" },
  { code: "4039100", name: "Oil Gain (Surplus)", nameTh: "น้ำมันส่วนเกิน (ได้เพิ่ม)", nameZh: "油料盈余", type: "revenue", parentCode: "403" },

  // --- Gas Station Operating Expenses ---
  { code: "540", name: "Gas Station Expenses", nameTh: "ค่าใช้จ่ายดำเนินงานปั๊มน้ำมัน", nameZh: "加油站运营费用", type: "expense", parentCode: null },
  { code: "5401000", name: "Pump Maintenance", nameTh: "ค่าบำรุงรักษาตู้จ่าย", nameZh: "加油机维修费", type: "expense", parentCode: "540" },
  { code: "5402000", name: "Tank Inspection", nameTh: "ค่าตรวจสอบถังน้ำมัน", nameZh: "油罐检查费", type: "expense", parentCode: "540" },
  { code: "5403000", name: "Environmental Fee", nameTh: "ค่าธรรมเนียมด้านสิ่งแวดล้อม", nameZh: "环保费", type: "expense", parentCode: "540" },
  { code: "5404000", name: "Station Electricity", nameTh: "ค่าไฟฟ้าปั๊ม", nameZh: "加油站电费", type: "expense", parentCode: "540" },
  { code: "5405000", name: "Franchise/License Fee", nameTh: "ค่าสัมปทาน/ใบอนุญาต", nameZh: "特许经营费", type: "expense", parentCode: "540" },

  // --- Local Taxes (ภาษีท้องถิ่น) ---
  { code: "236", name: "Local Tax Payable", nameTh: "ภาษีท้องถิ่นค้างจ่าย", nameZh: "应付地方税", type: "liability", parentCode: null },
  { code: "2361000", name: "Municipal Tax Payable", nameTh: "ภาษีเทศบาลค้างจ่าย", nameZh: "应付市政税", type: "liability", parentCode: "236" },
  { code: "2362000", name: "SAO Tax Payable", nameTh: "ภาษี อบต. ค้างจ่าย", nameZh: "应付乡镇税", type: "liability", parentCode: "236" },
  { code: "5406000", name: "Municipal/Local Tax", nameTh: "ภาษีท้องถิ่น (เทศบาล/อบต.)", nameZh: "地方税(市政/乡镇)", type: "expense", parentCode: "540" },
  { code: "5407000", name: "Excise Tax (Fuel)", nameTh: "ภาษีสรรพสามิตน้ำมัน", nameZh: "燃油消费税", type: "expense", parentCode: "540" },
];

export function getChartOfAccounts(template: string): (ChartAccountTemplate & { isHeader: boolean })[] {
  if (template === "none") return [];
  let list: ChartAccountTemplate[];
  if (template === "ecommerce") {
    list = [...STANDARD_CHART_OF_ACCOUNTS, ...ECOMMERCE_EXTRA_ACCOUNTS];
  } else if (template === "accounting_firm") {
    list = [...STANDARD_CHART_OF_ACCOUNTS, ...ACCOUNTING_FIRM_EXTRA_ACCOUNTS];
  } else if (template === "gas_station") {
    list = [...STANDARD_CHART_OF_ACCOUNTS, ...GAS_STATION_EXTRA_ACCOUNTS];
  } else {
    list = STANDARD_CHART_OF_ACCOUNTS;
  }
  return computeHeaders(list);
}

export const CHART_TEMPLATES = [
  { key: "standard", label: "บัญชีมาตรฐาน", description: "ผังบัญชีมาตรฐานสำหรับธุรกิจทั่วไป (7 หลัก)" },
  { key: "accounting_firm", label: "บัญชีสำนักงานบัญชี", description: "ผังบัญชีสำหรับสำนักงานบัญชี/สอบบัญชี มีรายได้ค่าบริการ ค่าทำบัญชี ค่ายื่นภาษี ค่าจดทะเบียน" },
  { key: "ecommerce", label: "บัญชี E-Commerce", description: "ผังบัญชีสำหรับธุรกิจขายออนไลน์ Shopee/Lazada/TikTok Shop" },
  { key: "service", label: "บัญชีธุรกิจบริการ", description: "ผังบัญชีสำหรับธุรกิจให้บริการ" },
  { key: "trading", label: "บัญชีธุรกิจซื้อมาขายไป", description: "ผังบัญชีสำหรับธุรกิจซื้อขายสินค้า" },
  { key: "gas_station", label: "บัญชีปั๊มน้ำมัน", description: "ผังบัญชีสำหรับธุรกิจปั๊มน้ำมัน สต็อกน้ำมัน ภาษีท้องถิ่น" },
  { key: "none", label: "ไม่นำเข้า", description: "ไม่สร้างผังบัญชีอัตโนมัติ" },
];
