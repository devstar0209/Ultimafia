import React from "react";
import ReactDOM from "react-dom";
import { BrowserRouter } from "react-router-dom";
import { CssBaseline, ThemeProvider } from "@mui/material";

import App from "./App";
import { adminTheme } from "./theme";

ReactDOM.render(
  <BrowserRouter>
    <ThemeProvider theme={adminTheme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </BrowserRouter>,
  document.getElementById("root")
);
