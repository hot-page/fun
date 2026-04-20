
# Hot Element

## Introduction

Web Components are the best way to share small pieces of functionality for web
pages, especially when used in sites with static HTML. You get all the benefits
of a component based architecture like React without having to swallow the
whole workflow. Use declarative, static HTML but also get the
goodness of bits of interactivity.

Making simple web components is kinda sucky though -- there's a lot of
boilerplate, you have to know about JavaScript classes and keep a lot of stuff
in your head about lifecycle and callbacks to make it work right.

This project is an attempt to simplify the process of building one-off custom
elements. With a simple helper function you can write components with
reactivity using a functional structure.

The best part is this builds on new web standards that make all this super
easy. The only two dependencies are things that (hopefuly) will be standardized
in the web platform sooner rather than later.

## Goals

- **Static pages with sprinkles of interactivity** - Perfect for adding dynamic
  elements to mostly-static HTML sites
- **Minimal boilerplate** - Write components quickly without class ceremony
- **Standards-based** - Built on Web Components, works everywhere

## Non-Goals

- **Building full applications** - Use React, Vue, or Svelte for SPAs
- **Complex state management** - This isn't Redux or Zustand
- **Build tooling** - No bundlers, no compilation (though you can use them if
  you want)
- **Large state trees** - Keep it simple with local component state


## What You Get

- Easy reactivity with Signals
- Much less boilerplate than vanilla Web Components
- Automatic cleanup with effects
- Observed attributes support
- Full TypeScript support

What you give up:
- Class ceremonny
- Something about performance


## Prior Art

This was directly inspired by Ginger's [post on Piccalilli](https://piccalil.li/blog/functional-custom-elements-the-easy-way/).

Obviously, React for the simplicity of functional components.



## Quick Start

1. Load `@hot-page/hot-element` from a CDN or install it with NPM.
2. Import one of the define functions: `shadowElement` or `lightElement` as
   well as the `html` templator. Shadow element renders in shadow DOM, and
   light element renders in normal DOM.
3. Define your functional component by providing a function.
4. Use the `state` argument to create new reactive properties
5. Return a template that will be re-rendered

Create a new element in plain JavaScript:

```javascript
import { shadowElement, html, state } from 'https://esm.sh/@hot-page/hot-element'

// Call the define function with our component
shadowElement(function HueSlider() {
  const value = state(0)
  const callCount = state(0)

  function onInput(event) {
    // N.B. this will only call render one time even though we set two signals
    value.set(event.target.value)
    callCount.set(callCount.get() + 1)
  }

  // Return a render function
  return () => {
    // Update a property on the element
    this.hue = value.get()
    // Return an HTML template with reactive properties in it.
    return html`
      <style>
        :host {
          display: block;
          padding: 16px;
          background: hsl(${value.get()}, 100%, 90%);
        }
      </style>
      <input type=range min=0 max=255 .value=${value.get()} @input=${onInput}>
      <p>Hue: ${value.get()}</p>
      <p>Update count: ${callCount.get()}</p>
    `
  }
})
```

Use the element in your HTML:

```html
<hue-slider></hue-slider>
```

That's it!

Let's talk about what's happening here.

1. You are calling a function `shadowElement`. We can call that the "define
   function".
2. You are passing a single argument, which is also a function. Let's call that
   the "setup function".
3. That in turn returns a function, which we can call the "render function".

I told you this was functional!

It's important to understand when these functions will run.

1. The define function runs once for every custom element you want to create.
2. The setup function will run every time one of your elements on the
   page is created.
3. The render function runs when the reactive properties change and the
   element's markup will be updated

The setup function receives a context object with:
- `effect` - Register side effects with cleanup (see Lifecycle & Cleanup below)
- `internals` - Access to ElementInternals API (see Using Element Internals below)
- `styleProps` - Set CSS custom properties on the host element (see Styling below)


## Rendering in Shadow or Light DOM

