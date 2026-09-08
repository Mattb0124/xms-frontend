"use client";

import { useState } from "react";
import { ConfirmButton, INPUT, PRIMARY_BUTTON, SECONDARY_BUTTON, formatDate } from "@/components/admin/primitives";
import { Panel } from "@/components/xms/panel";
import { SignalPill } from "@/components/xms/signal-pill";
import { Skeleton } from "@/components/xms/skeleton";
import { useToast } from "@/components/xms/toast";
import {
  controllersFor,
  CUSTOM_PREFIX,
  definitionFromDraft,
  describeFormError,
  draftFromDefinition,
  draftVersion,
  emptyFieldDraft,
  formError,
  mapsToOptions,
  publishedVersion,
  PUBLISH_FREEZES_NOTE,
  validateFormDraft,
  versionLabel,
  type FieldDraft,
  type TicketForm,
} from "@/lib/admin/ticket-forms";
import {
  conditionValuesOf,
  FORM_FIELD_KINDS,
  FORM_TICKET_TYPES,
  formTypeLabel,
  kindLabel,
  type FormField,
  type FormFieldKind,
  type FormTicketType,
} from "@/lib/portal/forms";
import { cn } from "@/lib/utils";
import {
  useAddFormVersionMutation,
  useCreateTicketFormMutation,
  useEditFormVersionMutation,
  useListTicketFormsQuery,
  usePublishFormVersionMutation,
} from "@/redux/adminApi";
import { useMe } from "@/redux/me";

/**
 * The request form builder (CP-03; Client Portal functional 5.4 step 3).
 *
 * One form per account and ticket type, authored as a draft and frozen when
 * it is published: the portal is served the published version and nothing
 * else, and a request in flight keeps the version it started on. The whole
 * definition saves as one body, so a field is never half-saved and a refused
 * definition changed nothing.
 *
 * The kinds, the columns each may write and the condition rules are the
 * server's, mirrored in `lib/portal/forms` so an author reads a problem
 * beside the field instead of taking a 400 for it. The server still decides.
 */
