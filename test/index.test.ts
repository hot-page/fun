import { expect } from 'chai'
import { html, svg, define, lightElement, shadowElement, state } from '../src/index.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const nextMicrotask = () => new Promise(resolve => queueMicrotask(resolve))

const mount = async (html: string): Promise<HTMLElement> => {
  document.body.innerHTML = html
  await nextMicrotask()
  return document.body.firstElementChild as HTMLElement
}

afterEach(() => { document.body.innerHTML = '' })

// ---------------------------------------------------------------------------
// 1. Tag name derivation
// ---------------------------------------------------------------------------

describe('tag name derivation', () => {
  it('registers the element under the given tagName', () => {
    define({ setup: function TagDerive() { return () => html`` }, tagName: 'tag-derive' })
    expect(customElements.get('tag-derive')).to.exist
  })

  it('auto-derives kebab-case tag name from camelCase function name', () => {
    define({ setup: function AutoKebab() { return () => html`` } })
    expect(customElements.get('auto-kebab')).to.exist
  })

  it('throws when function name produces no hyphen', () => {
    expect(() =>
      define({ setup: function nohyphen() { return () => html`` }, tagName: 'nohyphen' })
    ).to.throw(/valid custom element name/)
  })

  it('throws when the tag name is already registered', () => {
    define({ setup: function AlreadyDefined() { return () => html`` }, tagName: 'already-defined' })
    expect(() =>
      define({ setup: function AlreadyDefined2() { return () => html`` }, tagName: 'already-defined' })
    ).to.throw(/already defined/)
  })
})

// ---------------------------------------------------------------------------
// 2. Shadow DOM rendering (useShadow: true / default)
// ---------------------------------------------------------------------------

describe('shadow DOM rendering', () => {
  it('attaches an open shadow root', async () => {
    define({ tagName: 'shadow-root-test', setup: function ShadowRootTest() { return () => html`<p>shadow</p>` } })
    const el = await mount('<shadow-root-test></shadow-root-test>')
    expect(el.shadowRoot).to.exist
  })

  it('renders template content into shadow root', async () => {
    define({ tagName: 'shadow-render', setup: function ShadowRender() { return () => html`<span id="inner">hello</span>` } })
    const el = await mount('<shadow-render></shadow-render>')
    expect(el.shadowRoot!.querySelector('#inner')!.textContent).to.equal('hello')
  })
})

// ---------------------------------------------------------------------------
// 3. Light DOM rendering (useShadow: false)
// ---------------------------------------------------------------------------

describe('light DOM rendering', () => {
  it('does NOT attach a shadow root', async () => {
    define({ tagName: 'light-dom-verify', useShadow: false, setup: function LightDomVerify() { return () => html`` } })
    const el = await mount('<light-dom-verify></light-dom-verify>')
    expect(el.shadowRoot).to.be.null
  })

  it('renders template content into the element itself', async () => {
    define({ tagName: 'light-content', useShadow: false, setup: function LightContent() { return () => html`<em id="em">light</em>` } })
    const el = await mount('<light-content></light-content>')
    expect(el.querySelector('#em')!.textContent).to.equal('light')
  })
})

// ---------------------------------------------------------------------------
// 4. Attribute → signal binding (initial value)
// ---------------------------------------------------------------------------

describe('attribute → signal binding', () => {
  it('reads the initial attribute value into the signal', async () => {
    let capturedSignal: any
    define({
      tagName: 'attr-init',
      attributes: ['color'],
      setup: function AttrInit({ color }) { capturedSignal = color; return () => html`` }
    })
    await mount('<attr-init color="red"></attr-init>')
    expect(capturedSignal.get()).to.equal('red')
  })

  it('signal is null when attribute is absent', async () => {
    let capturedSignal: any
    define({
      tagName: 'attr-absent',
      attributes: ['color'],
      setup: function AttrAbsent({ color }) { capturedSignal = color; return () => html`` }
    })
    await mount('<attr-absent></attr-absent>')
    expect(capturedSignal.get()).to.be.null
  })

  it('attributeChangedCallback updates the signal', async () => {
    let capturedSignal: any
    define({
      tagName: 'attr-change',
      attributes: ['value'],
      setup: function AttrChange({ value }) { capturedSignal = value; return () => html`` }
    })
    const el = await mount('<attr-change value="a"></attr-change>')
    expect(capturedSignal.get()).to.equal('a')
    el.setAttribute('value', 'b')
    expect(capturedSignal.get()).to.equal('b')
  })

  it('removing attribute sets signal to null', async () => {
    let capturedSignal: any
    define({
      tagName: 'attr-remove',
      attributes: ['value'],
      setup: function AttrRemove({ value }) { capturedSignal = value; return () => html`` }
    })
    const el = await mount('<attr-remove value="x"></attr-remove>')
    el.removeAttribute('value')
    expect(capturedSignal.get()).to.be.null
  })

  it('throws when an attribute name conflicts with reserved key "internals"', () => {
    expect(() =>
      define({ tagName: 'reserved-internals', attributes: ['internals' as any], setup: function ReservedInternals() { return () => html`` } })
    ).to.throw(/reserved/)
  })

  it('throws when an attribute name conflicts with reserved key "effect"', () => {
    expect(() =>
      define({ tagName: 'reserved-effect', attributes: ['effect' as any], setup: function ReservedEffect() { return () => html`` } })
    ).to.throw(/reserved/)
  })
})

