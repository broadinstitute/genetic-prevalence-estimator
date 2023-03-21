import { useEffect, useState } from "react";

import { get } from "./api";

export const subscribable = <T>() => {
  let callbacks: ((arg: T) => void)[] = [];

  return {
    subscribe: (fn: (arg: T) => void) => {
      callbacks = [...callbacks, fn];
      return {
        unsubscribe: () => {
          callbacks = callbacks.filter((cb) => cb !== fn);
        },
      };
    },
    next: (value: T) => {
      callbacks.forEach((cb) => {
        cb(value);
      });
    },
  };
};

export interface Store<T> {
  subscribe: (fn: (arg: T) => void) => { unsubscribe: () => void };
  get: () => T;
  set: (value: T) => void;
  update: (fn: (arg: T) => T) => void;
  reset: () => void;
}

export const atom = <T>(initialValue: T): Store<T> => {
  let value = initialValue;

  const { subscribe, next } = subscribable<T>();

  const get = () => value;
  const set = (newValue: T) => {
    value = newValue;
    next(newValue);
  };

  return {
    subscribe,
    get,
    set,
    update: (fn: (arg: T) => T) => set(fn(get())),
    reset: () => set(initialValue),
  };
};

export const useStore = <T>(store: Store<T>) => {
  const [value, setValue] = useState(store.get());
  useEffect(() => {
    return store.subscribe((v) => setValue(v)).unsubscribe;
  }, [store, setValue]);
  return value;
};

export interface AppConfig {
  google_auth_client_id: string;
  max_variant_lists_per_user: number;
}

export const appConfigStore: Store<AppConfig | null> = atom(
  null as AppConfig | null
);

export const loadAppConfig = (): Promise<AppConfig> => {
  return get("/config/").then((appConfig) => {
    appConfigStore.set(appConfig);
    return appConfig;
  });
};

export interface AuthUser {
  username: string;
  is_active: boolean;
  is_staff?: boolean;
}

export interface AuthState {
  isSignedIn: boolean;
  user: AuthUser | null;
}

export const authStore: Store<AuthState> = atom({
  isSignedIn: false,
  user: null,
} as AuthState);

export const loadCurrentUser = (): Promise<AuthUser | null> => {
  return get("/auth/whoami/").then(
    (user) => {
      authStore.set({
        isSignedIn: true,
        user,
      });
      return user;
    },
    () => null
  );
};
