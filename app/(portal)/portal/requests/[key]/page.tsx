"use client";

import { useParams } from "next/navigation";
import { RequestDetail } from "@/components/portal/request-detail";

export default function PortalRequestPage() {
  const params = useParams<{ key: string }>();
  return <RequestDetail requestKey={String(params.key)} />;
}
