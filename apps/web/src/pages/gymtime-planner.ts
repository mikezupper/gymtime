import { define } from "@gyral/core";
import "../components/gymtime-help-tip.js";
import { plannerStyles } from "../components/planner-styles.js";
import { revalidate } from "../runtime/commands.js";
import "./gymtime-accounts.js";
import { workspaceParsers } from "./workspace/intents.js";
import {
  loadGuidance,
  loadWorkspace,
  locateWorkspace,
  workspaceInitial,
  workspaceProps,
  workspaceUpdate,
  type WorkspaceMsg,
  type WorkspaceProps,
  type WorkspaceState,
} from "./workspace/model.js";
import { workspaceView } from "./workspace/view.js";

export const GymtimePlanner = define<
  WorkspaceState,
  WorkspaceMsg,
  WorkspaceProps
>()("gymtime-planner", {
  props: workspaceProps,
  init: (p) => [
    workspaceInitial,
    p.session
      ? [loadWorkspace(0), loadGuidance(p.session.user_id), locateWorkspace()]
      : [],
  ],
  subscriptions: () => [revalidate<WorkspaceMsg>({ _tag: "Refresh" })],
  intent: workspaceParsers,
  update: workspaceUpdate,
  view: (s, _i, { props: p }) =>
    workspaceView({ ...s, ...p, busy: s.operation !== "Idle" }),
  styles: plannerStyles,
});
