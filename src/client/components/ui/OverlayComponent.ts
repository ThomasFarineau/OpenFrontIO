import { LitElement, TemplateResult } from "lit";
import { state } from "lit/decorators.js";

export default abstract class OverlayComponent extends LitElement {
  @state() protected isVisible = false;

  public hide() {
    this.isVisible = false;
    this.requestUpdate();
  }

  show() {
    this.isVisible = true;
    this.requestUpdate();
  }

  abstract tick(): void;

  abstract renderComponent(): TemplateResult | null;

  protected render(): unknown {
    if (!this.isVisible) return null;
    return this.renderComponent();
  }

  shouldTransform(): boolean {
    return false;
  }
}
