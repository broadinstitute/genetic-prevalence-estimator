// https://developers.google.com/identity/gsi/web/guides/overview
// https://developers.google.com/identity/gsi/web/guides/handle-credential-responses-js-functions
// https://developers.google.com/identity/gsi/web/reference/js-reference

import { post } from "./api";
import { AppConfig, AuthUser, authStore } from "./state";

export const initializeAuth = (appConfig: AppConfig) => {
  const handleCredentialResponse = (response: any) => {
    post("/auth/signout/", {})
      .catch(() => {})
      .then(() => {
        const token: string = response.credential;
        post("/auth/signin/", { token }).then((user: AuthUser) => {
          authStore.set({
            isSignedIn: true,
            user,
          });
        });
      });
  };

  const initializeGoogleAccount = () => {
    (window as any).google.accounts.id.initialize({
      client_id: appConfig.google_auth_client_id,
      callback: handleCredentialResponse,
    });
  };

  if ((window as any).google) {
    initializeGoogleAccount();
  } else {
    (window as any).onGoogleLibraryLoad = initializeGoogleAccount;
  }
};

export const signOut = (): Promise<void> => {
  return post("/auth/signout/", {}).then(() => {
    authStore.set({
      isSignedIn: false,
      user: null,
    });
  });
};
