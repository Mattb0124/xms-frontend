"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AdminGate, FieldRow, INPUT, InlineError, PRIMARY_BUTTON } from "@/components/admin/primitives";
import { KIND_LABEL } from "@/components/knowledge/primitives";
import { Panel } from "@/components/xms/panel";
import { apiError, describeError } from "@/lib/admin/api-error";
import { useCreateArticleMutation, type ArticleKind } from "@/redux/knowledgeApi";
import { useListGrantedAccountsQuery } from "@/redux/ticketsApi";

/** New article: the identity fields only; the sections are edited on the record. */
function NewArticleForm() {
  const router = useRouter();
  const { data: accounts } = useListGrantedAccountsQuery();
  const [create, { isLoading }] = useCreateArticleMutation();
  const [form, setForm] = useState({
    account_id: "",
    title: "",
    kind: "solution" as ArticleKind,
    categories: "",
    problem_statement: "",
  });
  const [error, setError] = useState<string | null>(null);
  const accountId = form.account_id || (accounts?.length === 1 ? accounts[0].id : "");
  return (
    <Panel title="New article" caption="Identity first; the sections are on the record">
      <form
        className="flex flex-col gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          setError(null);
          if (!accountId) {
            setError("Choose the owning account.");
            return;
          }
          try {
            const created = await create({
              account_id: accountId,
              title: form.title.trim(),
              kind: form.kind,
              categories: form.categories
                .split(",")
                .map((value) => value.trim())
                .filter(Boolean),
              problem_statement: form.problem_statement.trim() || undefined,
            }).unwrap();
            router.push(`/knowledge/${created.display_key}`);
          } catch (caught) {
            setError(describeError(apiError(caught)));
          }
        }}
      >
        <FieldRow label="Account" htmlFor="new-account">
          <select
            id="new-account"
            className={INPUT}
            value={accountId}
            onChange={(e) => setForm({ ...form, account_id: e.target.value })}
            required
          >
            <option value="">Choose</option>
            {(accounts ?? []).map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </FieldRow>
        <FieldRow label="Title" htmlFor="new-title">
          <input
            id="new-title"
            className={INPUT}
            value={form.title}
            minLength={3}
            maxLength={200}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
        </FieldRow>
        <FieldRow label="Kind" htmlFor="new-kind">
          <select
            id="new-kind"
            className={INPUT}
            value={form.kind}
            onChange={(e) => setForm({ ...form, kind: e.target.value as ArticleKind })}
          >
            {(Object.keys(KIND_LABEL) as ArticleKind[]).map((kind) => (
              <option key={kind} value={kind}>
                {KIND_LABEL[kind]}
              </option>
            ))}
          </select>
        </FieldRow>
        <FieldRow label="Categories" htmlFor="new-categories">
          <input
            id="new-categories"
            className={INPUT}
            value={form.categories}
            placeholder="reporting, consolidation"
            onChange={(e) => setForm({ ...form, categories: e.target.value })}
          />
        </FieldRow>
        <FieldRow label="Problem" htmlFor="new-problem">
          <textarea
            id="new-problem"
            rows={3}
            className={`${INPUT} h-auto py-2`}
            value={form.problem_statement}
            onChange={(e) => setForm({ ...form, problem_statement: e.target.value })}
          />
        </FieldRow>
        <InlineError message={error} />
        <div>
          <button type="submit" disabled={isLoading} className={PRIMARY_BUTTON}>
            Create draft
          </button>
        </div>
      </form>
    </Panel>
  );
}

export default function NewArticlePage() {
  return (
    <AdminGate permission="kb:author">
      <NewArticleForm />
    </AdminGate>
  );
}
