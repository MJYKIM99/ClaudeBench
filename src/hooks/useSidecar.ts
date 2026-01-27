import { useCallback, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

import { useAppStore } from '../store/useAppStore';
import type { ClientEvent, ServerEvent } from '../types';

interface UseSidecarReturn {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  send: (event: ClientEvent) => Promise<void>;
}

// Module-level flag to prevent duplicate listeners across StrictMode re-renders
let listenersRegistered = false;

export function useSidecar(): UseSidecarReturn {
  const isConnectedRef = useRef(false);
  const setGlobalError = useAppStore((s) => s.setGlobalError);

  // Setup event listeners once at module level
  useEffect(() => {
    if (listenersRegistered) {
      return;
    }
    listenersRegistered = true;

    const setup = async () => {
      await listen<string>('sidecar-message', (event) => {
        try {
          const parsed = JSON.parse(event.payload) as ServerEvent;
          // Get fresh reference to avoid stale closure
          useAppStore.getState().handleServerEvent(parsed);
        } catch (e) {
          console.error('Failed to parse sidecar message:', e, event.payload);
        }
      });

      await listen<string>('sidecar-error', (event) => {
        useAppStore.getState().setGlobalError(event.payload);
      });

      await listen('sidecar-exit', () => {
        isConnectedRef.current = false;
      });

      await listen<string>('sidecar-stderr', (event) => {
        console.error('[sidecar stderr]', event.payload);
      });
    };

    setup();

    // Don't cleanup - keep listeners alive for the app lifetime
    return () => {};
  }, []);

  const start = useCallback(async () => {
    try {
      await invoke('start_sidecar');
      isConnectedRef.current = true;
    } catch (e) {
      setGlobalError(String(e));
    }
  }, [setGlobalError]);

  const stop = useCallback(async () => {
    try {
      await invoke('stop_sidecar');
      isConnectedRef.current = false;
    } catch (e) {
      setGlobalError(String(e));
    }
  }, [setGlobalError]);

  const send = useCallback(
    async (event: ClientEvent) => {
      try {
        await invoke('send_to_sidecar', {
          message: JSON.stringify(event),
        });
      } catch (e) {
        setGlobalError(String(e));
      }
    },
    [setGlobalError]
  );

  return {
    start,
    stop,
    send,
  };
}
