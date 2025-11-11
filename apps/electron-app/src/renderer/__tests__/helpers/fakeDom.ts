export type Listener = (event: any) => void;

function camelizeDataAttr(attr: string): string {
  return attr
    .replace(/^data-/, '')
    .split('-')
    .map((part, index) => (index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('');
}

export class FakeEventTarget {
  private listeners: Map<string, Set<Listener>> = new Map();

  addEventListener(type: string, listener: Listener): void {
    const set = this.listeners.get(type) ?? new Set();
    set.add(listener);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatchEvent(event: any): void {
    const listeners = this.listeners.get(event.type ?? event);
    if (!listeners) {
      return;
    }
    const payload = typeof event === 'string' ? { type: event } : event;
    if (!payload.target) {
      payload.target = this;
    }
    listeners.forEach((listener) => listener(payload));
  }
}

export class FakeElement extends FakeEventTarget {
  public textContent = '';
  public hidden = false;
  public disabled = false;
  public value = '';
  public dataset: Record<string, string> = {};
  public style: Record<string, string> = {};
  public ownerDocument?: FakeDocument;
  private dataAttrs: Record<string, string> = {};

  constructor(public readonly id: string, public tagName: string = 'div') {
    super();
  }

  click(): void {
    this.dispatchEvent({ type: 'click', target: this });
  }

  focus(): void {
    if (this.ownerDocument) {
      this.ownerDocument.activeElement = this;
    }
  }

  blur(): void {
    if (this.ownerDocument?.activeElement === this) {
      this.ownerDocument.activeElement = null;
    }
  }

  setDataAttribute(name: string, value: string): void {
    this.dataAttrs[name] = value;
    const camelKey = camelizeDataAttr(name);
    this.dataset[camelKey] = value;
    if (this.ownerDocument) {
      this.ownerDocument.registerDataAttribute(this, name, value);
    }
  }

  set text(value: string) {
    this.textContent = value;
  }

  getAttribute(name: string): string | undefined {
    if (name.startsWith('data-')) {
      return this.dataAttrs[name];
    }
    return undefined;
  }
}

export class FakeDocument {
  private elements = new Map<string, FakeElement>();
  private errorMap = new Map<string, FakeElement>();
  public activeElement: FakeElement | null = null;

  get body(): FakeElement {
    return this.getElementById('body') ?? this.createElement('body');
  }

  createElement(id: string, tagName = 'div'): FakeElement {
    const el = new FakeElement(id, tagName);
    this.register(el);
    return el;
  }

  register(element: FakeElement): void {
    element.ownerDocument = this;
    if (element.id) {
      this.elements.set(element.id, element);
    }
    Object.entries(element.dataset).forEach(([key, val]) => {
      if (key === 'errorFor') {
        this.errorMap.set(val, element);
      }
    });
  }

  registerDataAttribute(element: FakeElement, name: string, value: string): void {
    if (name === 'data-error-for') {
      this.errorMap.set(value, element);
    }
  }

  getElementById(id: string): FakeElement | null {
    return this.elements.get(id) ?? null;
  }

  querySelector(selector: string): FakeElement | null {
    const match = selector.match(/\[data-error-for="(.*)"\]/);
    if (match) {
      return this.errorMap.get(match[1]) ?? null;
    }
    return null;
  }
}

export class FakeWindow extends FakeEventTarget {
  public document: FakeDocument;
  public navigator: Record<string, unknown> = {};
  public closeCalled = false;

  constructor(doc: FakeDocument) {
    super();
    this.document = doc;
  }

  close(): void {
    this.closeCalled = true;
  }
}

export type DomGlobals = {
  window: FakeWindow;
  document: FakeDocument;
};

export function installDomGlobals(doc: FakeDocument, win: FakeWindow): () => void {
  const previousWindow = (globalThis as any).window;
  const previousDocument = (globalThis as any).document;
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

  (globalThis as any).window = win as unknown as Window;
  (globalThis as any).document = doc as unknown as Document;
  Object.defineProperty(globalThis, 'navigator', {
    value: win.navigator as unknown as Navigator,
    configurable: true,
    writable: true,
  });

  return () => {
    (globalThis as any).window = previousWindow;
    (globalThis as any).document = previousDocument;
    if (navigatorDescriptor) {
      Object.defineProperty(globalThis, 'navigator', navigatorDescriptor);
    } else {
      delete (globalThis as any).navigator;
    }
  };
}
