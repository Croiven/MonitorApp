import { mount } from "svelte";
import App from "./App.svelte";
import { getDisplayLocale } from "./lib/datetime.js";
import "./app.css";

const locale = getDisplayLocale();
if (locale) {
  document.documentElement.lang = locale;
}

mount(App, { target: document.getElementById("app") });
