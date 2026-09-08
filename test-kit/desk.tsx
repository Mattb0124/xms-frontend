import { render, type RenderResult } from "@testing-library/react";
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { ContentHeaderBar } from "@/components/shell/content-header-bar";
import { Toaster, ToastProvider } from "@/components/xms/toast";
import { makeStore } from "@/redux/store";

export { json, stubFetch, type RecordedCall } from "@/test-kit/portal";

/** Renders a desk component with a fresh store and the toast provider. */
export function renderDesk(children: ReactNode): RenderResult {
  const store = makeStore();
  return render(
    <Provider store={store}>
      <ToastProvider ttlMs={0}>
        {children}
        <Toaster />
      </ToastProvider>
    </Provider>,
  );
}

/**
 * The same, inside a real toolbar band, for a screen whose controls live on
 * the grey strip.
 *
 * `HeaderFilters`, `HeaderSearch` and `HeaderAction` portal into slots the
 * bar owns, so with no bar around the screen those controls render nowhere
 * and a test cannot reach them. Screens used to keep a duplicate of the
 * control in the page body to work around it, which is a second control in
 * the product to make one assertion possible. This mounts the bar itself, so
 * the test drives the control the reader actually sees.
 *
 * The caller must mock `next/navigation`: the bar's screen switcher pushes.
 */
export function renderDeskInShell(children: ReactNode): RenderResult {
  return renderDesk(
    <ContentHeaderBar current={undefined} screens={[]} onToggleSidebar={() => {}}>
      {children}
    </ContentHeaderBar>,
  );
}
