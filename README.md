
# Functional Element

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

- **Static pages with sprinkles of interactivity** - Perfect for adding dynamic elements to mostly-static HTML sites
- **Minimal boilerplate** - Write components quickly without class ceremony
- **Standards-based** - Built on Web Components, works everywhere

## Non-Goals

- **Building full applications** - Use React, Vue, or Svelte for SPAs
- **Complex state management** - This isn't Redux or Zustand
- **Build tooling** - No bundlers, no compilation (though you can use them if you want)
- **Large state trees** - Keep it simple with local component state

## Quick Start

1. Load `@hot-page/functional-element` from a CDN or install it with NPM.
2. Import one of the define functions: `shadowElement` or `lightElement`.
   Shadow element renders in shadow DOM, and light element renders in normal
   DOM.
3. Define your functional component by providing a function.
4. Use the `state` argument to create new reactive properties
5. Return a template that will be re-rendered

Create a new element in plain JavaScript:

```javascript
import { shadowElement, html, state } from 'https://esm.sh/@hot-page/functional-element'

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
   the "functional component".
3. That in turn returns a function, which we can call the "render function".

I told you this was functional!

It's important to understand when these functions will run.

1. The define function runs once for every custom element you want to create.
2. The functional component will run every time one of your elements on the
   page is created.
3. The render function runs when the reactive properties change and the
   component's markup will be updated

The component receives a context object with:
- `effect` - Register side effects with cleanup (see Lifecycle & Cleanup below)
- `internals` - Access to ElementInternals API (see Using Element Internals below)


## Rendering in Shadow or Light DOM

This package provides two define exports:
- `lightElement` which will render the template into the element's children.
- `shadowElement` which will render the template into a Shadow DOM.

You can also use the `define()` function directly if you prefer:

```javascript
import { define, html, state } from '@hot-page/functional-element'

define({
  attributes: ['color', 'size'],
  useShadow: true  // or false for light DOM
  component: function MyElement({ effect }) {
    const count = state(0)
    return () => html`<p>${count.get()}</p>`
  },
})
```


## Lifecycle & Cleanup

Use the `effect` function to register side effects that need cleanup:

```javascript
shadowElement(function Timer({ effect }) {
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


## Shared State

### Using window (Recommended for Static Sites)

For static HTML pages with script tags, the simplest approach is to put your state on `window`:

```html
<!DOCTYPE html>
<html>
<head>
  <script type="module">
    import { shadowElement, html, state } from 'https://esm.sh/@hot-page/functional-element'

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
import { shadowElement, html, state } from '@hot-page/functional-element'

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
import { state } from '@hot-page/functional-element'

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
import { shadowElement, html } from '@hot-page/functional-element'
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


## Tradeoffs

What you get:
- Easy reactivity with Signals
- Much less boilerplate than vanilla Web Components
- Automatic cleanup with effects
- Observed attributes support
- Full TypeScript support

What you give up:
- Private methods (for public methods, assign them to `this`)


## Prior Art

This was directly inspired by Ginger's [post on Piccalilli](https://piccalil.li/blog/functional-custom-elements-the-easy-way/).

Obviously, React for the simplicity of functional components.


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
