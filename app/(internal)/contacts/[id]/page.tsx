"use client";

import { useParams } from "next/navigation";
import { AdminGate } from "@/components/admin/primitives";
import { ContactRecord } from "@/components/contacts/contact-record";

export default function ContactPage() {
  const params = useParams<{ id: string }>();
  const id = String(params.id ?? "");
  return (
    <AdminGate permission="tickets:view">
      <ContactRecord contactId={id} />
    </AdminGate>
  );
}
