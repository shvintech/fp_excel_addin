import * as React from "react";
import { createRoot } from "react-dom/client";
import App from "./components/App";
import { FluentProvider, webLightTheme } from "@fluentui/react-components";

/* global document, Office, HTMLElement */

const rootElement: HTMLElement | null = document.getElementById("container");
const root = rootElement ? createRoot(rootElement) : undefined;

/* Render application after Office initializes */
Office.onReady(() => {
  console.log("office ready");
  root?.render(
    <FluentProvider theme={webLightTheme}>
      <App />
    </FluentProvider>
  );
});

if (import.meta.hot) {
  import.meta.hot.accept("./components/App", (mod) => {
    if (mod?.default) {
      root?.render(<mod.default />);
    }
  });
}
