import PosLayout from "@/components/pos-layout";
import ProductForm from "@/pages/inventory/product-form";

export default function PosProductForm() {
  return <ProductForm Wrapper={PosLayout} basePath="/pos" />;
}
