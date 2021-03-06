'use strict';
/*! (C) 2017 Andrea Giammarchi - ISC Style License */

const {Component, bind, define, hyper, wire} = require('hyperhtml/cjs');

const _init$ = {value: false};

const defineProperty = Object.defineProperty;

const extend = (target, source) => {
  for (const key in source) target[key] = source[key];
};

class HyperHTMLElement extends HTMLElement {

  // define a custom-element in the CustomElementsRegistry
  // class MyEl extends HyperHTMLElement {}
  // MyEl.define('my-el');
  static define(name) {
    const Class = this;
    const proto = Class.prototype;

    // if observedAttributes contains attributes to observe
    // HyperHTMLElement will directly reflect get/setAttribute
    // operation once these attributes are used, example:
    // el.observed = 123;
    // will automatically do
    // el.setAttribute('observed', 123);
    // triggering also the attributeChangedCallback
    (Class.observedAttributes || []).forEach(name => {
      if (!(name in proto)) defineProperty(
        proto,
        name.replace(/-([a-z])/g, ($0, $1) => $1.toUpperCase()),
        {
          configurable: true,
          get() { return this.getAttribute(name); },
          set(value) { this.setAttribute(name, value); }
        }
      );
    });

    const onChanged = proto.attributeChangedCallback;
    const hasChange = !!onChanged;

    // created() {} is the entry point to do whatever you want.
    // Once the node is live and upgraded as Custom Element.
    // This method grants to be triggered at the right time,
    // which is always once, and right before either
    // attributeChangedCallback or connectedCallback
    const created = proto.created;
    if (created) {
      // used to ensure create() is called once and once only
      defineProperty(
        proto,
        '_init$',
        {
          configurable: true,
          writable: true,
          value: true
        }
      );

      // ⚠️ if you need to overwrite/change attributeChangedCallback method
      //    at runtime after class definition, be sure you do so
      //    via Object.defineProperty to preserve its non-enumerable nature.
      defineProperty(
        proto,
        'attributeChangedCallback',
        {
          configurable: true,
          value(name, prev, curr) {
            if (this._init$) {
              created.call(defineProperty(this, '_init$', _init$));
            }
            // ensure setting same value twice
            // won't trigger twice attributeChangedCallback
            if (hasChange && prev !== curr) {
              onChanged.apply(this, arguments);
            }
          }
        }
      );

      // ⚠️ if you need to overwrite/change connectedCallback method
      //    at runtime after class definition, be sure you do so
      //    via Object.defineProperty to preserve its non-enumerable nature.
      const onConnected = proto.connectedCallback;
      const hasConnect = !!onConnected;
      defineProperty(
        proto,
        'connectedCallback',
        {
          configurable: true,
          value() {
            if (this._init$) {
              created.call(defineProperty(this, '_init$', _init$));
            }
            if (hasConnect) {
              onConnected.apply(this, arguments);
            }
          }
        }
      );
    } else if (hasChange) {
      // ⚠️ if you need to overwrite/change attributeChangedCallback method
      //    at runtime after class definition, be sure you do so
      //    via Object.defineProperty to preserve its non-enumerable nature.
      defineProperty(
        proto,
        'attributeChangedCallback',
        {
          configurable: true,
          value(name, prev, curr) {
            // ensure setting same value twice
            // won't trigger twice attributeChangedCallback
            if (prev !== curr) {
              onChanged.apply(this, arguments);
            }
          }
        }
      );
    }

    // define lazily all handlers
    // class { handleClick() { ... }
    // render() { `<a onclick=${this.handleClick}>` } }
    Object.getOwnPropertyNames(proto).forEach(key => {
      if (/^handle[A-Z]/.test(key)) {
        const _key$ = '_' + key + '$';
        const method = proto[key];
        defineProperty(proto, key, {
          configurable: true,
          get() {
            return  this[_key$] ||
                    (this[_key$] = method.bind(this));
          }
        });
      }
    });

    // whenever you want to directly use the component itself
    // as EventListener, you can pass it directly.
    // https://medium.com/@WebReflection/dom-handleevent-a-cross-platform-standard-since-year-2000-5bf17287fd38
    //  class Reactive extends HyperHTMLElement {
    //    oninput(e) { console.log(this, 'changed', e.target.value); }
    //    render() { this.html`<input oninput="${this}">`; }
    //  }
    if (!('handleEvent' in proto)) {
      // ⚠️ if you need to overwrite/change handleEvent method
      //    at runtime after class definition, be sure you do so
      //    via Object.defineProperty to preserve its non-enumerable nature.
      defineProperty(
        proto,
        'handleEvent',
        {
          configurable: true,
          value(event) {
            this[
              (event.currentTarget.dataset || {}).call ||
              ('on' + event.type)
            ](event);
          }
        }
      );
    }

    customElements.define(name, Class);
    return Class;
  }

  // lazily bind once hyperHTML logic
  // to either the shadowRoot, if present and open,
  // the _shadowRoot property, if set due closed shadow root,
  // or the custom-element itself if no Shadow DOM is used.
  get html() {
    return this._html$ || (this.html = bind(
      // in case of Shadow DOM {mode: "open"}, use it
      this.shadowRoot ||
      // in case of Shadow DOM {mode: "close"}, use it
      // this needs the following reference created upfront
      // this._shadowRoot = this.attachShadow({mode: "close"});
      this._shadowRoot ||
      // if no Shadow DOM is used, simply use the component
      // as container for its own content (it just works too)
      this
    ));
  }

  // it can be set too if necessary, it won't invoke render()
  set html(value) {
    defineProperty(this, '_html$', {configurable: true, value: value});
  }

  // ---------------------//
  // Basic State Handling //
  // ---------------------//

  // overwrite this method with your own render
  render() {}

  // define the default state object
  // you could use observed properties too
  get defaultState() { return {}; }

  // the state with a default
  get state() {
    return this._state$ || (this.state = this.defaultState);
  }

  // it can be set too if necessary, it won't invoke render()
  set state(value) {
    defineProperty(this, '_state$', {configurable: true, value: value});
  }

  // currently a state is a shallow copy, like in Preact or other libraries.
  // after the state is updated, the render() method will be invoked.
  // ⚠️ do not ever call this.setState() inside this.render()
  setState(state) {
    extend(
      this.state,
      typeof state === 'function' ?
        state.call(this, this.state) : state
    );
    this.render();
  }

};

// exposing hyperHTML utilities
HyperHTMLElement.Component = Component;
HyperHTMLElement.bind = bind;
HyperHTMLElement.intent = define;
HyperHTMLElement.wire = wire;
HyperHTMLElement.hyper = hyper;

Object.defineProperty(exports, '__esModule', {value: true}).default = HyperHTMLElement;
