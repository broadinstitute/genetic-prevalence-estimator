import { ChevronDownIcon } from "@chakra-ui/icons";
import {
  FormControl,
  FormLabel,
  IconButton,
  Input,
  InputGroup,
  InputRightElement,
  List,
  ListItem,
} from "@chakra-ui/react";
import { useCombobox } from "downshift";
import { debounce } from "lodash";
import { useCallback, useRef, useState } from "react";

class CancelablePromise<T> {
  isCanceled = false;
  promise: Promise<T>;

  constructor(
    executor: (
      resolve: (value: T) => void,
      reject: (error: Error) => void
    ) => void
  ) {
    this.promise = new Promise((resolve, reject) => {
      const wrappedResolve = (value: T) => {
        if (!this.isCanceled) {
          resolve(value);
        }
      };

      const wrappedReject = (error: Error) => {
        if (!this.isCanceled) {
          reject(error);
        }
      };

      return executor(wrappedResolve, wrappedReject);
    });
  }

  cancel() {
    this.isCanceled = true;
  }

  then(onFulfilled: (value: T) => any, onRejected?: (error: Error) => any) {
    return this.promise.then(onFulfilled, onRejected);
  }
}

interface ComboboxProps<ComboboxItem> {
  id: string;
  label: string;
  placeholder?: string;
  isRequired?: boolean;
  fetchItems: (inputValue: string) => Promise<ComboboxItem[]>;
  itemToString: (item: ComboboxItem) => string;
  onSelectItem: (item: ComboboxItem) => void;
}

const Combobox = <ComboboxItem,>(props: ComboboxProps<ComboboxItem>) => {
  const {
    id,
    label,
    placeholder,
    isRequired = false,
    fetchItems,
    itemToString,
    onSelectItem,
  } = props;

  const [inputItems, setInputItems] = useState<ComboboxItem[]>([]);

  const activeRequest = useRef<CancelablePromise<ComboboxItem[]> | null>(null);
  /* eslint-disable-next-line react-hooks/exhaustive-deps */
  const debouncedFetchItems = useCallback(
    debounce((inputValue) => {
      if (activeRequest.current) {
        activeRequest.current.cancel();
      }

      activeRequest.current = new CancelablePromise((resolve, reject) => {
        fetchItems(inputValue).then(resolve, reject);
      });

      activeRequest.current.then((fetchedItems) => {
        setInputItems(fetchedItems);
      });
    }, 400),
    []
  );

  const {
    isOpen,
    getToggleButtonProps,
    getLabelProps,
    getMenuProps,
    getInputProps,
    getComboboxProps,
    highlightedIndex,
    getItemProps,
  } = useCombobox({
    items: inputItems,
    itemToString: (item) => itemToString((item as unknown) as ComboboxItem),
    onInputValueChange: ({ inputValue }) => {
      debouncedFetchItems(inputValue!);
    },
    onSelectedItemChange: ({ selectedItem }) => {
      onSelectItem((selectedItem as unknown) as ComboboxItem);
    },
  });
  return (
    <FormControl id={id} isRequired={isRequired}>
      <FormLabel {...getLabelProps()}>{label}</FormLabel>
      <div {...getComboboxProps()}>
        <InputGroup>
          <Input placeholder={placeholder} {...getInputProps()} />
          <InputRightElement>
            <IconButton
              aria-label="toggle menu"
              icon={<ChevronDownIcon />}
              {...getToggleButtonProps()}
            />
          </InputRightElement>
        </InputGroup>
      </div>
      <List
        {...(isOpen && inputItems.length > 0
          ? {
              borderColor: "gray",
              borderWidth: 1,
            }
          : {})}
        {...getMenuProps()}
      >
        {isOpen &&
          inputItems.map((item, index) => (
            <ListItem
              key={`${item}${index}`}
              bg={highlightedIndex === index ? "blue.100" : {}}
              px={2}
              py={1}
              {...getItemProps({ item, index })}
            >
              {itemToString(item)}
            </ListItem>
          ))}
      </List>
    </FormControl>
  );
};

export default Combobox;