This package provides two define exports:
- `lightElement` which will render the template into the element's children.
- `shadowElement` which will render the template into a Shadow DOM.

You can also use the `define()` function directly if you prefer:

```javascript
import { define, html, state } from '@hot-page/hot-element'

define({
  attributes: ['color', 'size'],
  useShadow: true, // or false for light DOM
  setup: function MyElement({ effect }) {
    const count = state(0)
    return () => html`<p>${count.get()}</p>`
  },
})
```

You can also provide a `tagName` to override the name derived from the function:

```javascript
define({
  tagName: 'my-element',
  attributes: ['color', 'size'],
  setup({ effect }) {
    const count = state(0)
    return () => html`<p>${count.get()}</p>`
  },
})
```

I can think of two cases where you'll want this:

- **Minification** — these components are so small they barely need minifying, but if you do, bundlers will mangle function names and break the auto-derived tag name. `tagName` is your escape hatch.
- **Adjacent acronyms** — `HTMLParser` becomes `html-parser` and `CSSAnimation` becomes `css-animation`, but `XMLHTTPRequest` becomes `xmlhttp-request` rather than `xml-http-request`. Where two acronyms are jammed together there's no way to know where one ends and the other begins. Use `tagName`.


## Styling

Shadow DOM elements get native style encapsulation, so anything you put in a `<style>` tag inside your template is scoped to the component. For most cases that's all you need.

### Shared stylesheets with `styles`

When you have more than a line or two of CSS, or when you render many instances of the same element, pass a `styles` string. Both `shadowElement` and `lightElement` support it. This creates a single [constructed stylesheet](https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleSheet/CSSStyleSheet) that is shared across every instance of the element — the browser parses the CSS once.

For shadow DOM, the sheet is adopted into each shadow root:

```javascript
shadowElement(
  `:host {
    display: block;
    padding: 16px;
    background: hsl(var(--hue, 0), 100%, 90%);
  }

  p {
    margin: 0;
  }`,
  function HueSwatch() {
    return () => html`<p>Hello</p>`
  },
)
```

