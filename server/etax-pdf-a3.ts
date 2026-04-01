import { PDFDocument, PDFName, PDFString, PDFArray, PDFHexString, PDFDict, PDFStream } from "pdf-lib";
import { generateEtaxXmpMetadata } from "@shared/etax-xml";
import { execFile } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

async function convertToPdfA3WithGhostscript(
  pdfBuffer: Buffer,
  iccPath: string
): Promise<Buffer> {
  const tmpDir = os.tmpdir();
  const ts = Date.now();
  const inputPath = path.join(tmpDir, `gs_input_${ts}.pdf`);
  const outputPath = path.join(tmpDir, `gs_output_${ts}.pdf`);

  fs.writeFileSync(inputPath, pdfBuffer);

  const pdfaDefPs = path.join(tmpDir, `PDFA_def_${ts}.ps`);
  fs.writeFileSync(pdfaDefPs, `
% PDF/A-3 definition for Ghostscript
/ICCProfile (${iccPath.replace(/\\/g, "/")}) def
[
  /Title (e-Tax Invoice)
  /DOCINFO pdfmark
[
  /ICCProfile ICCProfile
  /OutputCondition (sRGB IEC61966-2.1)
  /OutputConditionIdentifier (sRGB IEC61966-2.1)
  /RegistryName (http://www.color.org)
  /Info (sRGB IEC61966-2.1)
  /OutputIntents pdfmark
`);

  return new Promise<Buffer>((resolve, reject) => {
    const args = [
      "-dPDFA=3",
      "-dBATCH",
      "-dNOPAUSE",
      "-dNOOUTERSAVE",
      "-dPDFACompatibilityPolicy=1",
      "-dCompressFonts=true",
      "-dSubsetFonts=true",
      "-dEmbedAllFonts=true",
      "-sColorConversionStrategy=UseDeviceIndependentColor",
      "-sDEVICE=pdfwrite",
      "-dAutoRotatePages=/None",
      `-sOutputFile=${outputPath}`,
      pdfaDefPs,
      inputPath,
    ];

    execFile("gs", args, { timeout: 60000, maxBuffer: 50 * 1024 * 1024 }, (error, _stdout, stderr) => {
      try { fs.unlinkSync(inputPath); } catch {}
      try { fs.unlinkSync(pdfaDefPs); } catch {}

      if (error) {
        try { fs.unlinkSync(outputPath); } catch {}
        console.error("[GS] Ghostscript PDF/A-3 conversion failed:", stderr);
        reject(new Error(`Ghostscript PDF/A-3 conversion failed: ${error.message}`));
        return;
      }

      try {
        const result = fs.readFileSync(outputPath);
        fs.unlinkSync(outputPath);
        resolve(result);
      } catch (readErr: any) {
        reject(new Error(`Failed to read GS output: ${readErr.message}`));
      }
    });
  });
}

