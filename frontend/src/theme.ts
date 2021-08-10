import { extendTheme } from "@chakra-ui/react";

const theme = extendTheme({
  components: {
    Badge: {
      baseStyle: {
        textTransform: "none",
      },
    },
    Link: {
      baseStyle: {
        color: "blue.700",
        textDecoration: "underline",
      },
    },
    Table: {
      baseStyle: {
        th: {
          textTransform: "none",
        },
      },
    },
  },
});

export default theme;