// ---------------------------------------------------------------------------
// 5. Signal → attribute reflection
// ---------------------------------------------------------------------------

describe('signal → attribute reflection', () => {
  it('setting signal value reflects to DOM attribute', async () => {
    let capturedSignal: any
    define({
      tagName: 'reflect-set',
      attributes: ['color'],
      setup: function ReflectSet({ color }) { capturedSignal = color; return () => html`` }
    })
    const el = await mount('<reflect-set></reflect-set>')
    capturedSignal.set('blue')
    await nextMicrotask()
    expect(el.getAttribute('color')).to.equal('blue')
  })

  it('setting signal to null removes the DOM attribute', async () => {
    let capturedSignal: any
    define({
      tagName: 'reflect-null',
      attributes: ['color'],
      setup: function ReflectNull({ color }) { capturedSignal = color; return () => html`` }
    })
    const el = await mount('<reflect-null color="green"></reflect-null>')
    capturedSignal.set(null)
    await nextMicrotask()
    expect(el.hasAttribute('color')).to.be.false
  })

  it('property setter reflects value via signal', async () => {
    define({
      tagName: 'prop-setter',
      attributes: ['size'],
      setup: function PropSetter() { return () => html`` }
    })
    const el = await mount('<prop-setter></prop-setter>') as any
    el.size = 'large'
    await nextMicrotask()
    expect(el.getAttribute('size')).to.equal('large')
  })

  it('property setter throws for non-string non-null values', async () => {
    define({
      tagName: 'prop-type-error',
      attributes: ['count'],
      setup: function PropTypeError() { return () => html`` }
    })
    const el = await mount('<prop-type-error></prop-type-error>') as any
    expect(() => { el.count = 42 }).to.throw(TypeError)
  })
})

// ---------------------------------------------------------------------------
// 6. Reactive re-rendering
// ---------------------------------------------------------------------------

describe('reactive re-rendering', () => {
  it('re-renders when a signal used in the template changes', async () => {
    const count = state(0)
    define({
      tagName: 'reactive-render',
      setup: function ReactiveRender() { return () => html`<span>${count.get()}</span>` }
    })
    const el = await mount('<reactive-render></reactive-render>')
    expect(el.shadowRoot!.querySelector('span')!.textContent).to.equal('0')
    count.set(1)
    await nextMicrotask()
    expect(el.shadowRoot!.querySelector('span')!.textContent).to.equal('1')
  })

  it('coalesces multiple signal updates into one render', async () => {
    let renderCount = 0
    const a = state('a')
    const b = state('b')
    define({
      tagName: 'coalesce-render',
      setup: function CoalesceRender() {
        return () => { renderCount++; return html`${a.get()}${b.get()}` }
      }
    })
    await mount('<coalesce-render></coalesce-render>')
    const baseRenders = renderCount
    a.set('A')
    b.set('B')
    await nextMicrotask()
    expect(renderCount - baseRenders).to.equal(1)
  })

  it('re-renders when an observed attribute changes', async () => {
    define({
      tagName: 'attr-rerender',
      attributes: ['label'],
      setup: function AttrRerender({ label }) { return () => html`<span>${label.get()}</span>` }
    })
    const el = await mount('<attr-rerender label="before"></attr-rerender>')
    el.setAttribute('label', 'after')
    await nextMicrotask()
    expect(el.shadowRoot!.querySelector('span')!.textContent).to.equal('after')
  })
})

