export function defineSpieleElement(
  tagName: string,
  constructor: CustomElementConstructor,
  options?: ElementDefinitionOptions,
): void {
  if (customElements.get(tagName)) return;
  customElements.define(tagName, constructor, options);
}
