
# Functional Element

## Introduction

Web Components are the best way to share small pieces of functionality for web
pages, especially when used in sites with static HTML. You get all the benefits
of a component based architecture like React without having to swallow the
whole workflow. Use the benefits of declarative, static HTML but get all the
goodness of simple interactivity.

To do:
- talk about signals
- talk about lit html and templating
- link to Hot Page blog post


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
import { shadowElement } from 'https://esm.sh/@hot-page/functional-element'

// Call the define function with our component
shadowElement(function HueSlider({ html, state }) {
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
3. That in turn returns a function, which we can call

I told you this was functional!

It's important to understand when these functions will run.

1. The define function runs once for every custom element you want to create.
2. The functional component will run every time one of your elements on the
   page is created.
3. The render function runs when the reactive properties change and the
   component's markup will be updated


## Rendering in Shadow or Light DOM

This package provides two define exports:
- `lightElement` which will render the template into the element's children.
- `shadowElement` which will render the template into a Shadow DOM.


## Tradeoffs

What you get:
- Easy reactivity
- (much) less boilerplate

What you give up:
- Private methods (for public, just assign them to `this`)
- Observed attributes (coming soon, see Roadmap)


## Prior Art

This was directly inspired by Ginger's [post on Piccalilli](https://piccalil.li/blog/functional-custom-elements-the-easy-way/).

Obviously, React for the simplicity of functional components.

To do:
- talk about Solid and how components only render once


## Roadmap

To Do:
- A cleanup function. Yes, this is kind of a necesity? But we can also safely
  assume that the browser is going to clean up the event handlers and things
  automatically when the element is removed from the DOM.

- Context (and context provider?)

- Observed attributes and attribute reflection (first argument could be an
  array of attribute names)

- Instance methods, especially getter and setter methods on the element. These
  can be provided with an `assign()` function in args and you can do this:

  ```javascript
  assign({
    show() {
      // run some functionality for imperative stuff
    }
    get hue() {
      return hue.get()
    }
    set hue(value) {
      hue.set(value)
    }
  })
  ```

  This `assign()` function is easy to write --perhaps easier than writing good
  documentation for it. Here, I just wrote it:

  ```javascript
  function assign(props) {
    Object.defineProperties(
      target,
      Object.getOwnPropertyDescriptors(props)
    );
  }
  ```

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
