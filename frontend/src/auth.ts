// https://developers.google.com/identity/sign-in/web/sign-in
// https://developers.google.com/identity/sign-in/web/reference

import { post } from "./api";
import { AppConfig, User, authStore } from "./state";

export const initializeAuth = (appConfig: AppConfig) => {
  const updateUser = (googleUser: any) => {
    post("/auth/signout/", {})
      .catch(() => {})
      .then(() => {
        if (googleUser.isSignedIn()) {
          const token = googleUser.getAuthResponse().id_token;
          post("/auth/signin/", { token }).then((user: User) => {
            authStore.set({
              isSignedIn: true,
              user,
            });
          });
        } else {
          authStore.set({
            isSignedIn: false,
            user: null,
          });
        }
      });
  };

  const gapi = (window as any).gapi;
  gapi.load("auth2", () => {
    const auth2 = gapi.auth2.init({
      client_id: appConfig.google_auth_client_id,
    });

    auth2.currentUser.listen((googleUser: any) => {
      updateUser(googleUser);
    });
  });
};

export const signOut = () => {
  const gapi = (window as any).gapi;
  gapi.auth2.getAuthInstance().signOut();
};
