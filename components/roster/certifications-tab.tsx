"use client";

import { useState } from "react";
import { ConfirmButton, FieldRow, INPUT, InlineError, PRIMARY_BUTTON } from "@/components/admin/primitives";
import { Panel } from "@/components/xms/panel";
import { SignalPill } from "@/components/xms/signal-pill";
import { useToast } from "@/components/xms/toast";
import { describeRosterError, rosterError } from "@/lib/roster/errors";
import { expiryState } from "@/lib/roster/vocab";
import { useAddCertificationMutation, useRemoveCertificationMutation, type Certification } from "@/redux/rosterApi";

export interface CertificationsTabProps {
  personId: string;
  certifications: Certification[];
  /** capacity:manage; without it the list is read only. */
  canEdit: boolean;
  /** Injected for the tests; defaults to now. */
  today?: Date;
}

/** The expiry chip: red past, amber within 90 days, green otherwise, grey without an expiry. */
export function ExpiryPill({ expiresOn, today }: { expiresOn: string | null; today?: Date }) {
  const state = expiryState(expiresOn, today);
  return <SignalPill tone={state.tone} label={state.label} title={expiresOn ?? undefined} />;
}

const EMPTY = { name: "", issuer: "", obtained_on: "", expires_on: "" };

/** Certifications (Capacity & Allocation functional 5.2): list with expiry tone, add, remove with confirm. */
export function CertificationsTab({ personId, certifications, canEdit, today }: CertificationsTabProps) {
  const [add, { isLoading: adding }] = useAddCertificationMutation();
  const [remove, { isLoading: removing }] = useRemoveCertificationMutation();
  const { push } = useToast();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <Panel title="Certifications" caption="Expiry within 90 days shows amber; past expiry shows red">
        {certifications.length === 0 ? <p className="text-xms-label text-[14px]">No certifications recorded.</p> : null}
        <ul className="divide-xms-line divide-y" aria-label="Certifications">
          {certifications.map((certification) => (
            <li
              key={certification.id}
              className="flex flex-wrap items-center gap-3 py-2 text-[14px]"
              data-certification={certification.id}
            >
              <span className="flex min-w-[220px] flex-col">
                <span className="text-xms-ink font-medium">{certification.name}</span>
                {certification.issuer ? (
                  <span className="text-xms-label text-[14px]">{certification.issuer}</span>
                ) : null}
              </span>
              <span className="xms-mono text-xms-label text-[14px]">
                obtained {certification.obtained_on}
                {certification.expires_on ? `, expires ${certification.expires_on}` : ""}
              </span>
              <span className="ml-auto flex items-center gap-2">
                <ExpiryPill expiresOn={certification.expires_on} today={today} />
                {canEdit ? (
                  <ConfirmButton
                    label="Remove"
                    danger
                    disabled={removing}
                    onConfirm={async () => {
                      try {
                        await remove({ id: personId, certificationId: certification.id }).unwrap();
                      } catch (caught) {
                        push({
                          title: "Not removed",
                          detail: describeRosterError(rosterError(caught)),
                          tone: "error",
                        });
                      }
                    }}
                  />
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </Panel>
      {canEdit ? (
        <Panel title="Add certification">
          <form
            className="flex flex-col gap-3"
            aria-label="Add certification"
            onSubmit={async (event) => {
              event.preventDefault();
              setError(null);
              try {
                await add({
                  id: personId,
                  body: {
                    name: form.name.trim(),
                    issuer: form.issuer.trim() || undefined,
                    obtained_on: form.obtained_on,
                    expires_on: form.expires_on || undefined,
                  },
                }).unwrap();
                setForm(EMPTY);
              } catch (caught) {
                setError(describeRosterError(rosterError(caught)));
              }
            }}
          >
            <FieldRow label="Name" htmlFor="cert-name">
              <input
                id="cert-name"
                required
                maxLength={160}
                className={INPUT}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </FieldRow>
            <FieldRow label="Issuer" htmlFor="cert-issuer">
              <input
                id="cert-issuer"
                maxLength={160}
                className={INPUT}
                value={form.issuer}
                onChange={(e) => setForm({ ...form, issuer: e.target.value })}
              />
            </FieldRow>
            <FieldRow label="Obtained on" htmlFor="cert-obtained">
              <input
                id="cert-obtained"
                type="date"
                required
                className={INPUT}
                value={form.obtained_on}
                onChange={(e) => setForm({ ...form, obtained_on: e.target.value })}
              />
            </FieldRow>
            <FieldRow label="Expires on" htmlFor="cert-expires">
              <input
                id="cert-expires"
                type="date"
                className={INPUT}
                value={form.expires_on}
                onChange={(e) => setForm({ ...form, expires_on: e.target.value })}
              />
            </FieldRow>
            <InlineError message={error} />
            <div>
              <button type="submit" className={PRIMARY_BUTTON} disabled={adding}>
                Add certification
              </button>
            </div>
          </form>
        </Panel>
      ) : null}
    </div>
  );
}
