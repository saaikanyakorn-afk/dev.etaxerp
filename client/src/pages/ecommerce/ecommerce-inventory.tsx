import EcommerceLayout from "@/components/ecommerce-layout";
import InventoryList from "@/pages/inventory/inventory-list";

export default function EcommerceInventory() {
  return <InventoryList Wrapper={EcommerceLayout} basePath="/ecommerce/inventory" />;
}
