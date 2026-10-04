import "./styles/global.css";
import "./gymtime-app.js";

const app = document.querySelector("gymtime-app");
if (app) {
  const path = window.location.pathname;
  app.view = path === "/sign-in" ? "sign-in" : path.startsWith("/teams/") ? "team" : "app";
}
