import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ArticleEditor } from "@/components/knowledge/article-editor";
import { anArticle } from "@/redux/knowledgeApi.test";

describe("ArticleEditor", () => {
  it("commits a section on blur with only that section, and rolls back on rejection", async () => {
    const onCommit = vi.fn(async (sections: Record<string, string>) => {
      if (sections.cause !== undefined) throw new Error("stale");
    });
    render(<ArticleEditor version={anArticle().draft} onCommit={onCommit} />);
    const steps = screen.getByLabelText("Steps");
    fireEvent.change(steps, { target: { value: "Renew, then restart" } });
    fireEvent.blur(steps);
    await waitFor(() => expect(onCommit).toHaveBeenCalledWith({ steps: "Renew, then restart" }));

    const cause = screen.getByLabelText("Cause");
    fireEvent.change(cause, { target: { value: "Expired certificate" } });
    fireEvent.blur(cause);
    await waitFor(() => expect(onCommit).toHaveBeenCalledWith({ cause: "Expired certificate" }));
    await waitFor(() => expect(cause).toHaveValue(""));
    expect(screen.getByText("This is the only section a client sees.")).toBeInTheDocument();
  });

  it("disables every section in read-only mode and does not commit an unchanged value", () => {
    const onCommit = vi.fn(async () => undefined);
    render(<ArticleEditor version={anArticle().draft} readOnly onCommit={onCommit} />);
    expect(screen.getByLabelText("Steps")).toBeDisabled();
    fireEvent.blur(screen.getByLabelText("Steps"));
    expect(onCommit).not.toHaveBeenCalled();
  });
});
