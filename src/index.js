import { html, render } from 'lit-html'
import { Signal } from 'signal-polyfill'

export const lightElement = (fn) => define(fn, { useShadow: false })
export const shadowElement = (fn) => define(fn)

export function define(fn, { useShadow = true } = {}) {
  const elementName = fn.name.replaceAll(/(.)([A-Z])/g, '$1-$2').toLowerCase()

  if (!elementName.includes('-')) {
    throw new Error(`Function ${fn.name} must include at least one capital letter to be converted to a valid custom element name`)
  }

  if (customElements.get(elementName)) {
    throw new Error(`Custom element with name ${elementName} already defined`)
  }

  customElements.define(elementName, class extends HTMLElement {
    constructor() {
      super()
      if (useShadow) this.attachShadow({ mode: 'open' })

      const templateFn = fn.call(this, {
        html,
        internals: this.attachInternals(),
        state: (value) => new Signal.State(value),
      })

      this.template = new Signal.Computed(() => templateFn())

      const renderTemplate = () =>
        render(this.template.get(), useShadow ? this.shadowRoot : this)

      let renderPending = false
      const watcher = new Signal.subtle.Watcher(() => {
        if (renderPending) return
        queueMicrotask(() => {
          renderPending = false
          renderTemplate()
          watcher.watch()
        })
      })

      watcher.watch(this.template)

      renderTemplate()
    }
  })
}

