"use client";

import { useState } from "react";
import {
  FieldRow,
  INPUT,
  InlineError,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
  SwitchRow,
  formatDate,
} from "@/components/admin/primitives";
import { Panel } from "@/components/xms/panel";
import { useToast } from "@/components/xms/toast";
import { connectorError, describeConnectorError } from "@/lib/connectors/errors";
import { useConnectorErrors } from "@/lib/connectors/use-connector-errors";
import { useTrack } from "@/lib/telemetry/provider";
import {
  useRewindWatermarkMutation,
  useUpdateConnectorMutation,
  type ConnectorInstance,
  type UpdateConnectorBody,
} from "@/redux/connectorsApi";

const MB = 1024 * 1024;

interface Draft {
  name: string;
  poll_interval_seconds: string;
  table_name: string;
  journal_public: string;
  sync_work_notes: boolean;
  attachment_limit_mb: string;
  attachment_over_limit: "link" | "skip";
  ratio_percent: string;
  window_minutes: string;
  min_attempts: string;
}

function draftOf(instance: ConnectorInstance): Draft {
  return {
    name: instance.name,
    poll_interval_seconds: String(instance.poll_interval_seconds),
    table_name: instance.table_name,
    journal_public: instance.journal_public,
    sync_work_notes: instance.sync_work_notes,
    attachment_limit_mb: String(Math.round((instance.attachment_limit_bytes / MB) * 100) / 100),
    attachment_over_limit: instance.attachment_over_limit,
    ratio_percent: String(Math.round(instance.error_trip_threshold.ratio * 100)),
    window_minutes: String(instance.error_trip_threshold.window_minutes),
    min_attempts: String(instance.error_trip_threshold.min_attempts),
  };
}

/** Only the changed fields go in the PATCH, with the version the screen saw. */
export function settingsPatch(instance: ConnectorInstance, draft: Draft): UpdateConnectorBody {
  const body: UpdateConnectorBody = { version: instance.version };
  if (draft.name.trim() !== instance.name) body.name = draft.name.trim();
  const poll = Number(draft.poll_interval_seconds);
  if (poll !== instance.poll_interval_seconds) body.poll_interval_seconds = poll;
  if (draft.table_name.trim() !== instance.table_name) body.table_name = draft.table_name.trim();
  if (draft.journal_public !== instance.journal_public) body.journal_public = draft.journal_public;
  if (draft.sync_work_notes !== instance.sync_work_notes) body.sync_work_notes = draft.sync_work_notes;
  const limit = Math.round(Number(draft.attachment_limit_mb) * MB);
  if (limit !== instance.attachment_limit_bytes) body.attachment_limit_bytes = limit;
  if (draft.attachment_over_limit !== instance.attachment_over_limit)
    body.attachment_over_limit = draft.attachment_over_limit;
  const threshold = {
    ratio: Number(draft.ratio_percent) / 100,
    window_minutes: Number(draft.window_minutes),
    min_attempts: Number(draft.min_attempts),
  };
  const current = instance.error_trip_threshold;
  if (
    threshold.ratio !== current.ratio ||
    threshold.window_minutes !== current.window_minutes ||
    threshold.min_attempts !== current.min_attempts
  )
    body.error_trip_threshold = threshold;
  return body;
}

