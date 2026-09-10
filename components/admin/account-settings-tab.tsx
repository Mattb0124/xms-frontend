"use client";

import { useState } from "react";
import { FieldRow, INPUT, PRIMARY_BUTTON, SECONDARY_BUTTON, SwitchRow } from "@/components/admin/primitives";
import { Panel } from "@/components/xms/panel";
import { Skeleton } from "@/components/xms/skeleton";
import { useMutationErrors } from "@/lib/admin/use-mutation-errors";
import { useTrack } from "@/lib/telemetry/provider";
import {
  useGetAccountSettingsQuery,
  useUpdateAccountSettingsMutation,
  type SettingsPatch,
  type SyncMode,
} from "@/redux/adminApi";
import { useMe } from "@/redux/me";

const AI_CAPABILITIES = ["categorize", "prioritize", "duplicates", "summarize", "similar_solutions"] as const;
const AI_MODES = ["off", "suggest", "auto"] as const;

/**
 * The account Settings tab (functional spec 5.3): switches, sync mode, the
 * AI switch and opt-ins (disabled without ai:configure; the API refuses them
 * too), inbound aliases as chips. Saved as one PUT with the version; a
 * stale_version answer reloads the row.
 */
export function AccountSettingsTab({ accountId }: { accountId: string }) {
  const me = useMe();
  const canConfigureAi = me.hasPermission("ai:configure");
  const { data, isLoading, refetch } = useGetAccountSettingsQuery(accountId);
  const [update, { isLoading: saving }] = useUpdateAccountSettingsMutation();
  const onError = useMutationErrors(refetch);
  const track = useTrack("settings.save");

  const [draft, setDraft] = useState<SettingsPatch | null>(null);
  const [seenVersion, setSeenVersion] = useState<number | undefined>(undefined);
  const [aliasDraft, setAliasDraft] = useState("");
  if (data && seenVersion !== data.version) {
    setSeenVersion(data.version);
    setDraft(null);
  }

  if (isLoading || !data) return <Skeleton lines={6} className="max-w-md" />;

  const current = { ...data, ...(draft ?? {}) };
  const set = <K extends keyof SettingsPatch>(key: K, value: SettingsPatch[K]) =>
    setDraft((previous) => ({ ...(previous ?? { version: data.version }), version: data.version, [key]: value }));
  const dirty = draft !== null && Object.keys(draft).length > 1;

  const save = async () => {
    if (!draft) return;
    try {
      await update({ id: accountId, body: { ...draft, version: data.version } }).unwrap();
      track({ keys: Object.keys(draft).filter((key) => key !== "version").length });
      setDraft(null);
    } catch (error) {
      onError(error);
    }
  };

  const aliases = current.inbound_aliases ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Switches" caption="Behaviour per account">
        <SwitchRow
          id="portal_enabled"
          label="Portal enabled"
          checked={current.portal_enabled}
          onChange={(v) => set("portal_enabled", v)}
        />
        <SwitchRow
          id="consumption_visible"
          label="Consumption visible in the portal"
          checked={current.consumption_visible}
          onChange={(v) => set("consumption_visible", v)}
        />
        <SwitchRow
          id="csat_enabled"
          label="CSAT surveys"
          checked={current.csat_enabled}
          onChange={(v) => set("csat_enabled", v)}
        />
        <SwitchRow
          id="usage_analytics_portal"
          label="Usage analytics for portal users"
          detail="Per DPA"
          checked={current.usage_analytics_portal}
          onChange={(v) => set("usage_analytics_portal", v)}
        />
        <SwitchRow
          id="store_search_terms"
          label="Store search terms"
          detail="Hashed only when off"
          checked={current.store_search_terms}
          onChange={(v) => set("store_search_terms", v)}
        />
        <div className="mt-3">
          <FieldRow label="Sync mode" htmlFor="sync_mode">
            <select
              id="sync_mode"
              value={current.sync_mode}
              onChange={(event) => set("sync_mode", event.target.value as SyncMode)}
              className={INPUT}
            >
              <option value="off">Off</option>
              <option value="ingest_only">Ingest only</option>
              <option value="bidirectional">Bidirectional</option>
            </select>
          </FieldRow>
        </div>
      </Panel>

      <Panel
        title="Axel"
        caption={canConfigureAi ? "AI switch and opt-ins" : "Needs the ai:configure permission to change"}
      >
        <div aria-disabled={!canConfigureAi} data-testid="ai-section" className={canConfigureAi ? "" : "opacity-60"}>
          <SwitchRow
            id="ai_enabled"
            label="AI enabled for this account"
            detail={current.ai_region_ok ? "Region check passed" : "Region check failed"}
            checked={current.ai_enabled}
            disabled={!canConfigureAi}
            onChange={(v) => set("ai_enabled", v)}
          />
          <div className="mt-3 flex flex-col gap-2">
            {AI_CAPABILITIES.map((capability) => (
              <FieldRow key={capability} label={capability.replace("_", " ")} htmlFor={`ai_${capability}`}>
                <select
                  id={`ai_${capability}`}
                  value={current.ai_opt_ins?.[capability] ?? "off"}
                  disabled={!canConfigureAi || !current.ai_enabled}
                  onChange={(event) =>
                    set("ai_opt_ins", { ...(current.ai_opt_ins ?? {}), [capability]: event.target.value })
                  }
                  className={INPUT}
                >
                  {AI_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode}
                    </option>
                  ))}
                </select>
              </FieldRow>
            ))}
          </div>
        </div>
      </Panel>

      <Panel title="Email" caption="Inbound aliases and sender identity">
        <FieldRow label="Outbound identity" htmlFor="outbound_identity">
          <input
            id="outbound_identity"
            type="text"
            value={current.outbound_identity ?? ""}
            onChange={(event) => set("outbound_identity", event.target.value || null)}
            className={INPUT}
          />
        </FieldRow>
        <div className="mt-3">
          <p className="text-xms-label mb-1 text-[14px]">Inbound aliases</p>
          <div className="flex flex-wrap items-center gap-2">
            {aliases.map((alias) => (
              <span
                key={alias}
                className="border-xms-line bg-xms-card text-xms-body inline-flex h-[28px] items-center gap-1 rounded-[999px] border pr-1 pl-[10px] text-[14px]"
              >
                <span className="xms-mono">{alias}</span>
                <button
                  type="button"
                  aria-label={`Remove alias ${alias}`}
                  onClick={() =>
                    set(
                      "inbound_aliases",
                      aliases.filter((item) => item !== alias),
                    )
                  }
                  className="text-xms-muted hover:text-xms-ink ml-1 flex h-5 w-5 items-center justify-center rounded-[999px]"
                >
                  ×
                </button>
              </span>
            ))}
            <form
              className="flex items-center gap-1"
              onSubmit={(event) => {
                event.preventDefault();
                const next = aliasDraft.trim().toLowerCase();
                if (!next || aliases.includes(next)) return;
                set("inbound_aliases", [...aliases, next]);
                setAliasDraft("");
              }}
            >
              <input
                aria-label="New alias"
                type="email"
                value={aliasDraft}
                onChange={(event) => setAliasDraft(event.target.value)}
                placeholder="support@client.example"
                className={`${INPUT} h-[28px] w-[240px]`}
              />
              <button type="submit" className={`${SECONDARY_BUTTON} h-[28px]`}>
                Add
              </button>
            </form>
          </div>
        </div>
      </Panel>

      <Panel title="Limits" caption="Retention and attachments">
        <FieldRow label="Retention days" htmlFor="retention_days">
          <input
            id="retention_days"
            type="number"
            min={30}
            value={current.retention_days}
            onChange={(event) => set("retention_days", Number(event.target.value))}
            className={INPUT}
          />
        </FieldRow>
        <div className="mt-3">
          <FieldRow label="Attachment max bytes" htmlFor="attachment_max_bytes">
            <input
              id="attachment_max_bytes"
              type="number"
              min={1024}
              value={Number(current.attachment_max_bytes)}
              onChange={(event) => set("attachment_max_bytes", Number(event.target.value))}
              className={INPUT}
            />
          </FieldRow>
        </div>
      </Panel>

      <div className="flex items-center gap-2 lg:col-span-2">
        <button type="button" className={PRIMARY_BUTTON} disabled={!dirty || saving} onClick={() => void save()}>
          {saving ? "Saving" : "Save settings"}
        </button>
        <button type="button" className={SECONDARY_BUTTON} disabled={!dirty || saving} onClick={() => setDraft(null)}>
          Discard
        </button>
        <span className="xms-mono text-xms-label ml-auto text-[14px]">version {data.version}</span>
      </div>
    </div>
  );
}
