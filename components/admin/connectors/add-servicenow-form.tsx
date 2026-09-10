"use client";

import { useState } from "react";
import { FieldRow, INPUT, InlineError, PRIMARY_BUTTON } from "@/components/admin/primitives";
import { Panel } from "@/components/xms/panel";
import { connectorError, describeConnectorError } from "@/lib/connectors/errors";
import { useTrack } from "@/lib/telemetry/provider";
import {
  useCreateServiceNowInstanceMutation,
  type ConnectorInstance,
  type CreateServiceNowBody,
} from "@/redux/connectorsApi";

const EMPTY = {
  name: "",
  base_url: "",
  auth_kind: "basic" as CreateServiceNowBody["auth_kind"],
  username: "",
  password: "",
  client_id: "",
  client_secret: "",
  profile: "csm" as "csm" | "itsm",
  table_name: "",
  poll_interval_seconds: "60",
};

/**
 * "Add ServiceNow instance" (ServiceNow Sync functional 5.2 step 1). The
 * credential fields are shown once, sent once and cleared on success; the
 * API never returns a stored credential and this form never prefills one.
 */
export function AddServiceNowForm({
  accountId,
  onCreated,
}: {
  accountId: string;
  onCreated?: (instance: ConnectorInstance) => void;
}) {
  const [create, { isLoading }] = useCreateServiceNowInstanceMutation();
  const track = useTrack("connector.create");
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof typeof EMPTY, value: string) => setForm((previous) => ({ ...previous, [key]: value }));

  return (
    <Panel title="Add ServiceNow instance" caption="The credential is stored once and never shown again">
      <form
        className="flex flex-col gap-3"
        aria-label="Add ServiceNow instance"
        autoComplete="off"
        onSubmit={async (event) => {
          event.preventDefault();
          setError(null);
          const body: CreateServiceNowBody = {
            name: form.name.trim(),
            base_url: form.base_url.trim(),
            auth_kind: form.auth_kind,
            credential:
              form.auth_kind === "basic"
                ? { username: form.username, password: form.password }
                : { client_id: form.client_id, client_secret: form.client_secret },
            profile: form.profile,
            table_name: form.table_name.trim() || undefined,
            poll_interval_seconds: Number(form.poll_interval_seconds) || undefined,
          };
          try {
            const created = await create({ accountId, body }).unwrap();
            track({ account_id: accountId, instance_id: created.id, auth_kind: body.auth_kind, profile: form.profile });
            setForm(EMPTY);
            onCreated?.(created);
          } catch (caught) {
            setForm((previous) => ({ ...previous, password: "", client_secret: "" }));
            setError(describeConnectorError(connectorError(caught)));
          }
        }}
      >
        <FieldRow label="Name" htmlFor="snow-name">
          <input
            id="snow-name"
            required
            maxLength={80}
            className={INPUT}
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </FieldRow>
        <FieldRow label="Base URL" htmlFor="snow-url">
          <input
            id="snow-url"
            type="url"
            required
            placeholder="https://client.service-now.com"
            className={INPUT}
            value={form.base_url}
            onChange={(e) => set("base_url", e.target.value)}
          />
        </FieldRow>
        <FieldRow label="Authentication" htmlFor="snow-auth">
          <select
            id="snow-auth"
            className={INPUT}
            value={form.auth_kind}
            onChange={(e) => set("auth_kind", e.target.value)}
          >
            <option value="basic">Basic (non-production)</option>
            <option value="oauth_client_credentials">OAuth client credentials</option>
          </select>
        </FieldRow>
        {form.auth_kind === "basic" ? (
          <>
            <FieldRow label="Username" htmlFor="snow-username">
              <input
                id="snow-username"
                required
                autoComplete="off"
                className={INPUT}
                value={form.username}
                onChange={(e) => set("username", e.target.value)}
              />
            </FieldRow>
            <FieldRow label="Password" htmlFor="snow-password">
              <input
                id="snow-password"
                type="password"
                required
                autoComplete="new-password"
                className={INPUT}
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
              />
            </FieldRow>
          </>
        ) : (
          <>
            <FieldRow label="Client id" htmlFor="snow-client-id">
              <input
                id="snow-client-id"
                required
                autoComplete="off"
                className={INPUT}
                value={form.client_id}
                onChange={(e) => set("client_id", e.target.value)}
              />
            </FieldRow>
            <FieldRow label="Client secret" htmlFor="snow-client-secret">
              <input
                id="snow-client-secret"
                type="password"
                required
                autoComplete="new-password"
                className={INPUT}
                value={form.client_secret}
                onChange={(e) => set("client_secret", e.target.value)}
              />
            </FieldRow>
          </>
        )}
        <FieldRow label="Profile" htmlFor="snow-profile">
          <select
            id="snow-profile"
            className={INPUT}
            value={form.profile}
            onChange={(e) => set("profile", e.target.value)}
          >
            <option value="csm">CSM (sn_customerservice_case)</option>
            <option value="itsm">ITSM (incident)</option>
          </select>
        </FieldRow>
        <FieldRow label="Table" htmlFor="snow-table">
          <input
            id="snow-table"
            placeholder="Profile default"
            maxLength={80}
            className={INPUT}
            value={form.table_name}
            onChange={(e) => set("table_name", e.target.value)}
          />
        </FieldRow>
        <FieldRow label="Poll interval (s)" htmlFor="snow-poll">
          <input
            id="snow-poll"
            type="number"
            min={10}
            max={86400}
            className={INPUT}
            value={form.poll_interval_seconds}
            onChange={(e) => set("poll_interval_seconds", e.target.value)}
          />
        </FieldRow>
        <InlineError message={error} />
        <p className="text-xms-label text-[14px]">
          The instance starts in mode Off with the kill switch armed. Activate a field map, then switch to Ingest only.
        </p>
        <div>
          <button type="submit" className={PRIMARY_BUTTON} disabled={isLoading}>
            Add instance
          </button>
        </div>
      </form>
    </Panel>
  );
}