export function SettingsForm({ instance, refetch }: { instance: ConnectorInstance; refetch?: () => unknown }) {
  const [update, { isLoading }] = useUpdateConnectorMutation();
  const onError = useConnectorErrors(refetch);
  const track = useTrack("connector.settings.save");
  const [draft, setDraft] = useState<Draft>(() => draftOf(instance));
  const [seenVersion, setSeenVersion] = useState(instance.version);
  if (seenVersion !== instance.version) {
    setSeenVersion(instance.version);
    setDraft(draftOf(instance));
  }
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((previous) => ({ ...previous, [key]: value }));
  const patch = settingsPatch(instance, draft);
  const dirty = Object.keys(patch).length > 1;

  return (
    <Panel title="Settings" caption={`version ${instance.version}`}>
      <form
        className="flex flex-col gap-3"
        aria-label="Connector settings"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!dirty) return;
          try {
            await update({ id: instance.id, body: patch }).unwrap();
            track({ instance_id: instance.id, keys: Object.keys(patch).length - 1 });
          } catch (caught) {
            onError(caught);
          }
        }}
      >
        <FieldRow label="Name" htmlFor="cx-name">
          <input
            id="cx-name"
            className={INPUT}
            maxLength={80}
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </FieldRow>
        <FieldRow label="Table" htmlFor="cx-table">
          <input
            id="cx-table"
            className={INPUT}
            maxLength={80}
            value={draft.table_name}
            onChange={(e) => set("table_name", e.target.value)}
          />
        </FieldRow>
        <FieldRow label="Poll interval (s)" htmlFor="cx-poll">
          <input
            id="cx-poll"
            type="number"
            min={10}
            max={86400}
            className={INPUT}
            value={draft.poll_interval_seconds}
            onChange={(e) => set("poll_interval_seconds", e.target.value)}
          />
        </FieldRow>
        <FieldRow label="Public journal" htmlFor="cx-journal">
          <select
            id="cx-journal"
            className={INPUT}
            value={draft.journal_public}
            onChange={(e) => set("journal_public", e.target.value)}
          >
            <option value="comments">comments (client visible)</option>
            <option value="work_notes">work_notes</option>
          </select>
        </FieldRow>
        <SwitchRow
          id="cx-work-notes"
          label="Sync work notes"
          detail="Work notes only ever reach work_notes"
          checked={draft.sync_work_notes}
          onChange={(value) => set("sync_work_notes", value)}
        />
        <FieldRow label="Attachment limit (MB)" htmlFor="cx-attachment">
          <input
            id="cx-attachment"
            type="number"
            min={0}
            step={0.5}
            className={INPUT}
            value={draft.attachment_limit_mb}
            onChange={(e) => set("attachment_limit_mb", e.target.value)}
          />
        </FieldRow>
        <FieldRow label="Over the limit" htmlFor="cx-over-limit">
          <select
            id="cx-over-limit"
            className={INPUT}
            value={draft.attachment_over_limit}
            onChange={(e) => set("attachment_over_limit", e.target.value as "link" | "skip")}
          >
            <option value="link">Send a link and a note</option>
            <option value="skip">Skip the file</option>
          </select>
        </FieldRow>
        <fieldset className="border-xms-line flex flex-col gap-2 rounded-[4px] border p-3">
          <legend className="text-xms-label px-1 text-[14px]">Automatic trip threshold</legend>
          <FieldRow label="Failure ratio (%)" htmlFor="cx-ratio">
            <input
              id="cx-ratio"
              type="number"
              min={0}
              max={100}
              className={INPUT}
              value={draft.ratio_percent}
              onChange={(e) => set("ratio_percent", e.target.value)}
            />
          </FieldRow>
          <FieldRow label="Window (minutes)" htmlFor="cx-window">
            <input
              id="cx-window"
              type="number"
              min={1}
              max={1440}
              className={INPUT}
              value={draft.window_minutes}
              onChange={(e) => set("window_minutes", e.target.value)}
            />
          </FieldRow>
          <FieldRow label="Minimum attempts" htmlFor="cx-attempts">
            <input
              id="cx-attempts"
              type="number"
              min={1}
              className={INPUT}
              value={draft.min_attempts}
              onChange={(e) => set("min_attempts", e.target.value)}
            />
          </FieldRow>
        </fieldset>
        <div className="flex items-center gap-2">
          <button type="submit" className={PRIMARY_BUTTON} disabled={!dirty || isLoading}>
            Save settings
          </button>
          {dirty ? (
            <button type="button" className={SECONDARY_BUTTON} onClick={() => setDraft(draftOf(instance))}>
              Discard changes
            </button>
          ) : null}
        </div>
      </form>
    </Panel>
  );
}

/** Rewind the inbound watermark: preview the record count first, then confirm the same date. */
export function WatermarkPanel({ instance }: { instance: ConnectorInstance }) {
  const [rewind, { isLoading }] = useRewindWatermarkMutation();
  const { push } = useToast();
  const track = useTrack("connector.watermark.rewind");
  const [to, setTo] = useState("");
  const [preview, setPreview] = useState<{ to: string; records: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const iso = to ? new Date(to).toISOString() : "";
  const previewed = preview !== null && preview.to === iso;

  return (
    <Panel title="Inbound watermark" caption="Rewind after a client outage; preview shows how many records come back">
      <p className="xms-mono text-xms-ink mb-3 text-[14px]">Current: {formatDate(instance.inbound_watermark)}</p>
      <form
        className="flex flex-col gap-3"
        aria-label="Rewind watermark"
        onSubmit={async (event) => {
          event.preventDefault();
          setError(null);
          if (!iso) return;
          try {
            if (!previewed) {
              const result = await rewind({ id: instance.id, to: iso, preview: true }).unwrap();
              setPreview({ to: result.to, records: result.records });
              return;
            }
            const result = await rewind({ id: instance.id, to: iso }).unwrap();
            track({ instance_id: instance.id, records: result.records });
            push({
              title: "Watermark rewound",
              detail: `${result.records} records will be re-fetched.`,
              tone: "success",
            });
            setPreview(null);
            setTo("");
          } catch (caught) {
            setError(describeConnectorError(connectorError(caught)));
          }
        }}
      >
        <FieldRow label="Rewind to" htmlFor="cx-watermark">
          <input
            id="cx-watermark"
            type="datetime-local"
            className={INPUT}
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
            }}
          />
        </FieldRow>
        {previewed ? (
          <p className="text-xms-body text-[14px]" data-preview={preview.records}>
            <span className="xms-mono text-xms-ink">{preview.records}</span> records changed since{" "}
            <span className="xms-mono">{formatDate(preview.to)}</span> would be re-fetched.
          </p>
        ) : null}
        <InlineError message={error} />
        <div className="flex items-center gap-2">
          <button type="submit" className={previewed ? PRIMARY_BUTTON : SECONDARY_BUTTON} disabled={!iso || isLoading}>
            {previewed ? "Confirm rewind" : "Preview"}
          </button>
          {previewed ? (
            <button type="button" className={SECONDARY_BUTTON} onClick={() => setPreview(null)}>
              Cancel
            </button>
          ) : null}
        </div>
      </form>
    </Panel>
  );
}

export function SettingsTab({ instance, refetch }: { instance: ConnectorInstance; refetch?: () => unknown }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <SettingsForm instance={instance} refetch={refetch} />
      <WatermarkPanel instance={instance} />
    </div>
  );
}
