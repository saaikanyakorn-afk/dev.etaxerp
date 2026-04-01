import PosLayout from "@/components/pos-layout";
import BundleFormPage from "@/pages/inventory/bundle-form";

export default function PosBundleForm() {
  return <BundleFormPage Wrapper={PosLayout} basePath="/pos" />;
}