// ---------------------------------------------------------------------------
// 7. Effect lifecycle
// ---------------------------------------------------------------------------

describe('effect lifecycle', () => {
  it('effect runs on connectedCallback', async () => {
    let ran = false
    define({
      tagName: 'effect-connected',
      setup: function EffectConnected({ effect }) {
        effect(() => { ran = true })
        return () => html``
      }
    })
    expect(ran).to.be.false
    await mount('<effect-connected></effect-connected>')
    expect(ran).to.be.true
  })

  it('effect cleanup runs on disconnectedCallback', async () => {
    let cleaned = false
    define({
      tagName: 'effect-cleanup',
      setup: function EffectCleanup({ effect }) {
        effect(() => () => { cleaned = true })
        return () => html``
      }
    })
    const el = await mount('<effect-cleanup></effect-cleanup>')
    expect(cleaned).to.be.false
    el.remove()
    expect(cleaned).to.be.true
  })

  it('cleanup is not called when effect returns nothing', async () => {
    define({
      tagName: 'effect-no-cleanup',
      setup: function EffectNoCleanup({ effect }) {
        effect(() => { /* no return */ })
        return () => html``
      }
    })
    const el = await mount('<effect-no-cleanup></effect-no-cleanup>')
    expect(() => el.remove()).to.not.throw()
  })

  it('re-connecting re-runs effects', async () => {
    let runCount = 0
    define({
      tagName: 'effect-reconnect',
      setup: function EffectReconnect({ effect }) {
        effect(() => { runCount++ })
        return () => html``
      }
    })
    const el = await mount('<effect-reconnect></effect-reconnect>')
    expect(runCount).to.equal(1)
    const parent = el.parentElement!
    el.remove()
    parent.appendChild(el)
    await nextMicrotask()
    expect(runCount).to.equal(2)
  })

  it('multiple effects all run and clean up', async () => {
    const log: string[] = []
    define({
      tagName: 'multi-effect',
      setup: function MultiEffect({ effect }) {
        effect(() => { log.push('a'); return () => log.push('~a') })
        effect(() => { log.push('b'); return () => log.push('~b') })
        return () => html``
      }
    })
    const el = await mount('<multi-effect></multi-effect>')
    expect(log).to.deep.equal(['a', 'b'])
    el.remove()
    expect(log).to.deep.equal(['a', 'b', '~a', '~b'])
  })

  it('effect re-runs when a tracked signal changes', async () => {
    let runCount = 0
    const count = state(0)
    define({
      tagName: 'effect-auto-track',
      setup: function EffectAutoTrack({ effect }) {
        effect(() => {
          count.get() // Track this signal
          runCount++
        })
        return () => html``
      }
    })
    await mount('<effect-auto-track></effect-auto-track>')
    expect(runCount).to.equal(1)
    
    count.set(1)
    await nextMicrotask()
    expect(runCount).to.equal(2)
    
    count.set(2)
    await nextMicrotask()
    expect(runCount).to.equal(3)
  })

  it('effect does not re-run when no signals are tracked', async () => {
    let runCount = 0
    const count = state(0)
    define({
      tagName: 'effect-no-track',
      setup: function EffectNoTrack({ effect }) {
        effect(() => {
          runCount++
          // Don't read any signals
        })
        return () => html``
      }
    })
    await mount('<effect-no-track></effect-no-track>')
    expect(runCount).to.equal(1)
    
    count.set(1)
    await nextMicrotask()
    expect(runCount).to.equal(1) // Should not have re-run
  })

  it('effect re-runs when observed attribute signal changes', async () => {
    const log: string[] = []
    define({
      tagName: 'effect-attr-track',
      attributes: ['color'],
      setup: function EffectAttrTrack({ color, effect }) {
        effect(() => {
          log.push(`color:${color.get()}`)
        })
        return () => html``
      }
    })
    const el = await mount('<effect-attr-track color="red"></effect-attr-track>')
    expect(log).to.deep.equal(['color:red'])
    
    el.setAttribute('color', 'blue')
    await nextMicrotask()
    expect(log).to.deep.equal(['color:red', 'color:blue'])
  })

  it('effect cleanup runs before re-running', async () => {
    const log: string[] = []
    const count = state(0)
    define({
      tagName: 'effect-cleanup-rerun',
      setup: function EffectCleanupRerun({ effect }) {
        effect(() => {
          const val = count.get()
          log.push(`run:${val}`)
          return () => log.push(`cleanup:${val}`)
        })
        return () => html``
      }
    })
    await mount('<effect-cleanup-rerun></effect-cleanup-rerun>')
    expect(log).to.deep.equal(['run:0'])
    
    count.set(1)
    await nextMicrotask()
    expect(log).to.deep.equal(['run:0', 'cleanup:0', 'run:1'])
    
    count.set(2)
    await nextMicrotask()
    expect(log).to.deep.equal(['run:0', 'cleanup:0', 'run:1', 'cleanup:1', 'run:2'])
  })

  it('effect tracks multiple signals', async () => {
    let runCount = 0
    const a = state(0)
    const b = state(0)
    define({
      tagName: 'effect-multi-signal',
      setup: function EffectMultiSignal({ effect }) {
        effect(() => {
          a.get()
          b.get()
          runCount++
        })
        return () => html``
      }
    })
    await mount('<effect-multi-signal></effect-multi-signal>')
    expect(runCount).to.equal(1)
    
    a.set(1)
    await nextMicrotask()
    expect(runCount).to.equal(2)
    
    b.set(1)
    await nextMicrotask()
    expect(runCount).to.equal(3)
  })

  it('effect can conditionally track signals', async () => {
    let runCount = 0
    const enabled = state(false)
    const value = state(0)
    define({
      tagName: 'effect-conditional-track',
      setup: function EffectConditionalTrack({ effect }) {
        effect(() => {
          runCount++
          if (enabled.get()) {
            value.get() // Only track value when enabled
          }
        })
        return () => html``
      }
    })
    await mount('<effect-conditional-track></effect-conditional-track>')
    expect(runCount).to.equal(1)
    
    // value changes but effect shouldn't re-run (not tracking it yet)
    value.set(1)
    await nextMicrotask()
    expect(runCount).to.equal(1)
    
    // Enable tracking
    enabled.set(true)
    await nextMicrotask()
    expect(runCount).to.equal(2)
    
    // Now value changes should trigger re-runs
    value.set(2)
    await nextMicrotask()
    expect(runCount).to.equal(3)
  })

  it('effect with validation use case', async () => {
    const errors: string[] = []
    define({
      tagName: 'effect-validation',
      attributes: ['size'],
      setup: function EffectValidation({ size, effect }) {
        effect(() => {
          const value = size.get()
          const validSizes = ['sm', 'md', 'lg']
          if (value && !validSizes.includes(value)) {
            errors.push(`Invalid size: ${value}`)
          }
        })
        return () => html``
      }
    })
    const el = await mount('<effect-validation size="md"></effect-validation>')
    expect(errors).to.deep.equal([])
    
    el.setAttribute('size', 'invalid')
    await nextMicrotask()
    expect(errors).to.deep.equal(['Invalid size: invalid'])
    
    el.setAttribute('size', 'lg')
    await nextMicrotask()
    expect(errors).to.deep.equal(['Invalid size: invalid']) // No new error
    
    el.setAttribute('size', 'bad')
    await nextMicrotask()
    expect(errors).to.deep.equal(['Invalid size: invalid', 'Invalid size: bad'])
  })

  it('effect cleanup runs on disconnect after signal changes', async () => {
    const log: string[] = []
    const count = state(0)
    define({
      tagName: 'effect-disconnect-after-change',
      setup: function EffectDisconnectAfterChange({ effect }) {
        effect(() => {
          const val = count.get()
          log.push(`run:${val}`)
          return () => log.push(`cleanup:${val}`)
        })
        return () => html``
      }
    })
    const el = await mount('<effect-disconnect-after-change></effect-disconnect-after-change>')
    expect(log).to.deep.equal(['run:0'])
    
    count.set(5)
    await nextMicrotask()
    expect(log).to.deep.equal(['run:0', 'cleanup:0', 'run:5'])
    
    el.remove()
    expect(log).to.deep.equal(['run:0', 'cleanup:0', 'run:5', 'cleanup:5'])
  })

  it('roll-your-own reactivity with manual DOM updates', async function() {
    define({
      tagName: 'manual-dom-counter',
      attributes: ['count'],
      setup: function ManualDomCounter({ count, effect }) {
        effect(() => {
          const span = this.shadowRoot!.querySelector('#value')
          span!.textContent = count.get() || '0'
        })
        
        return '<button id="dec">-</button><span id="value"></span><button id="inc">+</button>'
      }
    })
    
    const el = await mount('<manual-dom-counter count="5"></manual-dom-counter>')
    const span = el.shadowRoot!.querySelector('#value')
    expect(span!.textContent).to.equal('5')
    
    el.setAttribute('count', '10')
    await nextMicrotask()
    expect(span!.textContent).to.equal('10')
    
    el.setAttribute('count', '0')
    await nextMicrotask()
    expect(span!.textContent).to.equal('0')
  })
})

