import "./gymtime-app.js";
import { mountApplication } from "./runtime/application.js";
import "./styles/global.css";

const app = document.querySelector("gymtime-app");
if (app) {
  mountApplication(app);
  const path = window.location.pathname;
  app.view =
    path === "/sign-in"
      ? "sign-in"
      : path.startsWith("/teams/")
        ? "team"
        : "app";
  app.token = path.split("/")[2] ?? "";
}
