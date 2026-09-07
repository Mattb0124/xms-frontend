"use client";

import { useState } from "react";
import { PRIMARY_BUTTON } from "@/components/admin/primitives";
import { useToast } from "@/components/xms/toast";
import { apiError, describeError } from "@/lib/admin/api-error";
import { useMe } from "@/redux/me";
import { useReplaceVisibilityMutation, type ArticleView } from "@/redux/knowledgeApi";
import { useListGrantedAccountsQuery } from "@/redux/ticketsApi";

/** The account set an article is shared with; saved as a whole set (Knowledge Base 5.6). */
export function VisibilityTab({ article }: { article: ArticleView }) {
  const me = useMe();
  const { data: accounts } = useListGrantedAccountsQuery();
  const [replace, { isLoading }] = useReplaceVisibilityMutation();
  const { push } = useToast();
  const current = new Set(article.visibility.map((row) => row.visible_account_id));
  const [selected, setSelected] = useState<Set<string>>(current);
  const [seen, setSeen] = useState(article.updated_at);
  if (seen !== article.updated_at) {
    setSeen(article.updated_at);
    setSelected(new Set(article.visibility.map((row) => row.visible_account_id)));
  }
  const disabled = article.is_global || !me.hasPermission("kb:publish");
  const others = (accounts ?? []).filter((account) => account.id !== article.account_id);
  const dirty = others.some((account) => selected.has(account.id) !== current.has(account.id));

  return (
    <div className="flex flex-col gap-3 text-[13px]">
      {article.is_global ? (
        <p className="text-xms-label">This article is global: every account and every internal user can read it.</p>
      ) : (
        <p className="text-xms-label">
          Visible to the owning account. Tick the other accounts that may read it; the identifier checklist still
          applies when you generalize.
        </p>
      )}
      <ul className="divide-xms-line divide-y" aria-label="Accounts">
        {others.map((account) => (
          <li key={account.id} className="flex items-center gap-3 py-2">
            <input
              type="checkbox"
              id={`vis-${account.id}`}
              disabled={disabled}
              checked={selected.has(account.id)}
              onChange={(event) => {
                const next = new Set(selected);
                if (event.target.checked) next.add(account.id);
                else next.delete(account.id);
                setSelected(next);
              }}
            />
            <label htmlFor={`vis-${account.id}`} className="text-xms-ink">
              {account.name}
            </label>
            <span className="xms-mono text-xms-label ml-auto text-[12px]">{account.key}</span>
          </li>
        ))}
        {others.length === 0 ? <li className="text-xms-label py-2">No other accounts on your grants.</li> : null}
      </ul>
      {!disabled ? (
        <div>
          <button
            type="button"
            disabled={!dirty || isLoading}
            onClick={() =>
              replace({ key: article.display_key, account_ids: [...selected] })
                .unwrap()
                .then(() => push({ title: "Visibility saved", tone: "success" }))
                .catch((caught) => push({ title: "Not saved", detail: describeError(apiError(caught)), tone: "error" }))
            }
            className={PRIMARY_BUTTON}
          >
            Save visibility
          </button>
        </div>
      ) : null}
    </div>
  );
}