// ---------------------------------------------------------------------------
// 8. ElementInternals / formAssociated
// ---------------------------------------------------------------------------

describe('ElementInternals', () => {
  it('provides internals in context', async () => {
    let capturedInternals: ElementInternals | undefined
    define({
      tagName: 'internals-test',
      setup: function InternalsTest({ internals }) {
        capturedInternals = internals
        return () => html``
      }
    })
    await mount('<internals-test></internals-test>')
    expect(capturedInternals).to.be.instanceOf(ElementInternals)
  })

  it('formAssociated elements can set form value via internals', async () => {
    let capturedInternals: ElementInternals | undefined
    define({
      tagName: 'form-assoc',
      formAssociated: true,
      setup: function FormAssoc({ internals }) {
        capturedInternals = internals
        return () => html``
      }
    })
    await mount(`<form><form-assoc name="field"></form-assoc></form>`)
    expect(capturedInternals).to.exist
    expect(() => capturedInternals!.setFormValue('test')).to.not.throw()
  })
})

// ---------------------------------------------------------------------------
// 9. html / svg template helpers (re-exports)
// ---------------------------------------------------------------------------

describe('html and svg exports', () => {
  it('html tagged template produces a TemplateResult', () => {
    const result = html`<p>test</p>`
    expect(result).to.exist
    expect(result).to.have.property('strings')
  })

  it('renders html template to DOM correctly via shadowRoot', async () => {
    define({
      tagName: 'html-helper',
      setup: function HtmlHelper() { return () => html`<div class="box">content</div>` }
    })
    const el = await mount('<html-helper></html-helper>')
    expect(el.shadowRoot!.querySelector('.box')!.textContent).to.equal('content')
  })
})

