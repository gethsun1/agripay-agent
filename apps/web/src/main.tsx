import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, Link, RouterProvider } from "react-router-dom";
import { Layout } from "./components/Layout";
import { About } from "./pages/About";
import { Agent } from "./pages/Agent";
import { Developer } from "./pages/Developer";
import { Landing } from "./pages/Landing";
import { Receipts } from "./pages/Receipts";
import "./styles.css";
function RouteError() {
  return (
    <div className="state-page">
      <p className="kicker">Something went wrong</p>
      <h1>This route could not be rendered.</h1>
      <p>No task or payment was created. Return safely and try the read again.</p>
      <Link className="button" to="/">
        Return home
      </Link>
    </div>
  );
}
function NotFound() {
  return (
    <div className="state-page">
      <p className="kicker">404 · Field not found</p>
      <h1>This path is outside the registry.</h1>
      <p>The route you requested does not exist.</p>
      <Link className="button" to="/">
        Return home
      </Link>
    </div>
  );
}
const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Landing /> },
      { path: "agent", element: <Agent /> },
      { path: "receipts", element: <Receipts /> },
      { path: "developer", element: <Developer /> },
      { path: "about", element: <About /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);
const root = document.getElementById("root");
if (!root) throw new Error("Application root is missing");
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
