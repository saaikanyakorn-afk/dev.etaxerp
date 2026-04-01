export type TaxIdScheme = "TXID" | "NIDN" | "CCPT" | "OTHR";

export interface EtaxInvoiceData {
  documentType: "TaxInvoice" | "DebitNote" | "CreditNote";
  typeCode: "388" | "T02" | "T03" | "T04" | "80" | "81";
  documentNo: string;
  documentDate: string;
  sellerName: string;
  sellerTaxId: string;
  sellerTaxIdType?: TaxIdScheme;
  sellerBranchId: string;
  sellerAddress: string;
  sellerAddress2?: string;
  sellerPostcode: string;
  sellerBuildingName?: string;
  sellerBuildingNumber?: string;
  sellerPhone?: string;
  sellerEmail?: string;
  sellerDistrictCode?: string;
  sellerSubdistrictCode?: string;
  sellerProvinceCode?: string;
  sellerCountryCode?: string;
  buyerName: string;
  buyerTaxId: string;
  buyerTaxIdType?: TaxIdScheme;
  buyerBranchId: string;
  buyerAddress: string;
  buyerAddress2?: string;
  buyerPostcode: string;
  buyerBuildingName?: string;
  buyerBuildingNumber?: string;
  buyerPhone?: string;
  buyerEmail?: string;
  buyerDistrictCode?: string;
  buyerSubdistrictCode?: string;
  buyerProvinceCode?: string;
  buyerCountryCode?: string;
  currencyCode: string;
  items: EtaxLineItem[];
  subtotal: number;
  discountAmount: number;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;
  withholdingTax?: number;
  originalDocumentNo?: string;
  originalDocumentDate?: string;
  reason?: string;
  paymentMeaning?: string;
}

export interface EtaxLineItem {
  lineNo: number;
  productCode?: string;
  productName: string;
  qty: number;
  unit: string;
  unitPrice: number;
  discount: number;
  total: number;
  vatRate: number;
  vatAmount: number;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatIsoDateTime(dateStr: string): string {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}T00:00:00.000Z`;
  }
  const d = new Date(dateStr);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T00:00:00.000Z`;
}

function formatCreationDateTime(): string {
  const now = new Date();
  return now.toISOString().replace(/\.\d{3}Z$/, ".000Z");
}

function fmt2(n: number): string {
  return n.toFixed(2);
}

const UNIT_CODE_MAP: Record<string, string> = {
  "ชิ้น": "EA",
  "อัน": "EA",
  "ตัว": "EA",
  "เครื่อง": "EA",
  "กล่อง": "BX",
  "แพ็ค": "PK",
  "ถุง": "BG",
  "ขวด": "BO",
  "กระป๋อง": "CA",
  "โหล": "DZ",
  "เมตร": "MTR",
  "เซนติเมตร": "CMT",
  "กิโลกรัม": "KGM",
  "กรัม": "GRM",
  "ลิตร": "LTR",
  "คู่": "PR",
  "ชุด": "SET",
  "งาน": "EA",
  "เดือน": "MON",
  "ครั้ง": "EA",
  "รายการ": "EA",
  "บริการ": "EA",
};

function getUnitCode(unit: string): string {
  return UNIT_CODE_MAP[unit] || unit || "";
}

let _thaiAddressData: any = null;
let _districtByName: Record<string, string> = {};
let _subdistrictByNameDistrict: Record<string, string> = {};
let _provinceByName: Record<string, string> = {};

