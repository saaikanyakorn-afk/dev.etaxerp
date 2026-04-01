import PosLayout from "@/components/pos-layout";
import DeliveryNoteFormPage from "@/pages/delivery/delivery-note-form";

export default function PosDeliveryNoteForm() {
  return <DeliveryNoteFormPage Wrapper={PosLayout} basePath="/pos" />;
}
