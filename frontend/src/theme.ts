import { extendTheme } from "@chakra-ui/react";

const theme = extendTheme({
  components: {
    Link: {
      baseStyle: {
        color: "blue.700",
        textDecoration: "underline",
      },
    },
  },
});

export default theme;
