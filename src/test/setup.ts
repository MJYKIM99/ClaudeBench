import '@testing-library/jest-dom';

import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock Tauri APIs for testing
const mockTauri = {
  invoke: async () => {},
  listen: async () => () => {},
};

// Extend globalThis for Tauri mocks
declare global {
  var __TAURI__: typeof mockTauri;

  var __TAURI_INTERNALS__: typeof mockTauri;
}

globalThis.__TAURI__ = mockTauri;
globalThis.__TAURI_INTERNALS__ = mockTauri;