function loadThaiAddressData() {
  if (_thaiAddressData) return;
  try {
    try {
      _thaiAddressData = require("../server/data/thai-addresses.json");
    } catch {
      const path = require("path");
      _thaiAddressData = require(path.join(process.cwd(), "server/data/thai-addresses.json"));
    }
    for (const [code, d] of Object.entries(_thaiAddressData.districts) as [string, any][]) {
      const cleanName = d.n.replace(/^เขต|^อำเภอ/, "").trim();
      _districtByName[d.n] = code;
      _districtByName[cleanName] = code;
    }
    for (const [code, s] of Object.entries(_thaiAddressData.subdistricts) as [string, any][]) {
      const cleanName = s.n.replace(/^แขวง|^ตำบล/, "").trim();
      _subdistrictByNameDistrict[s.n + "_" + s.d] = code;
      _subdistrictByNameDistrict[cleanName + "_" + s.d] = code;
    }
    for (const [code, name] of Object.entries(_thaiAddressData.provinces) as [string, string][]) {
      _provinceByName[name] = code;
      if (name === "กรุงเทพมหานคร") _provinceByName["กรุงเทพฯ"] = code;
    }
  } catch (_e) {}
}

function isValidTisiCode(code: string | undefined, type: "district" | "subdistrict" | "province"): boolean {
  if (!code) return false;
  if (type === "district") return /^\d{4}$/.test(code);
  if (type === "subdistrict") return /^\d{6}$/.test(code);
  if (type === "province") return /^\d{2}$/.test(code);
  return false;
}

export function resolveTisiCodes(
  districtCode?: string, subdistrictCode?: string, provinceCode?: string,
  address?: string
): { district: string; subdistrict: string; province: string } {
  loadThaiAddressData();

  let district = districtCode || "";
  let subdistrict = subdistrictCode || "";
  let province = provinceCode || "";

  if (isValidTisiCode(district, "district") && isValidTisiCode(subdistrict, "subdistrict") && isValidTisiCode(province, "province")) {
    return { district, subdistrict, province };
  }

  if (!isValidTisiCode(district, "district") && district) {
    const code = _districtByName[district] || _districtByName[district.replace(/^เขต|^อำเภอ/, "").trim()];
    if (code) district = code;
  }

  if (!isValidTisiCode(province, "province") && province) {
    const code = _provinceByName[province] || _provinceByName[province.replace(/^จังหวัด/, "").trim()];
    if (code) province = code;
  }

  if (isValidTisiCode(district, "district") && !isValidTisiCode(province, "province") && _thaiAddressData) {
    const d = _thaiAddressData.districts[district];
    if (d?.p) province = d.p;
  }

  if (!isValidTisiCode(subdistrict, "subdistrict") && subdistrict && isValidTisiCode(district, "district")) {
    const cleanSub = subdistrict.replace(/^แขวง|^ตำบล/, "").trim();
    const code = _subdistrictByNameDistrict[subdistrict + "_" + district] ||
                 _subdistrictByNameDistrict[cleanSub + "_" + district];
    if (code) subdistrict = code;
  }

  if (address && (!isValidTisiCode(district, "district") || !isValidTisiCode(province, "province"))) {
    for (const [name, code] of Object.entries(_districtByName)) {
      if (name.length >= 3 && address.includes(name)) {
        if (!isValidTisiCode(district, "district")) district = code;
        break;
      }
    }
    for (const [name, code] of Object.entries(_provinceByName)) {
      if (name.length >= 3 && address.includes(name)) {
        if (!isValidTisiCode(province, "province")) province = code;
        break;
      }
    }
  }

  if (address && isValidTisiCode(district, "district") && !isValidTisiCode(subdistrict, "subdistrict") && _thaiAddressData) {
    const subsInDistrict = Object.entries(_thaiAddressData.subdistricts as Record<string, any>)
      .filter(([_, s]) => s.d === district);
    for (const [code, s] of subsInDistrict) {
      const cleanName = (s.n as string).replace(/^แขวง|^ตำบล/, "").trim();
      if (address.includes(s.n) || address.includes(cleanName)) {
        subdistrict = code;
        break;
      }
    }
  }

  if (isValidTisiCode(district, "district") && !isValidTisiCode(province, "province") && _thaiAddressData) {
    const d = _thaiAddressData.districts[district];
    if (d?.p) province = d.p;
  }

  if (isValidTisiCode(district, "district") && !isValidTisiCode(subdistrict, "subdistrict") && _thaiAddressData) {
    const firstSub = Object.entries(_thaiAddressData.subdistricts as Record<string, any>)
      .find(([_, s]) => s.d === district);
    if (firstSub) subdistrict = firstSub[0];
  }

  if (province && /^\d$/.test(province)) province = province.padStart(2, "0");
  if (!isValidTisiCode(district, "district")) district = "1001";
  if (!isValidTisiCode(subdistrict, "subdistrict")) subdistrict = "100101";
  if (!isValidTisiCode(province, "province")) province = "10";

  return { district, subdistrict, province };
}

