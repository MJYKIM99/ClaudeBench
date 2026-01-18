/// <reference types="vite/client" />

import type { ClientEvent } from './types';

declare global {
  interface Window {
    sidecarSend?: (event: ClientEvent) => void;
  }
}
