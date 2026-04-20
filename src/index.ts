import { html, svg, render } from 'lit-html'
import { Signal } from 'signal-polyfill'

export { html, svg }

export type RenderFunction = () => ReturnType<typeof html>
export type CleanupFunction = () => void
export type EffectFunction = () => CleanupFunction | void
export type StylePropsFunction = (
  props: Record<string, string | number | null>
) => void

type AttributeSignals<Attrs extends string> = {
  [K in Attrs]: Signal.State<string | null>
}

export type ComponentContext<Attrs extends string = never> =
  AttributeSignals<Attrs> & {
    internals: ElementInternals
    effect: (fn: EffectFunction) => void
    styleProps: StylePropsFunction
  }

export type FunctionalComponent<Attrs extends string = never> =
  (context: ComponentContext<Attrs>) => RenderFunction

export interface DefineOptions<Attrs extends string = never> {
  setup: FunctionalComponent<Attrs>
  tagName?: string
  attributes?: Attrs[]
  useShadow?: boolean
  formAssociated?: boolean
  styles?: string
}

const RESERVED_KEYS = new Set<string>(['internals', 'effect', 'styleProps'])

// Convert camelCase property key to kebab-case CSS custom property name.
// `hueShift` -> `--hue-shift`, `hue` -> `--hue`
function toCustomProperty(key: string): string {
  const kebab = key
    .replaceAll(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replaceAll(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()
  return `--${kebab}`
}

function lightElement(fn: FunctionalComponent): void
function lightElement(styles: string, fn: FunctionalComponent): void
function lightElement<Attrs extends string>(
  observedAttributes: Attrs[],
  fn: FunctionalComponent<Attrs>
): void
function lightElement<Attrs extends string>(
  observedAttributes: Attrs[],
  styles: string,
  fn: FunctionalComponent<Attrs>
): void
function lightElement<Attrs extends string>(
  a: FunctionalComponent | Attrs[] | string,
  b?: FunctionalComponent<Attrs> | string,
  c?: FunctionalComponent<Attrs>
): void {
  const { setup, attributes, styles } = resolveOverload<Attrs>(a, b, c)
  define({ setup, attributes, styles, useShadow: false })
}

function shadowElement(fn: FunctionalComponent): void
function shadowElement(styles: string, fn: FunctionalComponent): void
function shadowElement<Attrs extends string>(
  observedAttributes: Attrs[],
  fn: FunctionalComponent<Attrs>
): void
function shadowElement<Attrs extends string>(
  observedAttributes: Attrs[],
  styles: string,
  fn: FunctionalComponent<Attrs>
): void
function shadowElement<Attrs extends string>(
  a: FunctionalComponent | Attrs[] | string,
  b?: FunctionalComponent<Attrs> | string,
  c?: FunctionalComponent<Attrs>
): void {
  const { setup, attributes, styles } = resolveOverload<Attrs>(a, b, c)
  define({ setup, attributes, styles, useShadow: true })
}

function resolveOverload<Attrs extends string>(
  a: FunctionalComponent | Attrs[] | string,
  b?: FunctionalComponent<Attrs> | string,
  c?: FunctionalComponent<Attrs>
): { setup: FunctionalComponent<Attrs>; attributes?: Attrs[]; styles?: string } {
  if (typeof a === 'function') {
    return { setup: a as FunctionalComponent<Attrs> }
  }
  if (typeof a === 'string') {
    return { styles: a, setup: b as FunctionalComponent<Attrs> }
  }
  if (typeof b === 'function') {
    return { attributes: a, setup: b }
  }
  return { attributes: a, styles: b, setup: c! }
}

const state = <T>(value: T) => new Signal.State(value)

export { state, lightElement, shadowElement }

export function define<Attrs extends string = never>(options: DefineOptions<Attrs>) {
  const {
    setup,
    tagName,
    attributes = [] as unknown as Attrs[],
    useShadow = true,
    formAssociated = false,
    styles
  } = options

  const elementName = (tagName ?? setup.name
    .replaceAll(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replaceAll(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase())

  if (!elementName.includes('-')) {
    throw new Error(`Function ${setup.name} must include at least one capital letter to be converted to a valid custom element name`)
  }

  if (customElements.get(elementName)) {
    throw new Error(`Custom element with name ${elementName} already defined`)
  }

  for (const attr of attributes) {
    if (RESERVED_KEYS.has(attr)) {
      throw new Error(`Attribute name "${attr}" conflicts with a reserved context property.`)
    }
  }

  // One constructed stylesheet per element type, shared across all instances.
  // For shadow DOM, it's adopted into each shadowRoot.
  // For light DOM, it's wrapped in @scope and adopted into the document once.
  let stylesheet: CSSStyleSheet | undefined
  if (styles !== undefined) {
    stylesheet = new CSSStyleSheet()
    if (useShadow) {
      stylesheet.replaceSync(styles)
    } else {
      stylesheet.replaceSync(`@scope (${elementName}) { ${styles} }`)
      document.adoptedStyleSheets = [
        ...document.adoptedStyleSheets,
        stylesheet
      ]
    }
  }

  customElements.define(elementName, class extends HTMLElement {
    #template!: Signal.Computed<ReturnType<typeof html>>
    #watcher!: any
    #effects: EffectFunction[] = []
    #cleanups: CleanupFunction[] = []
    #attributeSignals: Map<string, Signal.State<string | null>> = new Map()

    static get observedAttributes() {
      return attributes
    }

    static get formAssociated() {
      return formAssociated
    }

    constructor() {
      super()
      if (useShadow) this.attachShadow({ mode: 'open' })

      if (stylesheet && this.shadowRoot) {
        this.shadowRoot.adoptedStyleSheets = [
          ...this.shadowRoot.adoptedStyleSheets,
          stylesheet
        ]
      }

      const context = {
        internals: this.attachInternals(),
        effect: (fn: EffectFunction) => {
          this.#effects.push(fn)
        },
        styleProps: (props: Record<string, string | number | null>) => {
          for (const key in props) {
            const value = props[key]
            const name = toCustomProperty(key)
            if (value === null) {
              this.style.removeProperty(name)
            } else {
              this.style.setProperty(name, String(value))
            }
          }
        }
      } as ComponentContext<Attrs>

      attributes.forEach(attr => {
        const signal = new Signal.State(this.getAttribute(attr), {
          equals: (prev, next) => prev === next
        })
        this.#attributeSignals.set(attr, signal)
        ;(context as Record<string, unknown>)[attr] = signal

        Object.defineProperty(this, attr, {
          get() {
            return signal.get()
          },
          set(value: unknown) {
            if (value !== null && typeof value !== 'string') {
              throw new TypeError(`Attribute "${attr}" only accepts strings or null, got ${typeof value}.`)
            }
            signal.set(value)
          },
          enumerable: true,
          configurable: true
        })

        const watcher = new Signal.subtle.Watcher(() => {
          // Microtask required: setAttribute triggers attributeChangedCallback
          // which calls signal.set(), and writing to a signal inside a watcher
          // notify callback is not allowed.
          queueMicrotask(() => {
            const value = signal.get()
            if (value === null) {
              this.removeAttribute(attr)
            } else {
              this.setAttribute(attr, value)
            }
            watcher.watch()
          })
        })
        watcher.watch(signal)
      })

      const templateFn = setup.call(this, context)

      this.#template = new Signal.Computed(() => templateFn())

      const renderTemplate = () =>
        render(this.#template.get(), useShadow ? this.shadowRoot! : this)

      let renderPending = false
      this.#watcher = new Signal.subtle.Watcher(() => {
        if (renderPending) return
        renderPending = true
        queueMicrotask(() => {
          renderPending = false
          renderTemplate()
          this.#watcher.watch()
        })
      })

      this.#watcher.watch(this.#template)

      renderTemplate()
    }

    connectedCallback() {
      this.#watcher.watch(this.#template)
      this.#cleanups = this.#effects
        .map(effect => effect())
        .filter((cleanup): cleanup is CleanupFunction =>
          typeof cleanup === 'function'
        )
    }

    disconnectedCallback() {
      this.#watcher.unwatch(this.#template)
      this.#cleanups.forEach(cleanup => cleanup())
      this.#cleanups = []
    }

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
      this.#attributeSignals.get(name)?.set(newValue)
    }
  })
}