function padBranchId(branchId: string): string {
  const cleaned = branchId.replace(/\D/g, "");
  return cleaned.padStart(5, "0");
}

function formatThaiPhone(phone: string): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (phone.startsWith("+66")) {
    const rest = digits.substring(2);
    return `+66-${rest}`;
  }
  if (digits.startsWith("66") && digits.length >= 11) {
    return `+66-${digits.substring(2)}`;
  }
  if (digits.startsWith("0") && digits.length >= 9) {
    const rest = digits.substring(1);
    return `+66${rest.substring(0, 1)}-${rest.substring(1)}`;
  }
  return `+66-${digits}`;
}

function ensurePostcode(postcode: string): string {
  const cleaned = (postcode || "").replace(/\D/g, "").substring(0, 5);
  if (cleaned.length === 5) return cleaned;
  if (cleaned.length > 0) return cleaned.padStart(5, "0");
  return "00000";
}

function buildPostalAddress(
  postcode: string,
  buildingName: string | undefined,
  address: string,
  address2: string | undefined,
  tisi: { district: string; subdistrict: string; province: string },
  buildingNumber: string | undefined,
  countryCode?: string
): string {
  const country = countryCode || "TH";
  let xml = `
          <ram:PostcodeCode>${ensurePostcode(postcode)}</ram:PostcodeCode>`;
  if (buildingName) {
    xml += `
          <ram:BuildingName>${escapeXml(buildingName)}</ram:BuildingName>`;
  }
  xml += `
          <ram:LineOne>${escapeXml(address)}</ram:LineOne>`;
  xml += `
          <ram:LineTwo>${escapeXml(address2 || "-")}</ram:LineTwo>`;
  xml += `
          <ram:CityName>${tisi.district}</ram:CityName>
          <ram:CitySubDivisionName>${tisi.subdistrict}</ram:CitySubDivisionName>
          <ram:CountryID>${country}</ram:CountryID>
          <ram:CountrySubDivisionID>${tisi.province}</ram:CountrySubDivisionID>
          <ram:BuildingNumber>${escapeXml(buildingNumber || "-")}</ram:BuildingNumber>`;
  return xml;
}

function buildTaxRegistrationId(taxId: string, branchId: string, scheme: TaxIdScheme): string {
  if (scheme === "TXID") {
    return taxId + padBranchId(branchId);
  }
  return taxId;
}

