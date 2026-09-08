"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { VERSION_SECTIONS, type ArticleVersion, type Sections, type VersionSection } from "@/redux/knowledgeApi";

export const SECTION_LABEL: Record<VersionSection, string> = {
  problem_statement: "Problem statement",
  environment: "Environment",
  symptoms: "Symptoms",
  cause: "Cause",
  steps: "Steps",
  verification: "Verification",
  rollback: "Rollback",
  client_notes: "Notes for the client",
};

export const SECTION_HINT: Partial<Record<VersionSection, string>> = {
  problem_statement: "What the user sees, in their words. Required before publish.",
  steps: "Numbered steps a consultant can follow cold. Required before publish.",
  client_notes: "This is the only section a client sees.",
};

const CONTROL =
  "border-xms-line bg-xms-card text-xms-ink w-full rounded-[4px] border px-2 py-2 text-[13px] outline-none disabled:opacity-60";

function SectionField({
  section,
  value,
  readOnly,
  onCommit,
}: {
  section: VersionSection;
  value: string;
  readOnly?: boolean;
  onCommit: (section: VersionSection, value: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(value);
  const [pending, setPending] = useState(false);
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setDraft(value);
  }
  const id = `article-section-${section}`;
  return (
    <div className="flex flex-col gap-1" data-section={section}>
      <label htmlFor={id} className="text-xms-ink text-[13px] font-semibold">
        {SECTION_LABEL[section]}
      </label>
      {SECTION_HINT[section] ? <p className="text-xms-label text-[12px]">{SECTION_HINT[section]}</p> : null}
      <textarea
        id={id}
        rows={section === "steps" ? 8 : 4}
        value={draft}
        disabled={readOnly || pending}
        aria-busy={pending || undefined}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={async () => {
          if (draft === value) return;
          setPending(true);
          try {
            await onCommit(section, draft);
          } catch {
            setDraft(value);
          } finally {
            setPending(false);
          }
        }}
        className={cn(CONTROL, section === "client_notes" && "border-xms-accent")}
      />
    </div>
  );
}

export interface ArticleEditorProps {
  /** The text being shown: the draft while editing, the published version in read-only mode. */
  version: ArticleVersion | null;
  readOnly?: boolean;
  onCommit: (sections: Sections) => Promise<void>;
}

/** The eight fixed sections as a structured editor; each commits on blur (Knowledge Base 5.4). */
export function ArticleEditor({ version, readOnly, onCommit }: ArticleEditorProps) {
  return (
    <div className="flex flex-col gap-4" data-testid="article-editor" data-readonly={readOnly ? "true" : undefined}>
      {VERSION_SECTIONS.map((section) => (
        <SectionField
          key={section}
          section={section}
          value={version?.[section] ?? ""}
          readOnly={readOnly}
          onCommit={(key, value) => onCommit({ [key]: value })}
        />
      ))}
    </div>
  );
}
