import type { ReactiveController, ReactiveControllerHost } from "lit";

/** Refresh after returning to a page; detach both listeners with the host. */
export class Revalidate implements ReactiveController {
  constructor(host: ReactiveControllerHost, private readonly refresh: () => void) {
    host.addController(this);
  }
  private readonly visible = () => {
    if (document.visibilityState === "visible") this.refresh();
  };
  hostConnected() {
    window.addEventListener("focus", this.visible);
    document.addEventListener("visibilitychange", this.visible);
  }
  hostDisconnected() {
    window.removeEventListener("focus", this.visible);
    document.removeEventListener("visibilitychange", this.visible);
  }
}
