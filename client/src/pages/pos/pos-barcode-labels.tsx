import PosLayout from "@/components/pos-layout";
import BarcodeLabels from "@/pages/inventory/barcode-labels";

export default function PosBarcodeLabels() {
  return <BarcodeLabels Wrapper={PosLayout} basePath="/pos" />;
}
