import { html, svg, render } from 'lit-html'
import { Signal } from 'signal-polyfill'

export { html, svg }

export type RenderFunction = () => ReturnType<typeof html>
export type CleanupFunction = () => void
export type EffectFunction = () => CleanupFunction | void

type AttributeSignals<Attrs extends string> = {
  [K in Attrs]: Signal.State<string | null>
}

export type ComponentContext<Attrs extends string = never> =
  AttributeSignals<Attrs> & {
    internals: ElementInternals
    effect: (fn: EffectFunction) => void
  }

export type FunctionalComponent<Attrs extends string = never> =
  (context: ComponentContext<Attrs>) => RenderFunction

export interface DefineOptions<Attrs extends string = never> {
  component: FunctionalComponent<Attrs>
  tagName?: string
  attributes?: Attrs[]
  useShadow?: boolean
  formAssociated?: boolean
}

const RESERVED_KEYS = new Set<string>(['internals', 'effect'])

function lightElement(fn: FunctionalComponent): void
function lightElement<Attrs extends string>(observedAttributes: Attrs[], fn: FunctionalComponent<Attrs>): void
function lightElement<Attrs extends string>(
  fnOrAttrs: FunctionalComponent | Attrs[],
  maybeFn?: FunctionalComponent<Attrs>
): void {
  if (typeof fnOrAttrs === 'function') {
    define({ component: fnOrAttrs, useShadow: false })
  } else {
    define({
      component: maybeFn!,
      attributes: fnOrAttrs,
      useShadow: false
    })
  }
}

function shadowElement(fn: FunctionalComponent): void
function shadowElement<Attrs extends string>(observedAttributes: Attrs[], fn: FunctionalComponent<Attrs>): void
function shadowElement<Attrs extends string>(
  fnOrAttrs: FunctionalComponent | Attrs[],
  maybeFn?: FunctionalComponent<Attrs>
): void {
  if (typeof fnOrAttrs === 'function') {
    define({ component: fnOrAttrs, useShadow: true })
  } else {
    define({
      component: maybeFn!,
      attributes: fnOrAttrs,
      useShadow: true
    })
  }
}

const state = <T>(value: T) => new Signal.State(value)

export { state, lightElement, shadowElement }

export function define<Attrs extends string = never>(options: DefineOptions<Attrs>) {
  const {
    component,
    tagName,
    attributes = [] as unknown as Attrs[],
    useShadow = true,
    formAssociated = false
  } = options

  const elementName = (tagName ?? component.name
    .replaceAll(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replaceAll(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase())

  if (!elementName.includes('-')) {
    throw new Error(`Function ${component.name} must include at least one capital letter to be converted to a valid custom element name`)
  }

  if (customElements.get(elementName)) {
    throw new Error(`Custom element with name ${elementName} already defined`)
  }

  for (const attr of attributes) {
    if (RESERVED_KEYS.has(attr)) {
      throw new Error(`Attribute name "${attr}" conflicts with a reserved context property.`)
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

      const context = {
        internals: this.attachInternals(),
        effect: (fn: EffectFunction) => {
          this.#effects.push(fn)
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

      const templateFn = component.call(this, context)

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
