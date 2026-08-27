import { post } from "./api";
import { initializeAuth } from "./auth";
import { authErrorStore, authStore } from "./state";

jest.mock("./api");

const appConfig = {
  google_auth_client_id: "test-client-id",
  max_variant_lists_per_user: 10,
};

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("initializeAuth", () => {
  let googleCredentialCallback: (response: { credential: string }) => void;

  beforeEach(() => {
    authStore.reset();
    authErrorStore.reset();
    (post as jest.Mock).mockReset();

    (window as any).google = {
      accounts: {
        id: {
          initialize: jest.fn(({ callback }) => {
            googleCredentialCallback = callback;
          }),
        },
      },
    };
  });

  afterEach(() => {
    delete (window as any).google;
  });

  it("signs the user in when /auth/signin/ succeeds", async () => {
    const user = { username: "test-user", is_active: true };
    (post as jest.Mock).mockImplementation((path: string) => {
      if (path === "/auth/signout/") {
        return Promise.resolve();
      }
      if (path === "/auth/signin/") {
        return Promise.resolve(user);
      }
      throw new Error(`Unexpected call to post("${path}")`);
    });

    initializeAuth(appConfig);
    googleCredentialCallback({ credential: "valid-token" });
    await flushPromises();

    expect(authStore.get()).toEqual({ isSignedIn: true, user });
    expect(authErrorStore.get()).toBeNull();
  });

  it("records the error instead of an unhandled rejection when /auth/signin/ fails", async () => {
    (post as jest.Mock).mockImplementation((path: string) => {
      if (path === "/auth/signout/") {
        return Promise.resolve();
      }
      if (path === "/auth/signin/") {
        return Promise.reject(new Error("Invalid token"));
      }
      throw new Error(`Unexpected call to post("${path}")`);
    });

    initializeAuth(appConfig);
    googleCredentialCallback({ credential: "expired-token" });
    await flushPromises();

    expect(authStore.get()).toEqual({ isSignedIn: false, user: null });
    expect(authErrorStore.get()?.message).toBe("Invalid token");
  });
});
