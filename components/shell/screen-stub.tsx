import { Panel } from "@/components/xms/panel";
import { SCREENS } from "@/lib/routes";

/**
 * Placeholder body for a registered screen that has not been built yet. The
 * purpose line is the acceptance one-liner from the wireframe tree.
 */
export function ScreenStub({ screen, item }: { screen: string; item?: string }) {
  const entry = SCREENS.find((s) => s.screen === screen);
  return (
    <Panel title={entry?.label ?? screen} caption={item ?? "Not built yet"}>
      <p className="text-xms-body text-[14px]">{entry?.purpose ?? "This screen lands later in the plan."}</p>
    </Panel>
  );
}
