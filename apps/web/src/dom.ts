/** A small helper for building DOM trees without a framework. */

/** What can be given as a child of an element. */
export type Child = Node | string | number | null | undefined | false | readonly Child[];

/** Attributes and listeners of an element: `on*` keys are listeners, `data-*` and others attributes. */
export interface Props {
  readonly [name: string]: unknown;
}

function append(parent: Node, child: Child): void {
  if (child === null || child === undefined || child === false) return;
  if (typeof child === 'string' || typeof child === 'number') {
    parent.appendChild(document.createTextNode(String(child)));
  } else if (child instanceof Node) {
    parent.appendChild(child);
  } else {
    for (const c of child) append(parent, c);
  }
}

/** Creates an element. `class` sets the class attribute; a function under `onclick` etc. listens. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props | null = null,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(props ?? {})) {
    if (value === null || value === undefined || value === false) continue;
    if (name.startsWith('on') && typeof value === 'function') {
      element.addEventListener(name.slice(2), value as EventListener);
    } else if (name === 'class') {
      element.className = String(value);
    } else if (value === true) {
      element.setAttribute(name, '');
    } else {
      element.setAttribute(name, String(value));
    }
  }
  append(element, children);
  return element;
}

/** Replaces the children of an element. */
export function setChildren(parent: Element, ...children: Child[]): void {
  parent.replaceChildren();
  append(parent, children);
}
