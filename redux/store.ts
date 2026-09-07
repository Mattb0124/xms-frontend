import { configureStore } from "@reduxjs/toolkit";
import { xmsApi } from "@/redux/api";

export function makeStore() {
  return configureStore({
    reducer: {
      [xmsApi.reducerPath]: xmsApi.reducer,
    },
    middleware: (getDefault) => getDefault().concat(xmsApi.middleware),
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
