import {
  Button,
  FormControl,
  FormLabel,
  List,
  ListItem,
} from "@chakra-ui/react";
import {
  useSelect,
  UseSelectState,
  UseSelectStateChangeOptions,
} from "downshift";

const stateReducer = (
  state: UseSelectState<string>,
  actionAndChanges: UseSelectStateChangeOptions<string>
) => {
  const { changes, type } = actionAndChanges;
  switch (type) {
    case useSelect.stateChangeTypes.MenuKeyDownEnter:
    case useSelect.stateChangeTypes.MenuKeyDownSpaceButton:
    case useSelect.stateChangeTypes.ItemClick:
    case useSelect.stateChangeTypes.ToggleButtonClick:
      return {
        ...changes,
        isOpen: true, // keep menu open after selection.
        highlightedIndex: state.highlightedIndex,
      };
    default:
      return changes;
  }
};

interface MultipleSelectProps {
  id: string;
  label: string;
  options: { label: string; value: string }[];
  value: string[];
  onChange: (selectedPopulationIds: string[]) => void;
}

const MultipleSelect = (props: MultipleSelectProps) => {
  const { id, label, options, value, onChange } = props;

  const {
    isOpen,
    getToggleButtonProps,
    getLabelProps,
    getMenuProps,
    highlightedIndex,
    getItemProps,
  } = useSelect<string>({
    items: options.map((option) => option.value),
    stateReducer,
    selectedItem: null,
    onSelectedItemChange: ({ selectedItem }) => {
      if (!selectedItem) {
        return;
      }
      const index = value.indexOf(selectedItem);
      if (index > 0) {
        onChange([...value.slice(0, index), ...value.slice(index + 1)]);
      } else if (index === 0) {
        onChange([...value.slice(1)]);
      } else {
        onChange([...value, selectedItem]);
      }
    },
  });

  return (
    <FormControl id={id}>
      <FormLabel {...getLabelProps()}>{label}</FormLabel>
      <Button {...getToggleButtonProps()}>{value.length} selected</Button>
      <List
        {...(isOpen
          ? {
              borderColor: "gray",
              borderWidth: 1,
            }
          : {})}
        {...getMenuProps()}
      >
        {isOpen &&
          options.map((option, index) => (
            <ListItem
              key={option.value}
              bg={highlightedIndex === index ? "blue.100" : {}}
              px={2}
              py={1}
              style={{ cursor: "pointer" }}
              {...getItemProps({
                item: option.value,
                index,
              })}
            >
              <input
                type="checkbox"
                checked={value.includes(option.value)}
                onChange={() => {}}
              />{" "}
              {option.label}
            </ListItem>
          ))}
      </List>
    </FormControl>
  );
};

export default MultipleSelect;
