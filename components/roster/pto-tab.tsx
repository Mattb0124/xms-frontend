"use client";

import { useState } from "react";
import { ConfirmButton, FieldRow, INPUT, InlineError, PRIMARY_BUTTON } from "@/components/admin/primitives";
import { Panel } from "@/components/xms/panel";
import { Skeleton } from "@/components/xms/skeleton";
import { useToast } from "@/components/xms/toast";
import { capacityError, describeCapacityError } from "@/lib/capacity/errors";
import { fractionLabel, PTO_KIND_LABEL, PTO_KINDS } from "@/lib/capacity/vocab";
import { useTrack } from "@/lib/telemetry/provider";
import {
  useAddPtoMutation,
  useListPtoQuery,
  useRemovePtoMutation,
  type CreatePtoBody,
  type PtoKind,
} from "@/redux/capacityApi";
import { useMe } from "@/redux/me";

export interface PtoTabProps {
  personId: string;
  /** The sign-in identity the person is linked to; the person themselves may write their own PTO. */
  userId: string | null;
  /** capacity:manage; a manager may read and write anyone's PTO. */
  canManage: boolean;
}

/** The server's rule (CAP-02): the person themselves, or capacity:manage. */
export function canWritePto(
  viewerUserId: string | undefined,
  personUserId: string | null,
  canManage: boolean,
): boolean {
  if (canManage) return true;
  return !!viewerUserId && !!personUserId && viewerUserId === personUserId;
}

export interface PtoDraft {
  starts_on: string;
  ends_on: string;
  kind: PtoKind;
  /** "full" or "half"; the API takes a fraction and defaults to a full day. */
  length: "full" | "half";
  note: string;
}

const EMPTY: PtoDraft = { starts_on: "", ends_on: "", kind: "vacation", length: "full", note: "" };

/** The POST body: the fraction only for half days, the note only when given. */
export function ptoBody(draft: PtoDraft): CreatePtoBody {
  const body: CreatePtoBody = {
    starts_on: draft.starts_on,
    ends_on: draft.ends_on || draft.starts_on,
    kind: draft.kind,
  };
  if (draft.length === "half") body.fraction = 0.5;
  const note = draft.note.trim();
  if (note) body.note = note;
  return body;
}

/** "2026-09-14 to 2026-09-16", or the one date. */
export function rangeLabel(startsOn: string, endsOn: string): string {
  return startsOn === endsOn ? startsOn : `${startsOn} to ${endsOn}`;
}

/**
 * PTO (Capacity & Allocation functional 5.3, CAP-02): date ranges with a
 * kind, full or half days and a note, entered by the person or a capacity
 * manager and counted against the month the moment they are saved. The
 * list is only asked for when the viewer may see it, mirroring the
 * server's self-or-manage rule.
 */
export function PtoTab({ personId, userId, canManage }: PtoTabProps) {
  const me = useMe();
  const canWrite = canWritePto(me.principal?.userId, userId, canManage);
  const { data, isLoading, isError } = useListPtoQuery(personId, { skip: !canWrite });
  const [add, { isLoading: adding }] = useAddPtoMutation();
  const [remove, { isLoading: removing }] = useRemovePtoMutation();
  const { push } = useToast();
  const track = useTrack("capacity.pto.add");
  const [form, setForm] = useState<PtoDraft>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  if (!canWrite) {
    return (
      <Panel title="PTO" caption="Time off reduces the month's capacity">
        <p className="text-xms-label text-[13px]">
          Time off is visible to the person themselves and to capacity managers.
        </p>
      </Panel>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <Panel title="PTO" caption="Time off reduces the month's capacity the moment it is entered">
        {isLoading && !data ? <Skeleton lines={3} /> : null}
        {isError ? <p className="text-xms-muted text-[13px]">The time off could not be loaded.</p> : null}
        {data && data.length === 0 ? <p className="text-xms-label text-[13px]">No time off recorded.</p> : null}
        {data ? (
          <ul className="divide-xms-line divide-y" aria-label="Time off">
            {data.map((pto) => (
              <li key={pto.id} className="flex flex-wrap items-center gap-3 py-2 text-[13px]" data-pto={pto.id}>
                <span className="xms-mono text-xms-ink min-w-[200px]">{rangeLabel(pto.starts_on, pto.ends_on)}</span>
                <span className="text-xms-body">{PTO_KIND_LABEL[pto.kind] ?? pto.kind}</span>
                <span className="text-xms-label text-[12px]" data-fraction>
                  {fractionLabel(pto.fraction)}
                </span>
                {pto.note ? <span className="text-xms-label text-[12px]">{pto.note}</span> : null}
                <span className="ml-auto">
                  <ConfirmButton
                    label="Remove"
                    danger
                    disabled={removing}
                    onConfirm={async () => {
                      try {
                        await remove({ personId, ptoId: pto.id }).unwrap();
                      } catch (caught) {
                        push({
                          title: "Not removed",
                          detail: describeCapacityError(capacityError(caught)),
                          tone: "error",
                        });
                      }
                    }}
                  />
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </Panel>
      <Panel title="Add time off">
        <form
          className="flex flex-col gap-3"
          aria-label="Add time off"
          onSubmit={async (event) => {
            event.preventDefault();
            setError(null);
            const body = ptoBody(form);
            try {
              await add({ personId, body }).unwrap();
              track({ person_id: personId, kind: body.kind, half_day: body.fraction === 0.5 });
              setForm(EMPTY);
            } catch (caught) {
              setError(describeCapacityError(capacityError(caught)));
            }
          }}
        >
          <FieldRow label="Starts on" htmlFor="pto-starts">
            <input
              id="pto-starts"
              type="date"
              required
              className={INPUT}
              value={form.starts_on}
              onChange={(e) => setForm({ ...form, starts_on: e.target.value })}
            />
          </FieldRow>
          <FieldRow label="Ends on" htmlFor="pto-ends">
            <input
              id="pto-ends"
              type="date"
              className={INPUT}
              min={form.starts_on || undefined}
              value={form.ends_on}
              onChange={(e) => setForm({ ...form, ends_on: e.target.value })}
            />
          </FieldRow>
          <FieldRow label="Kind" htmlFor="pto-kind">
            <select
              id="pto-kind"
              className={INPUT}
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value as PtoKind })}
            >
              {PTO_KINDS.map((kind) => (
                <option key={kind.value} value={kind.value}>
                  {kind.label}
                </option>
              ))}
            </select>
          </FieldRow>
          <FieldRow label="Length" htmlFor="pto-length">
            <select
              id="pto-length"
              className={INPUT}
              value={form.length}
              onChange={(e) => setForm({ ...form, length: e.target.value as PtoDraft["length"] })}
            >
              <option value="full">Full days</option>
              <option value="half">Half days</option>
            </select>
          </FieldRow>
          <FieldRow label="Note" htmlFor="pto-note">
            <input
              id="pto-note"
              maxLength={200}
              className={INPUT}
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </FieldRow>
          <InlineError message={error} />
          <div>
            <button type="submit" className={PRIMARY_BUTTON} disabled={adding}>
              Add time off
            </button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