// ---------------------------------------------------------------------------
// 10. state() helper
// ---------------------------------------------------------------------------

describe('state() helper', () => {
  it('creates a signal with the given initial value', () => {
    const s = state(42)
    expect(s.get()).to.equal(42)
  })

  it('signal value can be updated', () => {
    const s = state('hello')
    s.set('world')
    expect(s.get()).to.equal('world')
  })
})

// ---------------------------------------------------------------------------
// 11. lightElement / shadowElement convenience wrappers
// ---------------------------------------------------------------------------

describe('lightElement / shadowElement wrappers', () => {
  it('lightElement(fn) registers element with no shadow root', async () => {
    lightElement(function LightWrapNoShadow() { return () => html`` })
    const el = await mount('<light-wrap-no-shadow></light-wrap-no-shadow>')
    expect(el.shadowRoot).to.be.null
  })

  it('lightElement(attrs, fn) observes attributes and has no shadow root', async () => {
    let sig: any
    lightElement(['color'], function LightWrapWithAttrs({ color }: any) {
      sig = color
      return () => html``
    })
    const el = await mount('<light-wrap-with-attrs color="red"></light-wrap-with-attrs>')
    expect(el.shadowRoot).to.be.null
    expect(sig.get()).to.equal('red')
  })

  it('shadowElement(fn) registers element with a shadow root', async () => {
    shadowElement(function ShadowWrapNoAttrs() { return () => html`` })
    const el = await mount('<shadow-wrap-no-attrs></shadow-wrap-no-attrs>')
    expect(el.shadowRoot).to.exist
  })

  it('shadowElement(attrs, fn) observes attributes and has a shadow root', async () => {
    let sig: any
    shadowElement(['size'], function ShadowWrapWithAttrs({ size }: any) {
      sig = size
      return () => html``
    })
    const el = await mount('<shadow-wrap-with-attrs size="large"></shadow-wrap-with-attrs>')
    expect(el.shadowRoot).to.exist
    expect(sig.get()).to.equal('large')
  })
})

// ---------------------------------------------------------------------------
// 12. svg template helper
// ---------------------------------------------------------------------------

