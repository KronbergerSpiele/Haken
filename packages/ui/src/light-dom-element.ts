import { LitElement } from 'lit';

/** Lit base that renders into the light DOM so global CSS and hit-testing keep working. */
export class LightDomElement extends LitElement {
  protected override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  /** Commit a pending update synchronously for imperative session hosts. */
  renderNow(): void {
    if (this.isUpdatePending) {
      this.performUpdate();
    }
  }
}
