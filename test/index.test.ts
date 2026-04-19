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
    define({ component: function TagDerive() { return () => html`` }, tagName: 'tag-derive' })
    expect(customElements.get('tag-derive')).to.exist
  })

  it('auto-derives kebab-case tag name from camelCase function name', () => {
    define({ component: function AutoKebab() { return () => html`` } })
    expect(customElements.get('auto-kebab')).to.exist
  })

  it('throws when function name produces no hyphen', () => {
    expect(() =>
      define({ component: function nohyphen() { return () => html`` }, tagName: 'nohyphen' })
    ).to.throw(/valid custom element name/)
  })

  it('throws when the tag name is already registered', () => {
    define({ component: function AlreadyDefined() { return () => html`` }, tagName: 'already-defined' })
    expect(() =>
      define({ component: function AlreadyDefined2() { return () => html`` }, tagName: 'already-defined' })
    ).to.throw(/already defined/)
  })
})

// ---------------------------------------------------------------------------
// 2. Shadow DOM rendering (useShadow: true / default)
// ---------------------------------------------------------------------------

describe('shadow DOM rendering', () => {
  it('attaches an open shadow root', async () => {
    define({ tagName: 'shadow-root-test', component: function ShadowRootTest() { return () => html`<p>shadow</p>` } })
    const el = await mount('<shadow-root-test></shadow-root-test>')
    expect(el.shadowRoot).to.exist
  })

  it('renders template content into shadow root', async () => {
    define({ tagName: 'shadow-render', component: function ShadowRender() { return () => html`<span id="inner">hello</span>` } })
    const el = await mount('<shadow-render></shadow-render>')
    expect(el.shadowRoot!.querySelector('#inner')!.textContent).to.equal('hello')
  })
})

// ---------------------------------------------------------------------------
// 3. Light DOM rendering (useShadow: false)
// ---------------------------------------------------------------------------

describe('light DOM rendering', () => {
  it('does NOT attach a shadow root', async () => {
    define({ tagName: 'light-dom-verify', useShadow: false, component: function LightDomVerify() { return () => html`` } })
    const el = await mount('<light-dom-verify></light-dom-verify>')
    expect(el.shadowRoot).to.be.null
  })

  it('renders template content into the element itself', async () => {
    define({ tagName: 'light-content', useShadow: false, component: function LightContent() { return () => html`<em id="em">light</em>` } })
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
      component: function AttrInit({ color }) { capturedSignal = color; return () => html`` }
    })
    await mount('<attr-init color="red"></attr-init>')
    expect(capturedSignal.get()).to.equal('red')
  })

  it('signal is null when attribute is absent', async () => {
    let capturedSignal: any
    define({
      tagName: 'attr-absent',
      attributes: ['color'],
      component: function AttrAbsent({ color }) { capturedSignal = color; return () => html`` }
    })
    await mount('<attr-absent></attr-absent>')
    expect(capturedSignal.get()).to.be.null
  })

  it('attributeChangedCallback updates the signal', async () => {
    let capturedSignal: any
    define({
      tagName: 'attr-change',
      attributes: ['value'],
      component: function AttrChange({ value }) { capturedSignal = value; return () => html`` }
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
      component: function AttrRemove({ value }) { capturedSignal = value; return () => html`` }
    })
    const el = await mount('<attr-remove value="x"></attr-remove>')
    el.removeAttribute('value')
    expect(capturedSignal.get()).to.be.null
  })

  it('throws when an attribute name conflicts with reserved key "internals"', () => {
    expect(() =>
      define({ tagName: 'reserved-internals', attributes: ['internals' as any], component: function ReservedInternals() { return () => html`` } })
    ).to.throw(/reserved/)
  })

  it('throws when an attribute name conflicts with reserved key "effect"', () => {
    expect(() =>
      define({ tagName: 'reserved-effect', attributes: ['effect' as any], component: function ReservedEffect() { return () => html`` } })
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
      component: function ReflectSet({ color }) { capturedSignal = color; return () => html`` }
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
      component: function ReflectNull({ color }) { capturedSignal = color; return () => html`` }
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
      component: function PropSetter() { return () => html`` }
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
      component: function PropTypeError() { return () => html`` }
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
      component: function ReactiveRender() { return () => html`<span>${count.get()}</span>` }
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
      component: function CoalesceRender() {
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
      component: function AttrRerender({ label }) { return () => html`<span>${label.get()}</span>` }
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
      component: function EffectConnected({ effect }) {
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
      component: function EffectCleanup({ effect }) {
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
      component: function EffectNoCleanup({ effect }) {
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
      component: function EffectReconnect({ effect }) {
        effect(() => { runCount++ })
        return () => html``
      }
    })
    const el = await mount('<effect-reconnect></effect-reconnect>')
    expect(runCount).to.equal(1)
    const parent = el.parentElement!
    el.remove()
    parent.appendChild(el)
    expect(runCount).to.equal(2)
  })

  it('multiple effects all run and clean up', async () => {
    const log: string[] = []
    define({
      tagName: 'multi-effect',
      component: function MultiEffect({ effect }) {
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
})

// ---------------------------------------------------------------------------
// 8. ElementInternals / formAssociated
// ---------------------------------------------------------------------------

describe('ElementInternals', () => {
  it('provides internals in context', async () => {
    let capturedInternals: ElementInternals | undefined
    define({
      tagName: 'internals-test',
      component: function InternalsTest({ internals }) {
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
      component: function FormAssoc({ internals }) {
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
      component: function HtmlHelper() { return () => html`<div class="box">content</div>` }
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
      component: function SvgNamespace() {
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
      component: function SvgReactive() {
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