describe('svg template helper', () => {
  it('svg tagged template produces a TemplateResult', () => {
    const result = svg`<circle cx="50" cy="50" r="40" />`
    expect(result).to.exist
    expect(result).to.have.property('strings')
  })

  it('svg renders elements in the SVG namespace', async () => {
    define({
      tagName: 'svg-namespace',
      setup: function SvgNamespace() {
        return () => svg`<circle id="c" cx="50" cy="50" r="40" />`
      }
    })
    const el = await mount('<svg-namespace></svg-namespace>')
    const circle = el.shadowRoot!.querySelector('#c')!
    expect(circle).to.exist
    expect(circle.namespaceURI).to.equal('http://www.w3.org/2000/svg')
  })

  it('svg renders reactive values correctly', async () => {
    const radius = state(10)
    define({
      tagName: 'svg-reactive',
      setup: function SvgReactive() {
        return () => svg`<circle id="c" cx="50" cy="50" r="${radius.get()}" />`
      }
    })
    const el = await mount('<svg-reactive></svg-reactive>')
    expect(el.shadowRoot!.querySelector('#c')!.getAttribute('r')).to.equal('10')
    radius.set(40)
    await nextMicrotask()
    expect(el.shadowRoot!.querySelector('#c')!.getAttribute('r')).to.equal('40')
  })
})

// ---------------------------------------------------------------------------
// 13. styles option (constructed stylesheets)
// ---------------------------------------------------------------------------

describe('styles option', () => {
  it('adopts a constructed stylesheet on the shadow root', async () => {
    define({
      tagName: 'styles-basic',
      styles: `:host { display: block; color: rgb(255, 0, 0); }`,
      setup: function StylesBasic() { return () => html`<span id="s">hi</span>` }
    })
    const el = await mount('<styles-basic></styles-basic>')
    expect(el.shadowRoot!.adoptedStyleSheets.length).to.equal(1)
    expect(getComputedStyle(el).color).to.equal('rgb(255, 0, 0)')
  })

  it('shares one stylesheet across all instances of an element type', async () => {
    define({
      tagName: 'styles-shared',
      styles: `:host { display: block; }`,
      setup: function StylesShared() { return () => html`` }
    })
    document.body.innerHTML = '<styles-shared></styles-shared><styles-shared></styles-shared>'
    await nextMicrotask()
    const [a, b] = Array.from(document.body.querySelectorAll('styles-shared')) as HTMLElement[]
    const sheetA = a.shadowRoot!.adoptedStyleSheets[0]
    const sheetB = b.shadowRoot!.adoptedStyleSheets[0]
    expect(sheetA).to.equal(sheetB)
  })

  it('wraps styles in @scope for light DOM elements', async () => {
    define({
      tagName: 'styles-light',
      useShadow: false,
      styles: `:scope { color: rgb(0, 0, 255); }`,
      setup: function StylesLight() { return () => html`<span id="s">hi</span>` }
    })
    const el = await mount('<styles-light></styles-light>')
    expect(el.shadowRoot).to.be.null
    expect(getComputedStyle(el).color).to.equal('rgb(0, 0, 255)')
  })

  it('@scope stylesheet is registered on the document once per element type', async () => {
    const before = document.adoptedStyleSheets.length
    define({
      tagName: 'styles-light-shared',
      useShadow: false,
      styles: `:scope { display: block; }`,
      setup: function StylesLightShared() { return () => html`` }
    })
    const after = document.adoptedStyleSheets.length
    expect(after).to.equal(before + 1)
    document.body.innerHTML = '<styles-light-shared></styles-light-shared><styles-light-shared></styles-light-shared>'
    await nextMicrotask()
    // Still only one sheet added — it's shared across instances.
    expect(document.adoptedStyleSheets.length).to.equal(after)
  })

  it('lightElement(styles, fn) overload works', async () => {
    lightElement(`:scope { color: rgb(128, 0, 128); }`, function LightStylesOnly() {
      return () => html`<span>x</span>`
    })
    const el = await mount('<light-styles-only></light-styles-only>')
    expect(el.shadowRoot).to.be.null
    expect(getComputedStyle(el).color).to.equal('rgb(128, 0, 128)')
  })

  it('lightElement(attrs, styles, fn) overload works', async () => {
    let sig: any
    lightElement(['size'], `:scope { display: block; }`, function LightAttrsStyles({ size }: any) {
      sig = size
      return () => html``
    })
    const el = await mount('<light-attrs-styles size="lg"></light-attrs-styles>')
    expect(el.shadowRoot).to.be.null
    expect(sig.get()).to.equal('lg')
  })

  it('shadowElement(styles, fn) overload works', async () => {
    shadowElement(`:host { color: rgb(0, 128, 0); }`, function ShadowStylesOnly() {
      return () => html`<span>x</span>`
    })
    const el = await mount('<shadow-styles-only></shadow-styles-only>')
    expect(el.shadowRoot!.adoptedStyleSheets.length).to.equal(1)
    expect(getComputedStyle(el).color).to.equal('rgb(0, 128, 0)')
  })

  it('shadowElement(attrs, styles, fn) overload works', async () => {
    let sig: any
    shadowElement(['size'], `:host { display: block; }`, function ShadowAttrsStyles({ size }: any) {
      sig = size
      return () => html``
    })
    const el = await mount('<shadow-attrs-styles size="lg"></shadow-attrs-styles>')
    expect(el.shadowRoot!.adoptedStyleSheets.length).to.equal(1)
    expect(sig.get()).to.equal('lg')
  })
})

