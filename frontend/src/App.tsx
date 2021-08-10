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
  HStack,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Spinner,
} from "@chakra-ui/react";
import { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Link as RRLink,
  Redirect,
  Route,
  Switch,
} from "react-router-dom";

import CreateVariantListPage from "./components/CreateVariantListPage/CreateVariantListPage";
import Link from "./components/Link";
import SignInButton from "./components/SignInButton";
import UsersPage from "./components/UsersPage/UsersPage";
import VariantListPage from "./components/VariantListPage/VariantListPage";
import VariantListsPage from "./components/VariantListsPage";
import { initializeAuth, signOut } from "./auth";
import { authStore, loadAppConfig, useStore } from "./state";
import theme from "./theme";

const App = () => {
  const { isSignedIn, user } = useStore(authStore);

  return (
    <>
      <Box boxShadow="base" mb={4}>
        <Container maxW="container.xl">
          <Flex h={16} alignItems={"center"} justifyContent={"space-between"}>
            <HStack spacing={8} alignItems={"center"}>
              <Box>
                <Link
                  to="/"
                  style={{ color: "inherit", textDecoration: "none" }}
                >
                  Aggregate Frequency Calculator
                </Link>
              </Box>
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
                      <MenuItem as={RRLink} to="/users/">
                        Manage users
                      </MenuItem>
                    )}
                  </MenuList>
                </Menu>
              </Flex>
            )}
          </Flex>
        </Container>
      </Box>

      <Container maxW="container.xl">
        {!isSignedIn && <SignInButton />}
        {isSignedIn && (
          <>
            {user?.is_active ? (
              <Switch>
                <Route
                  exact
                  path="/variant-lists/new/"
                  component={CreateVariantListPage}
                />

                <Route
                  exact
                  path="/variant-lists/:uuid/"
                  render={({ match }) => {
                    return <VariantListPage uuid={match.params.uuid} />;
                  }}
                />

                <Route
                  exact
                  path="/variant-lists/"
                  component={VariantListsPage}
                />
                <Route
                  exact
                  path="/"
                  render={() => {
                    return <Redirect to="/variant-lists/" />;
                  }}
                />

                {user?.is_staff && (
                  <Route exact path="/users/" component={UsersPage} />
                )}
              </Switch>
            ) : (
              <Alert status="warning">
                <AlertIcon />
                <AlertTitle>Inactive account</AlertTitle>
                <AlertDescription>
                  Contact site administrators to activate your account.
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
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
