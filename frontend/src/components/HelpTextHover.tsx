import { QuestionIcon } from "@chakra-ui/icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverArrow,
  PopoverCloseButton,
  PopoverBody,
} from "@chakra-ui/popover";

const HelpTextHover = ({ helpText }: { helpText: any }) => {
  return (
    <>
      <Popover placement="right-end">
        <PopoverTrigger>
          <QuestionIcon as="button" />
        </PopoverTrigger>
        <PopoverContent>
          <PopoverArrow />
          <PopoverCloseButton />
          <PopoverBody>{helpText}</PopoverBody>
        </PopoverContent>
      </Popover>
    </>
  );
};

export default HelpTextHover;
