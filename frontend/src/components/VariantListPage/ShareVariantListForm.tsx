import {
  Button,
  FormControl,
  FormLabel,
  HStack,
  Input,
  Select,
} from "@chakra-ui/react";
import { useState } from "react";

import { VariantListAccessLevel } from "../../types";

interface ShareVariantListFormValue {
  username: string;
  level: VariantListAccessLevel;
}

interface ShareVariantListFormProps {
  onSubmit: (value: ShareVariantListFormValue) => void;
}

const ShareVariantListForm = (props: ShareVariantListFormProps) => {
  const { onSubmit } = props;

  const [username, setUsername] = useState("");
  const [level, setLevel] = useState("Viewer");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();

        onSubmit({
          level: level as VariantListAccessLevel,
          username,
        });

        setUsername("");
      }}
    >
      <HStack align="flex-end">
        <FormControl id="share-variant-list-user" flexGrow={1}>
          <FormLabel>User</FormLabel>
          <Input
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
            }}
          />
        </FormControl>

        <FormControl id="share-variant-list-level" width={300}>
          <FormLabel>Access level</FormLabel>
          <Select
            value={level}
            onChange={(e) => {
              setLevel(e.target.value);
            }}
          >
            <option value="Viewer">Viewer</option>
            <option value="Editor">Editor</option>
            <option value="Owner">Owner</option>
          </Select>
        </FormControl>

        <Button colorScheme="blue" type="submit" flexShrink={0}>
          Submit
        </Button>
      </HStack>
    </form>
  );
};

export default ShareVariantListForm;
