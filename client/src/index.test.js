import React from "react";
import { render } from "@testing-library/react";
import { Provider } from "react-redux";
import { store } from "./app/store";
import App from "./app/App";
import { TranslationProvider } from "./hooks/use-translation";

test("renders the root component correctly", () => {
  const { container } = render(
    <TranslationProvider>
      <Provider store={store}>
        <App />
      </Provider>
    </TranslationProvider>,
  );

  const rootComponent = container.firstChild;
  expect(rootComponent).toBeInTheDocument();
});