function FieldEditor({
  fields,
  index,
  onChange,
  onRemove,
  onMove,
}: {
  fields: FieldDraft[];
  index: number;
  onChange: (change: Partial<FieldDraft>) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const draft = fields[index];
  const number = index + 1;
  const controllers = controllersFor(fields, index);
  const controller = controllers.find((field) => field.key === draft.conditionField);
  const takesOptions = draft.kind === "choice" || draft.kind === "multi_choice";
  return (
    <li className="border-xms-line rounded-[6px] border p-3" data-field={draft.key}>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xms-label font-mono text-[12px]">Field {number}</span>
        <span className="text-xms-ink text-[13px] font-medium">{draft.label || "Untitled"}</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            className="text-xms-accent text-[12px] hover:underline disabled:opacity-40"
          >
            Move up
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === fields.length - 1}
            className="text-xms-accent text-[12px] hover:underline disabled:opacity-40"
          >
            Move down
          </button>
          <button type="button" onClick={onRemove} className="text-xms-accent text-[12px] hover:underline">
            Remove
          </button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-[12px]">
          <span className="text-xms-label">Label</span>
          <input
            aria-label={`Label of field ${number}`}
            value={draft.label}
            maxLength={160}
            onChange={(event) => onChange({ label: event.target.value })}
            className={INPUT}
          />
        </label>
        <label className="flex flex-col gap-1 text-[12px]">
          <span className="text-xms-label">Key</span>
          <input
            aria-label={`Key of field ${number}`}
            value={draft.key}
            onChange={(event) => {
              // A custom answer is filed under the key, so renaming the key
              // renames where the answer goes rather than orphaning it.
              const key = event.target.value;
              const follows = draft.mapsTo === `${CUSTOM_PREFIX}${draft.key}`;
              onChange({ key, ...(follows ? { mapsTo: `${CUSTOM_PREFIX}${key}` } : {}) });
            }}
            className={cn(INPUT, "font-mono")}
          />
        </label>
        <label className="flex flex-col gap-1 text-[12px]">
          <span className="text-xms-label">Kind</span>
          <select
            aria-label={`Kind of field ${number}`}
            value={draft.kind}
            onChange={(event) => {
              const kind = event.target.value as FormFieldKind;
              onChange({ kind, mapsTo: mapsToOptions({ ...draft, kind })[0]?.value ?? draft.mapsTo });
            }}
            className={INPUT}
          >
            {FORM_FIELD_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {kindLabel(kind)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[12px]">
          <span className="text-xms-label">Answer goes to</span>
          <select
            aria-label={`Answer of field ${number} goes to`}
            value={draft.mapsTo}
            onChange={(event) => onChange({ mapsTo: event.target.value })}
            className={INPUT}
          >
            {mapsToOptions(draft).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[12px] sm:col-span-2">
          <span className="text-xms-label">Help text</span>
          <input
            aria-label={`Help of field ${number}`}
            value={draft.help}
            maxLength={400}
            onChange={(event) => onChange({ help: event.target.value })}
            className={INPUT}
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <label className="text-xms-body flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            aria-label={`Field ${number} is required`}
            checked={draft.required}
            disabled={draft.kind === "attachment"}
            onChange={(event) => onChange({ required: event.target.checked })}
          />
          Required
        </label>
        <label className="text-xms-body flex items-center gap-2 text-[13px]">
          <span className="text-xms-label">Asked only when</span>
          <select
            aria-label={`Field ${number} is asked only when`}
            value={draft.conditionField}
            onChange={(event) => {
              const next = controllers.find((field) => field.key === event.target.value);
              onChange({
                conditionField: event.target.value,
                conditionEquals: next ? (conditionValuesOf(next)[0]?.value ?? "") : "",
              });
            }}
            className={cn(INPUT, "w-[200px]")}
          >
            <option value="">Always asked</option>
            {controllers.map((field) => (
              <option key={field.key} value={field.key}>
                {field.label || field.key}
              </option>
            ))}
          </select>
        </label>
        {controller ? (
          <label className="text-xms-body flex items-center gap-2 text-[13px]">
            <span className="text-xms-label">answers</span>
            <select
              aria-label={`Field ${number} is asked when the answer is`}
              value={draft.conditionEquals}
              onChange={(event) => onChange({ conditionEquals: event.target.value })}
              className={cn(INPUT, "w-[180px]")}
            >
              {conditionValuesOf(controller).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {takesOptions ? (
        <div className="border-xms-line mt-3 border-t pt-3">
          <p className="text-xms-label mb-2 text-[12px]">Options</p>
          <ul className="flex flex-col gap-2">
            {draft.options.map((option, order) => (
              <li key={order} className="flex items-center gap-2">
                <input
                  aria-label={`Option ${order + 1} value of field ${number}`}
                  value={option.value}
                  placeholder="value"
                  onChange={(event) =>
                    onChange({
                      options: draft.options.map((row, at) =>
                        at === order ? { ...row, value: event.target.value } : row,
                      ),
                    })
                  }
                  className={cn(INPUT, "w-[180px] font-mono")}
                />
                <input
                  aria-label={`Option ${order + 1} label of field ${number}`}
                  value={option.label}
                  placeholder="What the client reads"
                  onChange={(event) =>
                    onChange({
                      options: draft.options.map((row, at) =>
                        at === order ? { ...row, label: event.target.value } : row,
                      ),
                    })
                  }
                  className={cn(INPUT, "w-[240px]")}
                />
                <button
                  type="button"
                  onClick={() => onChange({ options: draft.options.filter((_, at) => at !== order) })}
                  className="text-xms-accent text-[12px] hover:underline"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => onChange({ options: [...draft.options, { value: "", label: "" }] })}
            className={cn(SECONDARY_BUTTON, "mt-2")}
          >
            Add option to field {number}
          </button>
        </div>
      ) : null}

      {draft.kind === "ci_picker" || draft.kind === "contact_picker" ? (
        <p className="text-xms-label mt-3 text-[12px]">
          The portal serves no directory for this kind, so a client types the identifier. Asking for it is fine;
          requiring it is a question most clients cannot answer.
        </p>
      ) : null}
    </li>
  );
}

/** The published version, read only: what a client is being asked right now. */
function PublishedFields({ fields }: { fields: FormField[] }) {
  if (fields.length === 0) return <p className="text-xms-label text-[13px]">This version asks nothing.</p>;
  return (
    <ol className="flex flex-col gap-1" aria-label="Published fields">
      {fields.map((field) => (
        <li key={field.key} className="text-xms-body flex flex-wrap items-baseline gap-2 text-[13px]">
          <span className="text-xms-ink font-medium">{field.label}</span>
          <span className="text-xms-label font-mono text-[12px]">{field.key}</span>
          <span className="text-xms-label text-[12px]">{kindLabel(field.kind)}</span>
          {field.required ? <span className="text-xms-label text-[12px]">required</span> : null}
          <span className="text-xms-label font-mono text-[12px]">{field.maps_to}</span>
          {field.visible_when ? (
            <span className="text-xms-label text-[12px]">
              asked when {field.visible_when.field} is {String(field.visible_when.equals)}
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function FormEditor({ accountId, form }: { accountId: string; form: TicketForm }) {
  const published = publishedVersion(form);
  const existingDraft = draftVersion(form);
  const [addVersion, adding] = useAddFormVersionMutation();
  const [editVersion, editing] = useEditFormVersionMutation();
  const [publish, publishing] = usePublishFormVersionMutation();
  const { push } = useToast();
  // Null means "what the server last answered for the draft"; anything else is unsaved.
  const [draft, setDraft] = useState<FieldDraft[] | null>(null);
  const [problems, setProblems] = useState<string[]>([]);

  const fields = draft ?? draftFromDefinition((existingDraft ?? published)?.definition);
  const edit = (index: number, change: Partial<FieldDraft>) =>
    setDraft(fields.map((field, order) => (order === index ? { ...field, ...change } : field)));
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= fields.length) return;
    const next = [...fields];
    [next[index], next[target]] = [next[target], next[index]];
    setDraft(next);
  };

  const save = async () => {
    const found = validateFormDraft(fields);
    setProblems(found);
    if (found.length > 0) return;
    const definition = definitionFromDraft(fields);
    try {
      if (existingDraft)
        await editVersion({ accountId, formId: form.id, versionId: existingDraft.id, definition }).unwrap();
      else await addVersion({ accountId, formId: form.id, definition }).unwrap();
      setDraft(null);
      push({ title: "Draft saved", detail: "Nothing reaches a client until it is published.", tone: "success" });
    } catch (error) {
      push({ title: "The draft was not saved", detail: describeFormError(formError(error)), tone: "error" });
    }
  };

  const publishDraft = async () => {
    if (!existingDraft) return;
    try {
      await publish({ accountId, formId: form.id, versionId: existingDraft.id }).unwrap();
      setDraft(null);
      push({ title: `Version ${existingDraft.version_no} published`, detail: PUBLISH_FREEZES_NOTE, tone: "success" });
    } catch (error) {
      push({ title: "The version was not published", detail: describeFormError(formError(error)), tone: "error" });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Panel
        title={form.name}
        caption={formTypeLabel(form.ticket_type)}
        subtitle={form.description || "The form a client fills in for this kind of request."}
        actions={
          published ? (
            <SignalPill tone="complete" label={`Published version ${published.version_no}`} />
          ) : (
            <SignalPill tone="needs-input" label="Nothing published" />
          )
        }
      >
        {published ? (
          <div className="flex flex-col gap-2">
            <p className="text-xms-label text-[12px]">
              {versionLabel(published)}, {formatDate(published.published_at)}. This is what clients are asked now.
            </p>
            <PublishedFields fields={published.definition.fields} />
          </div>
        ) : (
          <p className="text-xms-label text-[13px]">
            No version is published, so the portal still serves the fixed default form for this type.
          </p>
        )}
      </Panel>

      <Panel
        title={existingDraft ? versionLabel(existingDraft) : "New draft"}
        caption="DRAFT"
        subtitle="Saved as one definition. Publishing freezes it."
      >
        <ol className="flex flex-col gap-3" aria-label="Draft fields">
          {fields.map((field, index) => (
            <FieldEditor
              key={index}
              fields={fields}
              index={index}
              onChange={(change) => edit(index, change)}
              onRemove={() => setDraft(fields.filter((_, order) => order !== index))}
              onMove={(direction) => move(index, direction)}
            />
          ))}
        </ol>
        {fields.length === 0 ? (
          <p className="text-xms-label text-[13px]">This draft asks nothing yet. Add the first field.</p>
        ) : null}

        {problems.length > 0 ? (
          <ul className="mt-3 text-[12px] text-[color:var(--state-overdue-text)]" aria-label="Draft problems">
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setDraft([...fields, emptyFieldDraft(fields.length)])}
            className={SECONDARY_BUTTON}
          >
            Add field
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={adding.isLoading || editing.isLoading}
            className={PRIMARY_BUTTON}
          >
            Save draft
          </button>
          {draft !== null ? (
            <button
              type="button"
              onClick={() => {
                setDraft(null);
                setProblems([]);
              }}
              className={SECONDARY_BUTTON}
            >
              Discard changes
            </button>
          ) : null}
          {existingDraft ? (
            <ConfirmButton
              label={`Publish version ${existingDraft.version_no}`}
              confirmLabel="Publish and freeze"
              onConfirm={publishDraft}
              disabled={publishing.isLoading || draft !== null}
            />
          ) : null}
        </div>
        <p className="text-xms-label mt-2 text-[12px]">
          {draft !== null ? "Save the draft before publishing it. " : ""}
          {PUBLISH_FREEZES_NOTE}
        </p>
      </Panel>
    </div>
  );
}

function NewFormForm({ accountId, taken }: { accountId: string; taken: Set<string> }) {
  const available = FORM_TICKET_TYPES.filter((type) => !taken.has(type));
  const [create, creating] = useCreateTicketFormMutation();
  const { push } = useToast();
  const [type, setType] = useState<FormTicketType>(available[0] ?? "incident");
  const [name, setName] = useState("");

  if (available.length === 0)
    return (
      <p className="text-xms-label text-[13px]">
        Every request type already has a form on this account. Draft a new version of one instead.
      </p>
    );

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        try {
          await create({ accountId, body: { ticket_type: type, name: name.trim() || formTypeLabel(type) } }).unwrap();
          setName("");
          push({ title: "Form created", detail: "It starts from the default fields as a draft.", tone: "success" });
        } catch (error) {
          push({ title: "The form was not created", detail: describeFormError(formError(error)), tone: "error" });
        }
      }}
    >
      <label className="flex flex-col gap-1 text-[12px]">
        <span className="text-xms-label">Request type</span>
        <select
          aria-label="Request type of the new form"
          value={type}
          onChange={(event) => setType(event.target.value as FormTicketType)}
          className={cn(INPUT, "w-[200px]")}
        >
          {available.map((option) => (
            <option key={option} value={option}>
              {formTypeLabel(option)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[12px]">
        <span className="text-xms-label">Name the client reads</span>
        <input
          aria-label="Name of the new form"
          value={name}
          maxLength={160}
          onChange={(event) => setName(event.target.value)}
          placeholder="Report a problem"
          className={cn(INPUT, "w-[260px]")}
        />
      </label>
      <button type="submit" className={PRIMARY_BUTTON} disabled={creating.isLoading}>
        New form
      </button>
    </form>
  );
}

function TicketFormsEditor({ accountId }: { accountId: string }) {
  const { data, isLoading } = useListTicketFormsQuery(accountId);
  const forms = data ?? [];
  const [selected, setSelected] = useState<string | null>(null);
  const active = forms.find((form) => form.id === selected) ?? forms[0];

  if (isLoading && !data) return <Skeleton lines={5} />;

  return (
    <div className="flex flex-col gap-4">
      <Panel
        title="Request forms"
        caption="CLIENT PORTAL"
        subtitle="What a client is asked for each kind of request. A type with no published form keeps the fixed default."
      >
        <ul className="mb-4 flex flex-col gap-1" aria-label="Forms">
          {forms.map((form) => {
            const published = publishedVersion(form);
            return (
              <li key={form.id}>
                <button
                  type="button"
                  aria-pressed={form.id === active?.id}
                  onClick={() => setSelected(form.id)}
                  data-form={form.ticket_type}
                  className={cn(
                    "hover:bg-xms-tint flex w-full items-center gap-3 rounded-[4px] px-3 py-2 text-left text-[13px]",
                    form.id === active?.id && "bg-xms-tint shadow-[inset_3px_0_0_var(--xms-accent)]",
                  )}
                >
                  <span className="text-xms-ink font-medium">{formTypeLabel(form.ticket_type)}</span>
                  <span className="text-xms-label">{form.name}</span>
                  <span className="ml-auto">
                    {published ? (
                      <SignalPill tone="complete" label={`Version ${published.version_no}`} />
                    ) : (
                      <SignalPill tone="needs-input" label="Draft only" />
                    )}
                  </span>
                </button>
              </li>
            );
          })}
          {forms.length === 0 ? (
            <li className="text-xms-label text-[13px]">
              No form is authored. Every request type is served the fixed default form.
            </li>
          ) : null}
        </ul>
        <NewFormForm
          accountId={accountId}
          taken={new Set(forms.filter((form) => form.is_active).map((form) => form.ticket_type))}
        />
      </Panel>
      {active ? <FormEditor accountId={accountId} form={active} /> : null}
    </div>
  );
}

/**
 * The panel around it. The API answers every form route to `admin:config`,
 * so a reader without it is told rather than asking and taking a 403 for a
 * question already answered here.
 */
export function TicketFormsPanel({ accountId }: { accountId: string }) {
  const me = useMe();
  if (!me.hasPermission("admin:config"))
    return (
      <Panel
        title="Request forms"
        caption="CLIENT PORTAL"
        subtitle="Authoring a request form needs the admin:config permission."
      >
        <p className="text-xms-label text-[13px]">
          Authoring the forms a client fills in needs the admin:config permission, which this account binding does not
          carry.
        </p>
      </Panel>
    );
  return <TicketFormsEditor accountId={accountId} />;
}
