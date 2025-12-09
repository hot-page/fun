import { html, svg, render } from 'lit-html'
import { Signal } from 'signal-polyfill'

export { html, svg }

export type RenderFunction = () => ReturnType<typeof html>
export type CleanupFunction = () => void
export type EffectFunction = () => CleanupFunction | void

export interface ComponentContext {
  internals: ElementInternals
  effect: (fn: EffectFunction) => void
  [key: string]: any // For observed attributes as signals
}

export type FunctionalComponent = (context: ComponentContext) => RenderFunction

export interface DefineOptions {
  component: FunctionalComponent
  attributes?: string[]
  useShadow?: boolean
}

function lightElement(fn: FunctionalComponent): void
function lightElement(observedAttributes: string[], fn: FunctionalComponent): void
function lightElement(
  fnOrAttrs: FunctionalComponent | string[],
  maybeFn?: FunctionalComponent
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
function shadowElement(observedAttributes: string[], fn: FunctionalComponent): void
function shadowElement(
  fnOrAttrs: FunctionalComponent | string[],
  maybeFn?: FunctionalComponent
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

export function define(options: DefineOptions) {
  const { component, attributes = [], useShadow = true } = options

  const elementName = component.name.replaceAll(/(.)([A-Z])/g, '$1-$2').toLowerCase()

  if (!elementName.includes('-')) {
    throw new Error(`Function ${component.name} must include at least one capital letter to be converted to a valid custom element name`)
  }

  if (customElements.get(elementName)) {
    throw new Error(`Custom element with name ${elementName} already defined`)
  }

  customElements.define(elementName, class extends HTMLElement {
    #template!: Signal.Computed<ReturnType<typeof html>>
    #watcher!: any
    #effects: EffectFunction[] = []
    #cleanups: CleanupFunction[] = []
    #attributeSignals: Map<string, Signal.State<string | null>> = new Map()
    #reflectionWatcher!: any

    static get observedAttributes() {
      return attributes
    }

    constructor() {
      super()
      if (useShadow) this.attachShadow({ mode: 'open' })

      const context: ComponentContext = {
        internals: this.attachInternals(),
        effect: (fn: EffectFunction) => {
          this.#effects.push(fn)
        }
      }

      attributes.forEach(attr => {
        const signal = new Signal.State(this.getAttribute(attr), {
          equals: (prev, next) => prev === next
        })
        this.#attributeSignals.set(attr, signal)
        context[attr] = signal

        Object.defineProperty(this, attr, {
          get() {
            return signal.get()
          },
          set(value: string | null) {
            signal.set(value)
          },
          enumerable: true,
          configurable: true
        })
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

      this.#reflectionWatcher = new Signal.subtle.Watcher(() => {
        queueMicrotask(() => {
          this.#attributeSignals.forEach((signal, attr) => {
            const value = signal.get()
            if (value === null) {
              this.removeAttribute(attr)
            } else {
              this.setAttribute(attr, value)
            }
          })

          this.#attributeSignals.forEach(signal => {
            this.#reflectionWatcher.watch(signal)
          })
        })
      })

      this.#attributeSignals.forEach(signal => {
        this.#reflectionWatcher.watch(signal)
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