export async function convertToPdfA3(
  pdfBuffer: Buffer,
  xmlContent: string,
  xmlFileName: string,
  documentType: "TaxInvoice" | "DebitNote" | "CreditNote"
): Promise<Buffer> {
  const iccPath = path.join(process.cwd(), "server", "assets", "sRGB2014.icc");
  const iccProfile = loadSrgbIccProfile(iccPath);

  let pdfABuffer: Buffer;
  try {
    pdfABuffer = await convertToPdfA3WithGhostscript(pdfBuffer, iccPath);
    console.log(`[PDF/A-3] Ghostscript conversion OK: ${pdfBuffer.length} → ${pdfABuffer.length} bytes`);
  } catch (err: any) {
    console.error(`[PDF/A-3] Ghostscript failed, building PDF/A-3 manually: ${err.message}`);
    pdfABuffer = pdfBuffer;
  }

  const pdfDoc = await PDFDocument.load(pdfABuffer);
  const context = pdfDoc.context;
  const catalog = pdfDoc.catalog;

  const xmlBytes = Buffer.from(xmlContent, "utf-8");
  const now = new Date();
  const pdfDateStr = formatPdfDate(now);

  const paramsDict = context.obj({});
  paramsDict.set(PDFName.of("Size"), context.obj(xmlBytes.length));
  paramsDict.set(PDFName.of("CreationDate"), PDFString.of(pdfDateStr));
  paramsDict.set(PDFName.of("ModDate"), PDFString.of(pdfDateStr));

  const fileStreamDict = new Map<PDFName, any>();
  fileStreamDict.set(PDFName.of("Type"), PDFName.of("EmbeddedFile"));
  fileStreamDict.set(PDFName.of("Subtype"), PDFName.of("text#2Fxml"));
  fileStreamDict.set(PDFName.of("Params"), paramsDict);

  const fileStream = context.stream(xmlBytes, fileStreamDict);
  const fileStreamRef = context.register(fileStream);

  const efDict = context.obj({});
  efDict.set(PDFName.of("F"), fileStreamRef);
  efDict.set(PDFName.of("UF"), fileStreamRef);

  const fileSpecDict = context.obj({});
  fileSpecDict.set(PDFName.of("Type"), PDFName.of("Filespec"));
  fileSpecDict.set(PDFName.of("F"), PDFString.of(xmlFileName));
  fileSpecDict.set(PDFName.of("UF"), PDFHexString.fromText(xmlFileName));
  fileSpecDict.set(PDFName.of("EF"), efDict);
  fileSpecDict.set(PDFName.of("AFRelationship"), PDFName.of("Alternative"));
  fileSpecDict.set(PDFName.of("Desc"), PDFString.of("Tax Invoice XML Data"));

  const fileSpecRef = context.register(fileSpecDict);

  const namesDict = context.obj({});
  const embeddedFilesArray = PDFArray.withContext(context);
  embeddedFilesArray.push(PDFHexString.fromText(xmlFileName));
  embeddedFilesArray.push(fileSpecRef);
  namesDict.set(PDFName.of("Names"), embeddedFilesArray);

  const nameTreeDict = context.obj({});
  nameTreeDict.set(PDFName.of("EmbeddedFiles"), context.register(namesDict));
  catalog.set(PDFName.of("Names"), context.register(nameTreeDict));

  const afArray = PDFArray.withContext(context);
  afArray.push(fileSpecRef);
  catalog.set(PDFName.of("AF"), afArray);

  catalog.set(PDFName.of("MarkInfo"), context.obj({ Marked: true }));
  catalog.set(PDFName.of("Lang"), PDFString.of("th-TH"));

  const viewerPrefs = context.obj({});
  viewerPrefs.set(PDFName.of("DisplayDocTitle"), context.obj(true));
  catalog.set(PDFName.of("ViewerPreferences"), viewerPrefs);

  const xmpXml = generateEtaxXmpMetadata({ documentType, xmlFileName, creationDate: now });
  const xmpBytes = Buffer.from(xmpXml, "utf-8");

  const xmpStreamDict = new Map<PDFName, any>();
  xmpStreamDict.set(PDFName.of("Type"), PDFName.of("Metadata"));
  xmpStreamDict.set(PDFName.of("Subtype"), PDFName.of("XML"));
  xmpStreamDict.set(PDFName.of("Length"), context.obj(xmpBytes.length));

  const xmpStream = context.stream(xmpBytes, xmpStreamDict);
  const xmpStreamRef = context.register(xmpStream);
  catalog.set(PDFName.of("Metadata"), xmpStreamRef);

  const existingIntents = catalog.lookup(PDFName.of("OutputIntents"));
  if (!existingIntents) {
    const outputIntentDict = context.obj({});
    outputIntentDict.set(PDFName.of("Type"), PDFName.of("OutputIntent"));
    outputIntentDict.set(PDFName.of("S"), PDFName.of("GTS_PDFA1"));
    outputIntentDict.set(PDFName.of("OutputConditionIdentifier"), PDFString.of("sRGB IEC61966-2.1"));
    outputIntentDict.set(PDFName.of("RegistryName"), PDFString.of("http://www.color.org"));
    outputIntentDict.set(PDFName.of("Info"), PDFString.of("sRGB IEC61966-2.1"));

    const iccStreamDict = new Map<PDFName, any>();
    iccStreamDict.set(PDFName.of("N"), context.obj(3));
    iccStreamDict.set(PDFName.of("Length"), context.obj(iccProfile.length));
    const iccStream = context.stream(iccProfile, iccStreamDict);
    const iccStreamRef = context.register(iccStream);
    outputIntentDict.set(PDFName.of("DestOutputProfile"), iccStreamRef);

    const outputIntentRef = context.register(outputIntentDict);
    const outputIntentsArray = PDFArray.withContext(context);
    outputIntentsArray.push(outputIntentRef);
    catalog.set(PDFName.of("OutputIntents"), outputIntentsArray);
  }

  const resultBytes = await pdfDoc.save();
  return Buffer.from(resultBytes);
}

function formatPdfDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  const mm = pad(d.getUTCMonth() + 1);
  const dd = pad(d.getUTCDate());
  const hh = pad(d.getUTCHours());
  const mi = pad(d.getUTCMinutes());
  const ss = pad(d.getUTCSeconds());
  return `D:${yyyy}${mm}${dd}${hh}${mi}${ss}+00'00'`;
}

