import { render, type RenderResult } from "@testing-library/react";
import type { ReactNode } from "react";
import { Provider } from "react-redux";
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