export function generateEtaxXml(data: EtaxInvoiceData): string {
  const docDateIso = formatIsoDateTime(data.documentDate);
  const creationDateIso = formatCreationDateTime();

  const sellerScheme: TaxIdScheme = data.sellerTaxIdType || "TXID";
  const buyerScheme: TaxIdScheme = data.buyerTaxIdType || "TXID";
  const sellerFullTxid = buildTaxRegistrationId(data.sellerTaxId, data.sellerBranchId, sellerScheme);
  const buyerFullTxid = buildTaxRegistrationId(data.buyerTaxId, data.buyerBranchId, buyerScheme);
  const sellerCountry = data.sellerCountryCode || "TH";
  const buyerCountry = data.buyerCountryCode || "TH";

  const DOC_NAME_MAP: Record<string, string> = {
    "388": "ใบกำกับภาษี",
    "T02": "ใบแจ้งหนี้/ใบกำกับภาษี",
    "T03": "ใบเสร็จรับเงิน/ใบกำกับภาษี",
    "T04": "ใบส่งของ/ใบกำกับภาษี",
    "80": "ใบเพิ่มหนี้",
    "81": "ใบลดหนี้",
  };
  const docName = DOC_NAME_MAP[data.typeCode] || "ใบกำกับภาษี";

  const currency = data.currencyCode || "THB";
  const valueBeforeVat = data.subtotal - data.discountAmount;
  const grandTotal = data.totalAmount;

  const sellerTisi = resolveTisiCodes(data.sellerDistrictCode, data.sellerSubdistrictCode, data.sellerProvinceCode, data.sellerAddress);
  const buyerTisi = resolveTisiCodes(data.buyerDistrictCode, data.buyerSubdistrictCode, data.buyerProvinceCode, data.buyerAddress);

  let lineItemsXml = "";
  for (const item of data.items) {
    const unitCode = getUnitCode(item.unit);
    const netAmount = item.total;
    const netIncTax = item.total + item.vatAmount;
    lineItemsXml += `
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>${item.lineNo}</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>${escapeXml(item.productName)}</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:GrossPriceProductTradePrice>
          <ram:ChargeAmount>${fmt2(item.unitPrice)}</ram:ChargeAmount>
        </ram:GrossPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="${unitCode}">${item.qty}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CalculatedRate>${fmt2(item.vatRate)}</ram:CalculatedRate>
          <ram:BasisAmount>${fmt2(netAmount)}</ram:BasisAmount>
          <ram:CalculatedAmount>${fmt2(item.vatAmount)}</ram:CalculatedAmount>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeAllowanceCharge>
          <ram:ChargeIndicator>false</ram:ChargeIndicator>
          <ram:ActualAmount>${fmt2(item.discount)}</ram:ActualAmount>
        </ram:SpecifiedTradeAllowanceCharge>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:TaxTotalAmount>${fmt2(item.vatAmount)}</ram:TaxTotalAmount>
          <ram:NetLineTotalAmount currencyID="${currency}">${fmt2(netAmount)}</ram:NetLineTotalAmount>
          <ram:NetIncludingTaxesLineTotalAmount currencyID="${currency}">${fmt2(netIncTax)}</ram:NetIncludingTaxesLineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`;
  }

  const sellerPhoneFmt = formatThaiPhone(data.sellerPhone || "");
  let sellerContactXml = "";
  if (data.sellerEmail || sellerPhoneFmt) {
    sellerContactXml = `
        <ram:DefinedTradeContact>`;
    if (data.sellerEmail) {
      sellerContactXml += `
          <ram:EmailURIUniversalCommunication>
            <ram:URIID>${escapeXml(data.sellerEmail)}</ram:URIID>
          </ram:EmailURIUniversalCommunication>`;
    }
    if (sellerPhoneFmt) {
      sellerContactXml += `
          <ram:TelephoneUniversalCommunication>
            <ram:CompleteNumber>${escapeXml(sellerPhoneFmt)}</ram:CompleteNumber>
          </ram:TelephoneUniversalCommunication>`;
    }
    sellerContactXml += `
        </ram:DefinedTradeContact>`;
  }

  const buyerPhoneFmt = formatThaiPhone(data.buyerPhone || "");
  let buyerContactXml = `
        <ram:DefinedTradeContact>`;
  if (data.buyerName) {
    buyerContactXml += `
          <ram:PersonName>${escapeXml(data.buyerName)}</ram:PersonName>`;
  }
  if (data.buyerEmail) {
    buyerContactXml += `
          <ram:EmailURIUniversalCommunication>
            <ram:URIID>${escapeXml(data.buyerEmail)}</ram:URIID>
          </ram:EmailURIUniversalCommunication>`;
  }
  if (buyerPhoneFmt) {
    buyerContactXml += `
          <ram:TelephoneUniversalCommunication>
            <ram:CompleteNumber>${escapeXml(buyerPhoneFmt)}</ram:CompleteNumber>
          </ram:TelephoneUniversalCommunication>`;
  }
  buyerContactXml += `
        </ram:DefinedTradeContact>`;

  let refDocXml = "";
  if (data.originalDocumentNo) {
    refDocXml = `
      <ram:AdditionalReferencedDocument>
        <ram:IssuerAssignedID>${escapeXml(data.originalDocumentNo)}</ram:IssuerAssignedID>
        ${data.originalDocumentDate ? `<ram:IssueDateTime>${formatIsoDateTime(data.originalDocumentDate)}</ram:IssueDateTime>` : ""}
      </ram:AdditionalReferencedDocument>`;
  }

  const sellerAddr = buildPostalAddress(data.sellerPostcode, data.sellerBuildingName, data.sellerAddress, data.sellerAddress2, sellerTisi, data.sellerBuildingNumber, sellerCountry);
  const buyerAddr = buildPostalAddress(data.buyerPostcode, data.buyerBuildingName, data.buyerAddress, data.buyerAddress2, buyerTisi, data.buyerBuildingNumber, buyerCountry);

  const buyerShipAddr = buildPostalAddress(data.buyerPostcode, undefined, data.buyerAddress, undefined, buyerTisi, data.buyerBuildingNumber, buyerCountry);
  const sellerShipAddr = buildPostalAddress(data.sellerPostcode, data.sellerBuildingName, data.sellerAddress, data.sellerAddress2, sellerTisi, data.sellerBuildingNumber, sellerCountry);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rsm:TaxInvoice_CrossIndustryInvoice
  xmlns:ram="urn:etda:uncefact:data:standard:TaxInvoice_ReusableAggregateBusinessInformationEntity:2"
  xmlns:rsm="urn:etda:uncefact:data:standard:TaxInvoice_CrossIndustryInvoice:2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="urn:etda:uncefact:data:standard:TaxInvoice_CrossIndustryInvoice:2 file:../data/standard/TaxInvoice_CrossIndustryInvoice_2p0.xsd"
>
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID schemeAgencyID="ETDA" schemeVersionID="v2.0">ER3-2560</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${escapeXml(data.documentNo)}</ram:ID>
    <ram:Name>${escapeXml(docName)}</ram:Name>
    <ram:TypeCode>${data.typeCode}</ram:TypeCode>
    <ram:IssueDateTime>${docDateIso}</ram:IssueDateTime>
    <ram:CreationDateTime>${creationDateIso}</ram:CreationDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${escapeXml(data.sellerName)}</ram:Name>
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="${sellerScheme}">${escapeXml(sellerFullTxid)}</ram:ID>
        </ram:SpecifiedTaxRegistration>${sellerContactXml}
        <ram:PostalTradeAddress>${sellerAddr}
        </ram:PostalTradeAddress>
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${escapeXml(data.buyerName)}</ram:Name>
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="${buyerScheme}">${escapeXml(buyerFullTxid)}</ram:ID>
        </ram:SpecifiedTaxRegistration>${buyerContactXml}
        <ram:PostalTradeAddress>${buyerAddr}
        </ram:PostalTradeAddress>
      </ram:BuyerTradeParty>${refDocXml}
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery>
      <ram:ShipToTradeParty>
        <ram:PostalTradeAddress>${buyerShipAddr}
        </ram:PostalTradeAddress>
      </ram:ShipToTradeParty>
      <ram:ShipFromTradeParty>
        <ram:PostalTradeAddress>${sellerShipAddr}
        </ram:PostalTradeAddress>
      </ram:ShipFromTradeParty>
    </ram:ApplicableHeaderTradeDelivery>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>${currency}</ram:InvoiceCurrencyCode>
      <ram:ApplicableTradeTax>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:CalculatedRate>${fmt2(data.vatRate)}</ram:CalculatedRate>
        <ram:BasisAmount>${fmt2(valueBeforeVat)}</ram:BasisAmount>
        <ram:CalculatedAmount>${fmt2(data.vatAmount)}</ram:CalculatedAmount>
      </ram:ApplicableTradeTax>
      <ram:SpecifiedTradeAllowanceCharge>
        <ram:ChargeIndicator>false</ram:ChargeIndicator>
        <ram:ActualAmount>${fmt2(data.discountAmount)}</ram:ActualAmount>
      </ram:SpecifiedTradeAllowanceCharge>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${fmt2(data.subtotal)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${fmt2(valueBeforeVat)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount>${fmt2(data.vatAmount)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${fmt2(grandTotal)}</ram:GrandTotalAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>${lineItemsXml}
  </rsm:SupplyChainTradeTransaction>
</rsm:TaxInvoice_CrossIndustryInvoice>`;

  return xml;
}

export function generateEtaxXmpMetadata(data: {
  documentType: string;
  xmlFileName: string;
  creationDate?: Date;
}): string {
  const docTypeLabel = data.documentType === "TaxInvoice" ? "Tax Invoice"
    : data.documentType === "DebitNote" ? "Debit Note"
    : "Credit Note";

  const now = data.creationDate || new Date();
  const isoDate = now.toISOString().replace(/\.\d{3}Z$/, "+00:00");

  return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:dc="http://purl.org/dc/elements/1.1/"
      xmlns:pdf="http://ns.adobe.com/pdf/1.3/"
      xmlns:xmp="http://ns.adobe.com/xap/1.0/"
      xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
      <dc:format>application/pdf</dc:format>
      <pdfaid:part>3</pdfaid:part>
      <pdfaid:conformance>U</pdfaid:conformance>
    </rdf:Description>
    <rdf:Description rdf:about=""
      xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/"
      xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#"
      xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#">
      <pdfaExtension:schemas>
        <rdf:Bag>
          <rdf:li rdf:parseType="Resource">
            <pdfaSchema:schema>Electronic Tax Invoice PDFA Extension Schema</pdfaSchema:schema>
            <pdfaSchema:namespaceURI>urn:etda:uncefact:data:standard:Invoice_CrossIndustryInvoice:2#</pdfaSchema:namespaceURI>
            <pdfaSchema:prefix>rsm</pdfaSchema:prefix>
            <pdfaSchema:property>
              <rdf:Seq>
                <rdf:li rdf:parseType="Resource">
                  <pdfaProperty:name>DocumentFileName</pdfaProperty:name>
                  <pdfaProperty:valueType>Text</pdfaProperty:valueType>
                  <pdfaProperty:category>external</pdfaProperty:category>
                  <pdfaProperty:description>Name of the embedded XML invoice file</pdfaProperty:description>
                </rdf:li>
                <rdf:li rdf:parseType="Resource">
                  <pdfaProperty:name>DocumentType</pdfaProperty:name>
                  <pdfaProperty:valueType>Text</pdfaProperty:valueType>
                  <pdfaProperty:category>external</pdfaProperty:category>
                  <pdfaProperty:description>Type of the document</pdfaProperty:description>
                </rdf:li>
                <rdf:li rdf:parseType="Resource">
                  <pdfaProperty:name>Version</pdfaProperty:name>
                  <pdfaProperty:valueType>Text</pdfaProperty:valueType>
                  <pdfaProperty:category>external</pdfaProperty:category>
                  <pdfaProperty:description>Version of the ETDA XML data</pdfaProperty:description>
                </rdf:li>
              </rdf:Seq>
            </pdfaSchema:property>
          </rdf:li>
        </rdf:Bag>
      </pdfaExtension:schemas>
    </rdf:Description>
    <rdf:Description rdf:about=""
      xmlns:rsm="urn:etda:uncefact:data:standard:Invoice_CrossIndustryInvoice:2#">
      <rsm:DocumentFileName>${escapeXml(data.xmlFileName)}</rsm:DocumentFileName>
      <rsm:DocumentType>${docTypeLabel}</rsm:DocumentType>
      <rsm:Version>2.0</rsm:Version>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="r"?>`;
}
