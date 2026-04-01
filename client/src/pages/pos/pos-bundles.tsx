import PosLayout from "@/components/pos-layout";
import BundleManagement from "@/pages/inventory/bundle-management";

export default function PosBundles() {
  return <BundleManagement Wrapper={PosLayout} basePath="/pos" />;
}
