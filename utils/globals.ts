declare global {
  interface Window {
    lockedGlobals?: Record<string, boolean>;
  }
}

export const cleanUpGlobals = (globals: string[]): void =>
  globals.forEach((globalKey) => {
    const resetKey = (): void => {
      Object.assign(window, { [globalKey]: undefined });
    };

    if (globalKey in window) {
      try {
        delete (window as never)[globalKey];
      } finally {
        resetKey();
      }
    }
  });

const addGlobalLock = (key: string): void => {
  Object.defineProperty(window, key, <PropertyDescriptor>{
    get() {
      return window.lockedGlobals?.[key] ? undefined : this.value;
    },
    set(value: unknown) {
      if (!window.lockedGlobals?.[key]) this.value = value;
    },
  });
};

const setGlobalLock = (key: string, locked: boolean): void => {
  window.lockedGlobals = {
    ...window.lockedGlobals,
    [key]: locked,
  };
};

export const lockGlobal = (key: string): void => setGlobalLock(key, true);

export const unlockGlobal = (key: string): void => {
  if (!Object.getOwnPropertyDescriptor(window, key)) addGlobalLock(key);

  setGlobalLock(key, false);
};
