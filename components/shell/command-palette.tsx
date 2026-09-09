"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Screen } from "@/lib/routes";
import { cn } from "@/lib/utils";

export interface PaletteAction {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
}

export interface CommandPaletteProps {
  screens: Screen[];
  actions?: PaletteAction[];
  onClose: () => void;
}

/** Ctrl+K: every navigation target and every action on the current record by name (User Experience section 2.2). */
export function CommandPalette({ screens, actions = [], onClose }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);

  const items = useMemo(() => {
    const term = query.trim().toLowerCase();
    const nav: PaletteAction[] = screens
      .filter((s) => !s.path.includes("["))
      .map((s) => ({ id: `go:${s.path}`, label: s.label, hint: s.section, run: () => router.push(s.path) }));
    const key = term.match(/^cs\d{4,7}$/i);
    const jump: PaletteAction[] = key
      ? [
          {
            id: "jump",
            label: `Open ${term.toUpperCase()}`,
            hint: "Ticket",
            run: () => router.push(`/cases/${term.toUpperCase()}`),
          },
        ]
      : [];
    const all = [...jump, ...actions, ...nav];
    return term && !key ? all.filter((a) => a.label.toLowerCase().includes(term)) : all;
  }, [screens, actions, query, router]);

  const run = (action: PaletteAction) => {
    onClose();
    action.run();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]">
      <button type="button" aria-label="Close palette" onClick={onClose} className="absolute inset-0 bg-black/30" />
      <div role="dialog" aria-label="Command palette" className="xms-card relative w-[560px] overflow-hidden">
        <input
          ref={input}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIndex(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") setIndex((i) => Math.min(items.length - 1, i + 1));
            if (event.key === "ArrowUp") setIndex((i) => Math.max(0, i - 1));
            if (event.key === "Enter" && items[index]) run(items[index]);
          }}
          placeholder="Type a screen, an action, or a ticket key"
          aria-label="Command"
          className="border-xms-line text-xms-ink h-11 w-full border-b px-4 text-[14px] outline-none"
        />
        <ul role="listbox" className="max-h-[50vh] overflow-auto py-1">
          {items.map((item, i) => (
            <li key={item.id} role="option" aria-selected={i === index}>
              <button
                type="button"
                onMouseEnter={() => setIndex(i)}
                onClick={() => run(item)}
                className={cn(
                  "flex w-full items-center px-4 py-2 text-left text-[13px]",
                  i === index ? "bg-xms-tint text-xms-ink" : "text-xms-body",
                )}
              >
                <span className="flex-1">{item.label}</span>
                {item.hint ? <span className="xms-caption">{item.hint}</span> : null}
              </button>
            </li>
          ))}
          {items.length === 0 ? <li className="text-xms-label px-4 py-3 text-[13px]">Nothing matches.</li> : null}
        </ul>
      </div>
    </div>
  );
}
