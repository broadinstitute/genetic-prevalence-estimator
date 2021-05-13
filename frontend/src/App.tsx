import { ChevronDownIcon } from "@chakra-ui/icons";
import {
  Box,
  Button,
  Center,
  ChakraProvider,
  Container,
  Flex,
  HStack,
  Link,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Spinner,
} from "@chakra-ui/react";
import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Link as RRLink } from "react-router-dom";

import SignInButton from "./components/SignInButton";
import { initializeAuth, signOut } from "./auth";
import { authStore, loadAppConfig, useStore } from "./state";

const App = () => {
  const { isSignedIn, user } = useStore(authStore);

  return (
    <>
      <Box boxShadow="base" mb={4}>
        <Container maxW="container.lg">
          <Flex h={16} alignItems={"center"} justifyContent={"space-between"}>
            <HStack spacing={8} alignItems={"center"}>
              <Box>
                <Link as={RRLink} py={3} to="/">
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
                  </MenuList>
                </Menu>
              </Flex>
            )}
          </Flex>
        </Container>
      </Box>

      <Container maxW="container.lg">
        {!isSignedIn && <SignInButton />}
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
      <ChakraProvider>{content}</ChakraProvider>
    </Router>
  );
};

export default AppContainer;