function loadSrgbIccProfile(iccPath: string): Uint8Array {
  try {
    if (fs.existsSync(iccPath)) {
      const data = new Uint8Array(fs.readFileSync(iccPath));
      const sig = String.fromCharCode(data[36], data[37], data[38], data[39]);
      if (sig === "acsp" && data.length > 400) {
        console.log(`[PDF/A-3] Loaded ICC profile: ${data.length} bytes`);
        return data;
      }
    }
  } catch {}
  console.warn("[PDF/A-3] ICC profile not found, generating minimal sRGB profile");
  return generateMinimalSrgbIcc();
}

function generateMinimalSrgbIcc(): Uint8Array {
  function s15f16(val: number): number { return Math.round(val * 65536) | 0; }
  function writeXYZ(buf: Buffer, off: number, x: number, y: number, z: number) {
    buf.write("XYZ ", off, 4, "ascii");
    buf.writeUInt32BE(0, off + 4);
    buf.writeInt32BE(s15f16(x), off + 8);
    buf.writeInt32BE(s15f16(y), off + 12);
    buf.writeInt32BE(s15f16(z), off + 16);
  }
  function writeCurve(buf: Buffer, off: number, gamma: number) {
    buf.write("curv", off, 4, "ascii");
    buf.writeUInt32BE(0, off + 4);
    buf.writeUInt32BE(1, off + 8);
    buf.writeUInt16BE(Math.round(gamma * 256), off + 12);
  }
  function writeDesc(buf: Buffer, off: number, text: string) {
    buf.write("desc", off, 4, "ascii");
    buf.writeUInt32BE(0, off + 4);
    const tb = Buffer.from(text, "ascii");
    buf.writeUInt32BE(tb.length + 1, off + 8);
    tb.copy(buf, off + 12);
  }

  const tagCount = 9;
  const tagTableSize = 4 + tagCount * 12;
  const headerSize = 128;
  const xyzSize = 20;
  const curvSize = 16;
  const descSize = 48;
  const textSize = 36;

  const dataStart = headerSize + tagTableSize;
  const totalSize = dataStart + 4 * xyzSize + 3 * curvSize + descSize + textSize;
  const buf = Buffer.alloc(totalSize);

  buf.writeUInt32BE(totalSize, 0);
  buf.write("lcms", 4, 4, "ascii");
  buf.writeUInt32BE(0x02400000, 8);
  buf.write("mntr", 12, 4, "ascii");
  buf.write("RGB ", 16, 4, "ascii");
  buf.write("XYZ ", 20, 4, "ascii");
  buf.writeUInt16BE(2024, 24); buf.writeUInt16BE(1, 26); buf.writeUInt16BE(1, 28);
  buf.write("acsp", 36, 4, "ascii");
  buf.write("MSFT", 40, 4, "ascii");
  buf.writeInt32BE(s15f16(0.9505), 68);
  buf.writeInt32BE(s15f16(1.0), 72);
  buf.writeInt32BE(s15f16(1.089), 76);

  buf.writeUInt32BE(tagCount, headerSize);

  const tagSigs = ["rXYZ", "gXYZ", "bXYZ", "rTRC", "gTRC", "bTRC", "wtpt", "desc", "cprt"];
  const tagSizes = [xyzSize, xyzSize, xyzSize, curvSize, curvSize, curvSize, xyzSize, descSize, textSize];
  let off = dataStart;
  for (let i = 0; i < tagCount; i++) {
    const te = headerSize + 4 + i * 12;
    buf.write(tagSigs[i], te, 4, "ascii");
    buf.writeUInt32BE(off, te + 4);
    buf.writeUInt32BE(tagSizes[i], te + 8);
    off += tagSizes[i];
  }

  off = dataStart;
  writeXYZ(buf, off, 0.4360747, 0.2225045, 0.0139322); off += xyzSize;
  writeXYZ(buf, off, 0.3850649, 0.7168786, 0.0971045); off += xyzSize;
  writeXYZ(buf, off, 0.1430804, 0.0606169, 0.7141733); off += xyzSize;
  writeCurve(buf, off, 2.2); off += curvSize;
  writeCurve(buf, off, 2.2); off += curvSize;
  writeCurve(buf, off, 2.2); off += curvSize;
  writeXYZ(buf, off, 0.9505, 1.0, 1.089); off += xyzSize;
  writeDesc(buf, off, "sRGB IEC61966-2.1"); off += descSize;
  buf.write("text", off, 4, "ascii");
  buf.writeUInt32BE(0, off + 4);
  buf.write("No copyright, use freely", off + 8, 24, "ascii");

  return new Uint8Array(buf);
}

export function getDocumentTypeFromInvoice(inv: {
  isDebitNote?: boolean;
  isCreditNote?: boolean;
}): "TaxInvoice" | "DebitNote" | "CreditNote" {
  if (inv.isDebitNote) return "DebitNote";
  if (inv.isCreditNote) return "CreditNote";
  return "TaxInvoice";
}
