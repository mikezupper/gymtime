import { createContext } from "@lit/context";
import type { AppAdapter } from "../runtime/adapter.js";

export const adapterContext = createContext<AppAdapter>(Symbol("gymtime-adapter"));
