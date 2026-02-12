/// <reference types="vite/client" />

declare namespace preact.JSX {
  interface IntrinsicElements {
    'iconify-icon': {
      icon: string;
      class?: string;
      width?: string | number;
      height?: string | number;
    };
  }
}