// ---------------------------------------------------------------------------
// 14. styleProps helper
// ---------------------------------------------------------------------------

describe('styleProps helper', () => {
  it('sets a CSS custom property via the -- prefix', async () => {
    let setProps: any
    define({
      tagName: 'style-props-basic',
      setup: function StylePropsBasic({ styleProps }) {
        setProps = styleProps
        return () => html``
      }
    })
    const el = await mount('<style-props-basic></style-props-basic>')
    setProps({ hue: '180' })
    expect(el.style.getPropertyValue('--hue')).to.equal('180')
  })

  it('converts camelCase keys to kebab-case custom properties', async () => {
    let setProps: any
    define({
      tagName: 'style-props-kebab',
      setup: function StylePropsKebab({ styleProps }) {
        setProps = styleProps
        return () => html``
      }
    })
    const el = await mount('<style-props-kebab></style-props-kebab>')
    setProps({ hueShift: '45', fontSize: '16px' })
    expect(el.style.getPropertyValue('--hue-shift')).to.equal('45')
    expect(el.style.getPropertyValue('--font-size')).to.equal('16px')
  })

  it('coerces number values to strings', async () => {
    let setProps: any
    define({
      tagName: 'style-props-number',
      setup: function StylePropsNumber({ styleProps }) {
        setProps = styleProps
        return () => html``
      }
    })
    const el = await mount('<style-props-number></style-props-number>')
    setProps({ hue: 270 })
    expect(el.style.getPropertyValue('--hue')).to.equal('270')
  })

  it('removes a property when the value is null', async () => {
    let setProps: any
    define({
      tagName: 'style-props-null',
      setup: function StylePropsNull({ styleProps }) {
        setProps = styleProps
        return () => html``
      }
    })
    const el = await mount('<style-props-null></style-props-null>')
    setProps({ hue: '180' })
    expect(el.style.getPropertyValue('--hue')).to.equal('180')
    setProps({ hue: null })
    expect(el.style.getPropertyValue('--hue')).to.equal('')
  })

  it('merges with existing properties without clearing them', async () => {
    let setProps: any
    define({
      tagName: 'style-props-merge',
      setup: function StylePropsMerge({ styleProps }) {
        setProps = styleProps
        return () => html``
      }
    })
    const el = await mount('<style-props-merge></style-props-merge>')
    setProps({ hue: '180', saturation: '50' })
    setProps({ hue: '200' })
    expect(el.style.getPropertyValue('--hue')).to.equal('200')
    expect(el.style.getPropertyValue('--saturation')).to.equal('50')
  })

  it('rejects styleProps as an attribute name', () => {
    expect(() =>
      define({
        tagName: 'reserved-styleprops',
        attributes: ['styleProps' as any],
        setup: function ReservedStyleProps() { return () => html`` }
      })
    ).to.throw(/reserved/)
  })
})

// ---------------------------------------------------------------------------
// 15. Setup function return value handling
// ---------------------------------------------------------------------------