For light DOM, the sheet is wrapped in [`@scope`](https://developer.mozilla.org/en-US/docs/Web/CSS/@scope) and adopted into the document. Use `:scope` to refer to the host element:

```javascript
lightElement(
  `:scope {
    display: block;
    padding: 16px;
  }

  p {
    margin: 0;
  }`,
  function MyCard() {
    return () => html`<p>Hello</p>`
  },
)
```

The `styles` argument goes between attributes (if any) and the setup function. Both define functions accept the same overloads:

```javascript
shadowElement(fn)                    // no attrs, no styles
shadowElement(styles, fn)            // styles only
shadowElement(attrs, fn)             // attrs only
shadowElement(attrs, styles, fn)     // both

lightElement(fn)
lightElement(styles, fn)
lightElement(attrs, fn)
lightElement(attrs, styles, fn)
```

Or via `define()`:

```javascript
define({
  attributes: ['color'],
  useShadow: true,
  styles: `:host { display: block; }`,
  setup: function MyElement({ color }) {
    return () => html`<p>${color.get()}</p>`
  }
})
```

You can still use `<style>` tags inside templates, and they coexist fine with `styles` — but the constructed stylesheet approach is more efficient for styles that don't change per-render.

#### Shadow vs. light: what's different

- **Shadow DOM (`shadowElement`)** gives you full style encapsulation. External CSS can't reach into the shadow root, and your styles can't leak out. Use `:host` to style the element itself.
- **Light DOM (`lightElement`)** uses `@scope` to limit where your selectors match, but this is not encapsulation. External CSS can still target elements inside your component, and specificity rules still apply as normal. Use `:scope` to style the element itself.

If you copy shadow styles into a light element, remember to swap `:host` for `:scope`.

### Per-instance styling with `styleProps`

CSS custom properties are the platform's answer to per-instance styling: set them on the host, they cascade into the component. The `styleProps` helper is a shortcut for setting multiple custom properties at once without typing `this.style.setProperty` over and over:

```javascript
shadowElement(
  `:host {
    display: block;
    background: hsl(var(--hue), var(--saturation), 50%);
  }`,
  function HueSlider({ styleProps }) {
    function onInput(event) {
      styleProps({
        hue: event.target.value,
        saturation: '80%'
      })
    }

    return () => html`
      <input type="range" min="0" max="360" @input=${onInput}>
    `
  },
)
```

Keys are converted from camelCase to kebab-case and prefixed with `--`. So `hueShift` becomes `--hue-shift`. Numbers are coerced to strings. Passing `null` removes the property:

```javascript
styleProps({ hue: 180 })        // --hue: 180
styleProps({ hueShift: '45' })  // --hue-shift: 45
styleProps({ hue: null })       // removes --hue
```

`styleProps` merges with whatever is already on `this.style` — it only touches the keys you pass.

Use `styleProps` when you want to update visual state from an event handler without triggering a template re-render. Writing to a signal would re-run the render function even if only the CSS changed; `styleProps` skips that entirely.


## Lifecycle & Cleanup

Use the `effect` function to register side effects that need cleanup:

```javascript
shadowElement(function oneSecondCounter({ effect }) {
  const count = state(0)

  effect(() => {
    // Setup: runs when element is connected to DOM
    const interval = setInterval(() => {
      count.set(count.get() + 1)
    }, 1000)

    // Cleanup: runs when element is disconnected
    return () => clearInterval(interval)
  })

  effect(() => {
    // You can register multiple effects
    const handleResize = () => console.log('resized')
    window.addEventListener('resize', handleResize)

    return () => window.removeEventListener('resize', handleResize)
  })

  return () => html`<p>Count: ${count.get()}</p>`
})
```

**When effects run:**
- Setup functions run when the element connects to the DOM
- Cleanup functions run when the element disconnects from the DOM
- If an element is moved in the DOM, cleanup runs, then setup runs again

**When you need effects:**
- Global event listeners (window, document)
- Timers (setInterval, setTimeout)
- Observers (IntersectionObserver, MutationObserver)
- External subscriptions (WebSocket, EventSource)

**When you DON'T need effects:**
- Event listeners in your template (lit-html handles cleanup automatically)
- Signal watchers (they're tied to the element lifecycle)


## Observed Attributes

Declare observed attributes as the first argument and they'll automatically be available as signals with **two-way binding**:

```javascript
shadowElement(
  ['color', 'size'],
  function ColorPicker({ color, size, effect }) {
    // color and size are signals that sync with attributes
    // They default to null if attribute doesn't exist
    
    return () => html`
      <div style="background: ${color.get() || 'blue'}; font-size: ${size.get() || '16px'}">
        Current color: ${color.get()}
        <button @click=${() => color.set('purple')}>
          Change to purple
        </button>
      </div>
    `
  }
)
```

```html
<color-picker color="red" size="20px"></color-picker>

<script>
  const picker = document.querySelector('color-picker')
  
  // Attribute → Signal → Re-render
  picker.setAttribute('color', 'green')
  
  // Signal → Attribute (reflected automatically)
  // When you click the button, the attribute updates too!
  console.log(picker.getAttribute('color')) // 'purple' (after click)
</script>
```

### Two-Way Binding

The observed attributes create **both signals and properties**:

```javascript
shadowElement(
  ['value'],
  function CustomInput({ value }) {
    return () => html`
      <input 
        type="text" 
        .value=${value.get() || ''} 
        @input=${(e) => value.set(e.target.value)}
      >
    `
  }
)
```

```javascript
const input = document.querySelector('custom-input')

// All of these are synchronized:
input.setAttribute('value', 'hello')  // Updates signal & property
input.value = 'world'                 // Updates signal & attribute
value.set('foo')                      // Updates property & attribute (in component)
```

**How infinite loops are prevented:**
- Signals have built-in equality checking (`equals` function)
- Only updates if the value actually changed

### Type Conversion

All attribute values are strings (or null). Convert manually for other types:

```javascript
shadowElement(
  ['count', 'disabled'],
  function Counter({ count, disabled }) {
    return () => {
      const numCount = parseInt(count.get() || '0')
      const isDisabled = disabled.get() !== null
      
      return html`
        <button 
          ?disabled=${isDisabled}
          @click=${() => count.set(String(numCount + 1))}
        >
          Count: ${numCount}
        </button>
      `
    }
  }
)
```


## Element Properties

Observed attributes are always strings. For richer data, use a plain signal with `Object.defineProperty` to expose a property on the element.

### JS-only property (no attribute reflection)

Use this when you want to pass objects or other non-string values to an element, and don't need `setAttribute` to work:

```javascript
shadowElement(function ColorPicker() {
  const color = state({ red: 0, green: 0, blue: 0 })

  Object.defineProperty(this, 'color', {
    get() { return color.get() },
    set(value) { color.set(value) },
  })

  return () => html`
    <p>Red: ${color.get().red}</p>
  `
})
```

```javascript
const picker = document.querySelector('color-picker')
picker.color = { red: 255, green: 0, blue: 0 } // triggers re-render
```

`setAttribute('color', ...)` will have no effect since `'color'` is not in `attributes`.


### Observed attribute with custom property setter

Use this when you want both `setAttribute` to work and the property to accept richer values. Declare the attribute normally to get signal and `attributeChangedCallback` wiring, then override the property:

```javascript
shadowElement(['color'], function ColorPicker({ color }) {

  Object.defineProperty(this, 'color', {
    get() { return color.get() },
    set(value) {
      // Accept objects by serializing to a string for the attribute
      color.set(typeof value === 'string' ? value : JSON.stringify(value))
    },
  })

  return () => {
    const val = color.get()
    const parsed = val ? JSON.parse(val) : { red: 0 }
    return html`<p>Red: ${parsed.red}</p>`
  }
})
```

```javascript
const picker = document.querySelector('color-picker')
picker.color = { red: 255 }          // sets attribute to '{"red":255}'
picker.setAttribute('color', '{"red":128}')  // also works
```

The tradeoff: the attribute value is JSON, which is readable but not pretty in the DOM. If you don't need `setAttribute` support, the JS-only pattern above is cleaner.


## Using Element Internals

Access the ElementInternals API for custom element states and ARIA:

```javascript
shadowElement(
  ['loading'],
  function ProgressButton({ loading, internals }) {
    return () => {
      if (loading.get() !== null) {
        internals.states.add('loading')
        internals.ariaDisabled = 'true'
        internals.ariaBusy = 'true'
      } else {
        internals.states.delete('loading')
        internals.ariaDisabled = 'false'
        internals.ariaBusy = 'false'
      }

      return html`
        <style>
          button {
            padding: 8px 16px;
            cursor: pointer;
          }
          :host(:state(loading)) button {
            opacity: 0.6;
            cursor: wait;
          }
          .spinner {
            display: none;
          }
          :host(:state(loading)) .spinner {
            display: inline-block;
          }
        </style>
        <button>
          <span class="spinner">⏳</span>
          <slot></slot>
        </button>
      `
    }
  }
)
```

```html
<progress-button id="save">Save Changes</progress-button>

<script type="module">
  const btn = document.querySelector('#save')
  btn.addEventListener('click', async () => {
    btn.setAttribute('loading', '')
    await fetch('/api/save', { method: 'POST' })
    btn.removeAttribute('loading')
  })
</script>
```

The `internals` object gives you access to:
- Custom states (`:state()` CSS selector)
- ARIA properties (`ariaLabel`, `ariaDisabled`, `ariaBusy`, etc.)
- Form participation (`setFormValue`, `setValidity`)

### Form participation

To use the form participation APIs (`setFormValue`, `setValidity`, etc.), you must opt in with `formAssociated: true`. Without it the browser will throw when you call those methods.

```javascript
define({
  attributes: ['value'],
  formAssociated: true,
  setup({ value, internals }) {
    return () => {
      internals.setFormValue(value.get())

      return html`
        <input
          type="text"
          .value=${value.get() || ''}
          @input=${(e) => value.set(e.target.value)}
        >
      `
    }
  }
})
```

Custom states and ARIA properties work without `formAssociated` — you only need it if you're integrating with `<form>` elements.


## Shared State

### Using window (Recommended for Static Sites)

For static HTML pages with script tags, the simplest approach is to put your state on `window`:

```html
<!DOCTYPE html>
<html>
<head>
  <script type="module">
    import { shadowElement, html, state } from 'https://esm.sh/@hot-page/hot-element'

    // Create global store on window
    window.store = {
      cart: state([]),
      user: state(null),
      
      addToCart(item) {
        const current = this.cart.get()
        this.cart.set([...current, item])
      },
      
      login(userData) {
        this.user.set(userData)
      }
    }

    // All components can access window.store
    shadowElement(function cartButton() {
      return () => {
        const items = window.store.cart.get()
        return html`
          <button>
            Cart (${items.length})
          </button>
        `
      }
    })

    shadowElement(function productCard() {
      return () => html`
        <div class="product">
          <h3>Cool Product</h3>
          <button @click=${() => window.store.addToCart({ id: 1, name: 'Cool Product' })}>
            Add to Cart
          </button>
        </div>
      `
    })
  </script>
</head>
<body>
  <cart-button></cart-button>
  <product-card></product-card>
  <product-card></product-card>
</body>
</html>
```

When you click "Add to Cart", all `<cart-button>` elements automatically update. No build step, no module bundler, just plain HTML.

### Using Module-Level State

If you're using JavaScript modules, you can share state at the module level:

```javascript
// shared-counter.js
import { shadowElement, html, state } from '@hot-page/hot-element'

// This state is shared across all instances
const sharedCount = state(0)

shadowElement(function SharedCounter() {
  return () => html`
    <button @click=${() => sharedCount.set(sharedCount.get() + 1)}>
      Global count: ${sharedCount.get()}
    </button>
  `
})
```

Now every `<shared-counter>` element on the page shows and updates the same count.

### Using a Dedicated Store Module

For more complex scenarios with multiple files, create a dedicated store module:

```javascript
// store.js
import { state } from '@hot-page/hot-element'

export const store = {
  user: state(null),
  theme: state('light'),
  notifications: state([]),
  
  login(userData) {
    this.user.set(userData)
  },
  
  toggleTheme() {
    this.theme.set(this.theme.get() === 'light' ? 'dark' : 'light')
  },
  
  addNotification(message) {
    const current = this.notifications.get()
    this.notifications.set([...current, { id: Date.now(), message }])
  }
}
```

```javascript
// user-badge.js
import { shadowElement, html } from '@hot-page/hot-element'
import { store } from './store.js'

shadowElement(function UserBadge() {
  return () => {
    const user = store.user.get()
    return html`
      <div>
        ${user ? html`Hello, ${user.name}!` : html`Not logged in`}
      </div>
    `
  }
})
```

All components reading from `store` will automatically re-render when the shared state changes.


## Gotchas

### Call `signal.get()` inside the render function

Signals only track reads that happen during rendering. If you read a signal in the setup function body, you capture a snapshot — not a live reference:

```javascript
shadowElement(function MyEl() {
  const count = state(0)
  const value = count.get() // ❌ captured once, never updates

  return () => html`<p>${value}</p>`
})
```

```javascript
shadowElement(function MyEl() {
  const count = state(0)

  return () => html`<p>${count.get()}</p>` // ✅ read during render, reactive
})
```

### Don't destructure signal values in the setup function body

Same issue. Destructuring reads the value once at setup time:

```javascript
shadowElement(function MyEl() {
  const color = state({ red: 0, green: 0, blue: 0 })
  const { red } = color.get() // ❌ captured once

  return () => html`<p>${red}</p>`
})
```

```javascript
shadowElement(function MyEl() {
  const color = state({ red: 0, green: 0, blue: 0 })

  return () => html`<p>${color.get().red}</p>` // ✅
})
```

### Arrow functions have caveats

The library does two things with your setup function: it calls it with `this` bound to the element, and it reads `.name` to derive the tag name. Arrow functions don't play nicely with either:

- Arrow functions ignore `.call(this, ...)` — they use lexical `this`. If you need to read or write properties on the host element from inside setup, use a named `function`.
- Arrow functions passed inline are anonymous (`.name === ''`), so tag name derivation fails. Assign them to a capitalized variable or provide an explicit `tagName`.

```javascript
// ❌ anonymous — no name to derive tag from
shadowElement(() => { ... })

// ❌ anonymous, same problem
shadowElement(function() { ... })

// ✅ named function — preferred, and lets you use `this`
shadowElement(function MyEl() { ... })

// ✅ arrow works if you provide tagName and don't need `this`
define({
  tagName: 'my-el',
  setup: () => () => html`<p>hi</p>`,
})
```

### Effects run on connect, not on construction

Effects are registered during the setup function call but don't run until the element is connected to the DOM. If you construct an element programmatically without appending it, effects haven't fired yet:

```javascript
const el = document.createElement('my-counter')
// effect hasn't run yet

document.body.appendChild(el)
// now it runs
```

### Setting multiple signals triggers one render

Updating several signals in a row is coalesced into a single render on the next microtask. This is a feature, but it means you can't observe intermediate state between sets:

```javascript
count.set(1)
label.set('updated')
// one render, not two
```

### Absent attributes are `null`, not `undefined`

`getAttribute` follows the DOM spec and returns `null` for missing attributes, never `undefined`. Check accordingly:

```javascript
if (count.get() === null) { ... }  // ✅ attribute is absent
if (count.get() === undefined) { ... }  // ❌ never true
```


### `styles` and cross-document adoption

Constructed stylesheets are bound to the `Document` that created them. If a custom element is moved to a different document (for example via `document.adoptNode()` into an iframe or a popup window), the stylesheet from the original document is no longer usable in the new one, and the element's styles will stop applying.

This is rare — most apps never move elements across documents — and this library doesn't handle it. If you need to support that scenario, avoid the `styles` option and put a `<style>` tag inside your template instead.


## Rendering SVG

This package also exports a `svg` tagged template literal (re-exported from lit-html). Use it instead of `html` **only when the root of your template is an SVG element** — for example when writing a custom SVG shape or icon component:

```javascript
import { shadowElement, svg, state } from '@hot-page/hot-element'

shadowElement(function AnimatedCircle() {
  const r = state(10)
  return () => svg`<circle cx="50" cy="50" r="${r.get()}" fill="red" />`
})
```

```html
<svg>
  <animated-circle></animated-circle>
</svg>
```

If your template starts with an HTML element — even one that contains `<svg>` inside — use `html` as normal:

```javascript
return () => html`<div><svg>...</svg></div>` // ✅ use html, not svg
return () => svg`<circle ... />`             // ✅ use svg only at SVG root
```

The distinction matters because lit-html uses the tag to parse the template in the correct namespace context. Using `html` for SVG roots will result in elements created in the HTML namespace, which browsers won't render correctly.


## A Hot Page Project

This open-source project is built by the engineeers at [Hot Page](https://hot.page),
a tool for web design and development.

&nbsp;

<p align="center">
  <a href="https://hot.page" target="_blank">
    <img width="250" src="https://static.hot.page/logo.png">
  </a>
</p>

&nbsp;
