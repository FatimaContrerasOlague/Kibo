import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { Login } from "./components/Login";
import { Register } from "./components/Register";
import { Home } from "./components/Home";
import { Calendar } from "./components/Calendar";
import { Recommendations } from "./components/Recommendations";
import { Chatbot } from "./components/Chatbot";
import { Library } from "./components/Library";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Login },
      { path: "register", Component: Register },
      { path: "home", Component: Home },
      { path: "calendar", Component: Calendar },
      { path: "recommendations", Component: Recommendations },
      { path: "chatbot", Component: Chatbot },
      { path: "library", Component: Library },
    ],
  },
]);
