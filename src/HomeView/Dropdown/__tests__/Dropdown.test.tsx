// import API mocking utilities from Mock Service Worker
import { rest } from "msw";
import { setupServer } from "msw/node";

// import react-testing methods
import { render, fireEvent, waitFor, screen, within, wait, act } from "@testing-library/react";

// add custom jest matchers from jest-dom
import "@testing-library/jest-dom";
// the component to test
import { Dropdown } from "../index";
import tree from "./sampleTree.json";
import templates from "./sampleTemplates.json";
// required libraries
import { QueryClient, QueryClientProvider } from "react-query";

// declare which API requests to mock
const server = setupServer(
  rest.post("/api/github", (req, res, ctx) => {
    // respond using a mocked JSON body
    return res(ctx.json(tree));
  }),
  rest.get("/api/templates", (req, res, ctx) => {
    return res(ctx.json(templates));
  })
);

// establish API mocking before all tests
beforeAll(() => server.listen());
// reset any request handlers that are declared as a part of our tests
// (i.e. for testing one-time error scenarios)
afterEach(() => server.resetHandlers());
// clean up once the tests are done
afterAll(() => server.close());

test("sends API request on search", async () => {
  const queryClient = new QueryClient();
  // arrange
  render(
    <QueryClientProvider client={queryClient}>
      <Dropdown />
    </QueryClientProvider>
  );
  // act
  const autocomplete = screen.getByRole("combobox");
  const input: HTMLInputElement = within(autocomplete).getByLabelText("Select a template") as HTMLInputElement;

  const searchValue = "react-boiler";
  const templateValue = "react-boilerplate";
  autocomplete.focus();
  // assign value to input field
  fireEvent.change(input, { target: { value: searchValue } });
  // pause for arbitrary amount of time for popup to render
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
  });
  // now we can access the options here
  const option = screen.getByText("react-boilerplate");
  // navigate to the first item in the autocomplete box
  fireEvent.keyDown(autocomplete, { key: "ArrowDown" });
  // select the first item
  fireEvent.keyDown(autocomplete, { key: "Enter" });
  // check the new value of the input field
  expect(input.value).toEqual(templateValue);
  // fireEvent.change(screen.getByLabelText("Link to repository"), {
  //   target: { value: "https://github.com/structure-codes/vscode-tree-language" },
  // });
  // fireEvent.click(screen.getByText("GO"));
});
