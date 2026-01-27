import { ReactElement } from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
  type RenderOptions,
} from '@testing-library/react';

// Custom render function that can include providers
function customRender(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, { ...options });
}

export { act, cleanup, customRender as render, fireEvent, screen, waitFor, within };
export type { RenderOptions };
