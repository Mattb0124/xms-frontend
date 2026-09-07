import { ScreenStub } from "@/components/shell/screen-stub";

/** The ticket record; built in P1.5.5. */
export default async function TicketPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return <ScreenStub screen="ticket" item={`P1.5.5 · ${key}`} />;
}