describe('setup return value', () => {
  it('returning a function sets up reactive rendering', async () => {
    const count = state(0)
    define({
      tagName: 'return-fn',
      setup: function ReturnFn() { return () => html`<span>${count.get()}</span>` }
    })
    const el = await mount('<return-fn></return-fn>')
    expect(el.shadowRoot!.querySelector('span')!.textContent).to.equal('0')
    count.set(99)
    await nextMicrotask()
    expect(el.shadowRoot!.querySelector('span')!.textContent).to.equal('99')
  })

  it('returning a template renders it once with no reactivity', async () => {
    const count = state(0)
    let renderCalls = 0
    define({
      tagName: 'return-template',
      setup: function ReturnTemplate() {
        renderCalls++
        return html`<span id="s">${count.get()}</span>`
      }
    })
    const el = await mount('<return-template></return-template>')
    expect(el.shadowRoot!.querySelector('#s')!.textContent).to.equal('0')
    count.set(42)
    await nextMicrotask()
    // DOM should not have updated — no reactivity
    expect(el.shadowRoot!.querySelector('#s')!.textContent).to.equal('0')
    // Setup ran exactly once
    expect(renderCalls).to.equal(1)
  })

  it('returning a string renders it as HTML via innerHTML', async () => {
    define({
      tagName: 'return-string',
      setup: function ReturnString() {
        return '<p id="p">static</p>'
      }
    })
    const el = await mount('<return-string></return-string>')
    expect(el.shadowRoot!.querySelector('#p')!.textContent).to.equal('static')
  })

  it('returning a string renders HTML markup, not escaped text', async () => {
    define({
      tagName: 'return-string-markup',
      setup: function ReturnStringMarkup() {
        return '<em id="em">markup</em>'
      }
    })
    const el = await mount('<return-string-markup></return-string-markup>')
    const em = el.shadowRoot!.querySelector('#em')
    expect(em).to.exist
    expect(em!.tagName.toLowerCase()).to.equal('em')
  })

  it('render function returning a string re-renders via innerHTML on signal change', async () => {
    const name = state('world')
    define({
      tagName: 'return-fn-string',
      setup: function ReturnFnString() {
        return () => `<p id="p">Hello, ${name.get()}!</p>`
      }
    })
    const el = await mount('<return-fn-string></return-fn-string>')
    expect(el.shadowRoot!.querySelector('#p')!.textContent).to.equal('Hello, world!')
    name.set('Alice')
    await nextMicrotask()
    expect(el.shadowRoot!.querySelector('#p')!.textContent).to.equal('Hello, Alice!')
  })

  it('render function returning a string sets innerHTML not a text node', async () => {
    define({
      tagName: 'return-fn-string-markup',
      setup: function ReturnFnStringMarkup() {
        return () => '<strong id="s">bold</strong>'
      }
    })
    const el = await mount('<return-fn-string-markup></return-fn-string-markup>')
    const strong = el.shadowRoot!.querySelector('#s')
    expect(strong).to.exist
    expect(strong!.tagName.toLowerCase()).to.equal('strong')
  })

  it('returning undefined renders nothing and does not throw', async () => {
    define({
      tagName: 'return-undefined',
      setup: function ReturnUndefined() { return undefined }
    })
    const el = await mount('<return-undefined></return-undefined>')
    expect(el.shadowRoot!.innerHTML).to.equal('')
  })

  it('returning undefined still runs effects', async () => {
    let ran = false
    define({
      tagName: 'return-undefined-effect',
      setup: function ReturnUndefinedEffect({ effect }) {
        effect(() => { ran = true })
        return undefined
      }
    })
    await mount('<return-undefined-effect></return-undefined-effect>')
    expect(ran).to.be.true
  })

  it('returning a number logs a console.error', async () => {
    define({
      tagName: 'return-number',
      setup: function ReturnNumber() { return 42 as any }
    })
    const errors: string[] = []
    const orig = console.error
    console.error = (...args: unknown[]) => errors.push(args.join(' '))
    try {
      await mount('<return-number></return-number>')
    } finally {
      console.error = orig
    }
    expect(errors.length).to.be.greaterThan(0)
    expect(errors[0]).to.match(/unexpected value/)
  })

  it('returning an object logs a console.error', async () => {
    define({
      tagName: 'return-object',
      setup: function ReturnObject() { return {} as any }
    })
    const errors: string[] = []
    const orig = console.error
    console.error = (...args: unknown[]) => errors.push(args.join(' '))
    try {
      await mount('<return-object></return-object>')
    } finally {
      console.error = orig
    }
    expect(errors.length).to.be.greaterThan(0)
    expect(errors[0]).to.match(/unexpected value/)
  })
})
