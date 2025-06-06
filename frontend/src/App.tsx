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
  useHistory,
} from "react-router-dom";

import "./style.css";
import AboutPage from "./components/AboutPage";
import CreateVariantListPage from "./components/CreateVariantListPage/CreateVariantListPage";
import FAQPage from "./components/FAQPage";
import HomePage from "./components/HomePage";
import Link from "./components/Link";
import PageNotFoundPage from "./components/PageNotFoundPage";
import PublicListsPage from "./components/PublicVariantListsPage";
import DashboardListsPage from "./components/DashboardListPage/DashboardListsPage";
import { screenOnly } from "./components/media";
import SignInButton from "./components/SignInButton";
import SystemStatusPage from "./components/SystemStatusPage/SystemStatusPage";
import UsersPage from "./components/UsersPage/UsersPage";
import DashboardListPage from "./components/DashboardListPage/DashboardListPage";
import IncidencePage from "./components/DashboardListPage/IncidencePage";

import VariantListPage from "./components/VariantListPage/VariantListPage";
import VariantListsPage from "./components/VariantListsPage";
import { initializeAuth, signOut } from "./auth";
import { authStore, loadCurrentUser, loadAppConfig, useStore } from "./state";
import theme from "./theme";

const banner = undefined;

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
  const history = useHistory();

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

              {isSignedIn && (
                <NavLink to="/variant-lists/">Variant lists</NavLink>
              )}
              <NavLink to="/dashboard/">Dashboard</NavLink>
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
                        signOut().then(() => {
                          history.push("/");
                        });
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
                        <MenuItem as={RRLink} to="/public-lists/">
                          Public Lists
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
      {banner}

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
            render={({ match }) => <VariantListPage uuid={match.params.uuid} />}
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
          <Route
            exact
            path="/public-lists"
            render={() => <PublicListsPage />}
          />
          <Route
            exact
            path="/dashboard/"
            render={() => <DashboardListsPage />}
          />
          <Route
            exact
            path="/dashboard/:uuid/"
            render={({ match }) => (
              <DashboardListPage uuid={match.params.uuid} />
            )}
          />
          <Route
            exact
            path="/dashboard-incidence/:uuid/"
            render={({ match }) =>
              isSignedIn && user?.is_staff ? (
                <RequireSignIn>
                  <IncidencePage uuid={match.params.uuid} />
                </RequireSignIn>
              ) : (
                <RequireSignIn>
                  <Box mt={8}>
                    <Heading as="h2" size="md">
                      This page is not accessible to non-staff users.
                    </Heading>
                  </Box>
                </RequireSignIn>
              )
            }
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

            <Route
              exact
              path="/variant-lists/:uuid/"
              render={({ match }) => (
                <VariantListPage uuid={match.params.uuid} />
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
    Promise.all([loadAppConfig(), loadCurrentUser()]).then(([appConfig]) => {
      initializeAuth(appConfig);
      setIsInitializing(false);
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
