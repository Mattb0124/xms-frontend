import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { useRowKeys } from "@/lib/use-row-keys";

/** A list editor in miniature: the rows live in state and each edit changes the keys in the same event. */
function useEditedList(initial: number) {
  const [count, setCount] = useState(initial);
  const rows = useRowKeys(count);
  return {
    keys: rows.keys,
    append: () => setCount((current) => current + 1),
    removeAt: (index: number) => {
      rows.drop(index);
      setCount((current) => current - 1);
    },
  };
}

describe("useRowKeys", () => {
  it("gives every row its own key and keeps them across renders", () => {
    const { result, rerender } = renderHook(() => useEditedList(3));
    const first = result.current.keys;
    expect(new Set(first).size).toBe(3);
    rerender();
    expect(result.current.keys).toEqual(first);
  });

  it("keeps the existing keys when a row is appended", () => {
    const { result } = renderHook(() => useEditedList(2));
    const before = result.current.keys;
    act(() => result.current.append());
    expect(result.current.keys.slice(0, 2)).toEqual(before);
    expect(before).not.toContain(result.current.keys[2]);
  });

  it("takes a removed row's key with it, so the rows after it keep theirs", () => {
    const { result } = renderHook(() => useEditedList(3));
    const [first, , third] = result.current.keys;
    act(() => result.current.removeAt(1));
    expect(result.current.keys).toEqual([first, third]);
  });

  it("follows a list replaced from outside by position", () => {
    const { result, rerender } = renderHook(({ count }) => useRowKeys(count), { initialProps: { count: 3 } });
    const [first] = result.current.keys;
    rerender({ count: 1 });
    expect(result.current.keys).toEqual([first]);
    rerender({ count: 2 });
    expect(result.current.keys[0]).toBe(first);
    expect(result.current.keys).toHaveLength(2);
  });
});
