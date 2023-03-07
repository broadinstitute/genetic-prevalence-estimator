import { ChevronDownIcon } from "@chakra-ui/icons";
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Button,
  Center,
  ChakraProvider,
  Container,
  Flex,
  Heading,
  HStack,
  Link as BaseLink,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Spinner,
} from "@chakra-ui/react";
import { FC, useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Link as RRLink,
  Route,
  Switch,
} from "react-router-dom";

import "./style.css";
import AboutPage from "./components/AboutPage";
import CreateVariantListPage from "./components/CreateVariantListPage/CreateVariantListPage";
import FAQPage from "./components/FAQPage";
import HomePage from "./components/HomePage";
import Link from "./components/Link";
import PageNotFoundPage from "./components/PageNotFoundPage";
import { screenOnly } from "./components/media";
import SignInButton from "./components/SignInButton";
import SystemStatusPage from "./components/SystemStatusPage/SystemStatusPage";
import UsersPage from "./components/UsersPage/UsersPage";
import VariantListPage from "./components/VariantListPage/VariantListPage";
import VariantListsPage from "./components/VariantListsPage";
import { initializeAuth, signOut } from "./auth";
import { authStore, loadAppConfig, useStore } from "./state";
import theme from "./theme";

const RequireSignIn: FC<{}> = ({ children }) => {
  const { isSignedIn, user } = useStore(authStore);

  if (!isSignedIn) {
    return (
      <>
        <Heading as="h1" mb={4}>
          Sign in to view this page
        </Heading>

        <Box mb={4}>
          <SignInButton />
        </Box>

        <details>
          <summary>Why do I need to sign in?</summary>
          <Box borderLeftWidth="1px" borderColor="gray.400" pl={4} mt={2}>
            In order to store your variant lists, and allow you to edit them
            over time we need to have you signed in. By having users sign in we
            are also able to allow sharing lists across users, enabling
            collaboration.
          </Box>
        </details>
      </>
    );
  }

  if (!user?.is_active) {
    return (
      <Alert status="warning">
        <AlertIcon />
        <AlertTitle>Inactive account</AlertTitle>
        <AlertDescription>
          Contact site administrators to activate your account.
        </AlertDescription>
      </Alert>
    );
  }

  return <>{children}</>;
};

interface NavLinkProps {
  to: string;
}

const NavLink: FC<NavLinkProps> = ({ to, children }) => {
  return (
    <Link
      to={to}
      pl={2}
      pr={2}
      sx={{
        display: "flex",
        alignItems: "center",
        color: "inherit",
        textDecoration: "none",
      }}
    >
      {children}
    </Link>
  );
};

const App = () => {
  const { isSignedIn, user } = useStore(authStore);

  return (
    <>
      <Box boxShadow="base" mb={4} sx={screenOnly}>
        <Container maxW="1400px">
          <Flex h={16} alignItems={"center"} justifyContent={"space-between"}>
            <HStack alignItems="stretch" height="100%">
              <Link
                to="/"
                mr={4}
                style={{
                  display: "flex",
                  alignItems: "center",
                  color: "inherit",
                  textDecoration: "none",
                }}
              >
                GeniE
              </Link>

              <NavLink to="/about/">About</NavLink>
              <NavLink to="/faq/">FAQ</NavLink>
            </HStack>

            {isSignedIn && (
              <Flex alignItems={"center"}>
                <Menu>
                  <MenuButton
                    as={Button}
                    cursor={"pointer"}
                    rightIcon={<ChevronDownIcon />}
                  >
                    {user!.username}
                  </MenuButton>
                  <MenuList>
                    <MenuItem
                      onClick={() => {
                        signOut();
                      }}
                    >
                      Sign out
                    </MenuItem>
                    {user!.is_staff && (
                      <>
                        <MenuItem as={RRLink} to="/users/">
                          Manage users
                        </MenuItem>
                        <MenuItem as={RRLink} to="/status/">
                          System status
                        </MenuItem>
                      </>
                    )}
                  </MenuList>
                </Menu>
              </Flex>
            )}
          </Flex>
        </Container>
      </Box>
      <Box px={4} mb={4}>
        <Alert status="info">
          <AlertIcon />
          <span>
            GeniE is currently available in beta. We appreciate any{" "}
            <BaseLink href="https://forms.gle/4qyfUnVouE9PA4cV9" isExternal>
              feedback
            </BaseLink>{" "}
            you can provide.
          </span>
        </Alert>
      </Box>

      <Container pb={4} maxW="1400px">
        <Switch>
          <Route
            exact
            path="/variant-lists/new/"
            render={() => (
              <RequireSignIn>
                <CreateVariantListPage />
              </RequireSignIn>
            )}
          />

          <Route
            exact
            path="/variant-lists/:uuid/"
            render={({ match }) => (
              <RequireSignIn>
                <VariantListPage uuid={match.params.uuid} />
              </RequireSignIn>
            )}
          />

          <Route
            exact
            path="/variant-lists/"
            render={() => (
              <RequireSignIn>
                <VariantListsPage />
              </RequireSignIn>
            )}
          />

          {user?.is_staff && [
            <Route
              key="/status/"
              exact
              path="/status/"
              render={() => (
                <RequireSignIn>
                  <SystemStatusPage />
                </RequireSignIn>
              )}
            />,

            <Route
              key="/users/"
              exact
              path="/users/"
              render={() => (
                <RequireSignIn>
                  <UsersPage />
                </RequireSignIn>
              )}
            />,
          ]}

          <Route exact path="/about/" render={() => <AboutPage />} />

          <Route exact path="/faq/" render={() => <FAQPage />} />

          <Route exact path="/" render={() => <HomePage />} />

          <Route path="*" render={() => <PageNotFoundPage />} />
        </Switch>
      </Container>
    </>
  );
};

const AppContainer = () => {
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    loadAppConfig().then((appConfig) => {
      const subscription = authStore.subscribe(() => {
        setIsInitializing(false);
        subscription.unsubscribe();
      });
      initializeAuth(appConfig);
    });
  }, []);

  const content = isInitializing ? (
    <Center w="100vw" h="100vh">
      <Spinner size="xl" />
    </Center>
  ) : (
    <App />
  );

  return (
    <Router>
      <ChakraProvider theme={theme}>{content}</ChakraProvider>
    </Router>
  );
};

export default AppContainer;
