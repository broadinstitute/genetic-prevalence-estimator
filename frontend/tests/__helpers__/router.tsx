import React, { ReactNode } from "react";
import { BrowserRouter } from "react-router-dom";

export const withDummyRouter = (children: ReactNode): JSX.Element => (
  <BrowserRouter>{children}</BrowserRouter>
);
