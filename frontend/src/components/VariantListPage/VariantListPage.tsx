import { AddIcon } from "@chakra-ui/icons";
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Badge,
  Box,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Button,
  Center,
  Heading,
  HStack,
  ListItem,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Spinner,
  Text,
  Tooltip,
  UnorderedList,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { debounce } from "lodash";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link as RRLink, useHistory } from "react-router-dom";

import { del, get, patch, post } from "../../api";
import { renderErrorDescription } from "../../errors";
import { Store, atom, authStore, useStore } from "../../state";
import { VariantId, VariantList, VariantListAccessLevel } from "../../types";

import ButtonWithConfirmation from "../ButtonWithConfirmation";
import DateTime from "../DateTime";
import { DescriptionList, DescriptionListItem } from "../DescriptionList";
import DocumentTitle from "../DocumentTitle";
import { printOnly, screenOnly } from "../media";
import VariantsInput, { InputVariant } from "../VariantsInput";

import { AnnotationOption } from "./AnnotationTypeSelector";
import { EditVariantListButton } from "./EditVariantList";
import Methods from "./Methods";
import VariantListChartsWithCalculations from "./VariantListCalculations/VariantListChartsWithCalculations";
import {
  VariantListSharingButton,
  accessLevelDescriptions,
} from "./VariantListSharingSettings";
import VariantListMetadata from "./VariantListMetadata";
import VariantListStatus from "./VariantListStatus";
import VariantListVariants from "./VariantListVariants";
import VariantListReviewStatus from "./VariantListReviewStatus";

const addVariantsToVariantList = (
  uuid: string,
  variants: string[]
): Promise<void> => {
  return post(`/variant-lists/${uuid}/variants/`, { variants });
};

const reprocessVariantList = (uuid: string): Promise<void> => {
  return post(`/variant-lists/${uuid}/process/`, {});
};

const deleteVariantList = (uuid: string): Promise<void> => {
  return del(`/variant-lists/${uuid}/`);
};

const usePrevious = <T,>(value: T): T | undefined => {
  const ref = useRef<T>();
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
};

const useCurrentValue = <T,>(value: T): (() => T) => {
  const ref = useRef<T>();
  ref.current = value;

  return useCallback(() => ref.current!, []);
};

type VariantListAnnotation = {
  selectedVariants: Set<string>;
  variantNotes: Record<VariantId, string>;
};

const useVariantListAnnotation = (
  variantList: VariantList,
  annotationType: AnnotationOption
) => {
  const [annotation, setAnnotation] = useState<VariantListAnnotation>({
    selectedVariants: new Set<VariantId>([]),
    variantNotes: {},
  });
  const getCurrentAnnotation = useCurrentValue(annotation);
  const [loading, setLoading] = useState(true);

  const annotationEndpoints = {
    shared: "shared-annotation",
    personal: "annotation",
  };

  useEffect(() => {
    setLoading(true);
    get(
      `/variant-lists/${variantList.uuid}/${annotationEndpoints[annotationType]}/`
    )
      .then((annotation) => {
        setAnnotation({
          selectedVariants: new Set(annotation.selected_variants),
          variantNotes: annotation.variant_notes,
        });
      })
      .finally(() => {
        setLoading(false);
      })
      .catch((error) => {
        toast({
          title: "Unable to retrieve variant list annotations",
          description: renderErrorDescription(error),
          status: "error",
          duration: 10000,
          isClosable: true,
        });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantList.uuid, annotationType]);

  const toast = useToast();

  const saveSelectedVariants = useMemo(
    () =>
      debounce(() => {
        const annotation = getCurrentAnnotation();
        patch(
          `/variant-lists/${variantList.uuid}/${annotationEndpoints[annotationType]}/`,
          {
            selected_variants: Array.from(annotation.selectedVariants),
          }
        )
          .then(() => {
            toast({
              title: "Saved selected variants",
              status: "success",
              duration: 1000,
              isClosable: true,
            });
          })
          .catch((error) => {
            toast({
              title: "Unable to save selected variants",
              description: renderErrorDescription(error),
              status: "error",
              duration: 10000,
              isClosable: true,
            });
          });
      }, 2000),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [variantList.uuid, annotationType]
  );

  const setSelectedVariants = useCallback(
    (selectedVariants: VariantListAnnotation["selectedVariants"]) => {
      setAnnotation((annotation) => ({ ...annotation, selectedVariants }));
      saveSelectedVariants();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const saveVariantNotes = useCallback(
    (variantNotes) => {
      patch(
        `/variant-lists/${variantList.uuid}/${annotationEndpoints[annotationType]}/`,
        {
          variant_notes: variantNotes,
        }
      )
        .then(() => {
          toast({
            title: "Saved notes",
            status: "success",
            duration: 1000,
            isClosable: true,
          });
        })
        .catch((error) => {
          toast({
            title: "Unable to save notes",
            description: renderErrorDescription(error),
            status: "error",
            duration: 10000,
            isClosable: true,
          });
        });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [variantList.uuid, annotationType]
  );

  const setVariantNote = useCallback(
    (variantId: VariantId, note: string) => {
      setAnnotation((annotation) => ({
        ...annotation,
        variantNotes: {
          ...annotation.variantNotes,
          [variantId]: note,
        },
      }));
      saveVariantNotes({
        ...annotation.variantNotes,
        [variantId]: note,
      });
    },
    [annotation, saveVariantNotes]
  );

  const previousStatus = usePrevious(variantList.status);
  useEffect(() => {
    const { status } = variantList;
    if (
      status === "Ready" &&
      status !== previousStatus &&
      previousStatus !== undefined
    ) {
      setSelectedVariants(
        new Set(variantList.variants.map((variant) => variant.id))
      );
    }
  }, [variantList, previousStatus, setSelectedVariants]);

  return {
    loading,
    selectedVariants: annotation.selectedVariants,
    setSelectedVariants,
    variantNotes: annotation.variantNotes,
    setVariantNote,
  };
};

interface VariantListPageProps {
  variantListStore: Store<VariantList>;
  refreshVariantList: () => void;
}

const VariantListPage = (props: VariantListPageProps) => {
  const { user } = useStore(authStore);

  const { variantListStore, refreshVariantList } = props;
  const variantList = useStore(variantListStore);
  const [annotationType, setAnnotationType] = useState<AnnotationOption>(
    "shared"
  );

  const [addedVariants, setAddedVariants] = useState<InputVariant[]>([]);
  const [addingVariants, setAddingVariants] = useState(false);
  const {
    isOpen: isAddVariantsModalOpen,
    onOpen: onOpenAddVariantsModal,
    onClose: onCloseAddingVariantModal,
  } = useDisclosure();

  const toast = useToast();

  const {
    loading: loadingAnnotation,
    selectedVariants,
    setSelectedVariants,
    variantNotes,
    setVariantNote,
  } = useVariantListAnnotation(variantList, annotationType);

  const history = useHistory();

  const [showMethods, setShowMethods] = useState(false);

  const userCanEdit =
    variantList.access_level === VariantListAccessLevel.EDITOR ||
    variantList.access_level === VariantListAccessLevel.OWNER;

  const userIsStaff = user?.is_staff ? true : false;

  return (
    <>
      <Box mb={4} sx={printOnly}>
        These estimates were performed using GeniE, the Genetic Prevalence
        Estimator ({document.location.hostname}), created and maintained by the
        Translation Genomics Group and Rare Genomes Project at the Broad
        Institute.
      </Box>

      <Heading as="h1" mb={4}>
        {variantList.label}
      </Heading>

      <VariantListStatus
        variantList={variantList}
        refreshVariantList={refreshVariantList}
      />

      {variantList.notes && <Text mb={4}>{variantList.notes}</Text>}

      <VariantListMetadata variantList={variantList} />

      <DescriptionList mb={4}>
        <DescriptionListItem label="Created">
          <DateTime datetime={variantList.created_at} />
        </DescriptionListItem>
        <DescriptionListItem label="Last updated">
          <DateTime datetime={variantList.updated_at} />
        </DescriptionListItem>
      </DescriptionList>

      {(userCanEdit || userIsStaff) && (
        <HStack mb={4} sx={screenOnly}>
          <EditVariantListButton size="sm" variantListStore={variantListStore}>
            Edit
          </EditVariantListButton>

          {userIsStaff && (
            <ButtonWithConfirmation
              size="sm"
              colorScheme="blue"
              confirmationPrompt="This cannot be undone."
              confirmButtonText="Re-process"
              onClick={() => {
                reprocessVariantList(variantList.uuid).then(
                  () => {
                    refreshVariantList();
                  },
                  (error) => {
                    toast({
                      title: "Unable to re-process-variant list",
                      description: renderErrorDescription(error),
                      status: "error",
                      duration: 10000,
                      isClosable: true,
                    });
                  }
                );
              }}
            >
              Re-process
            </ButtonWithConfirmation>
          )}

          {variantList.access_level === VariantListAccessLevel.OWNER && (
            <ButtonWithConfirmation
              size="sm"
              colorScheme="red"
              confirmationPrompt="This cannot be undone."
              confirmButtonText="Delete"
              onClick={() => {
                deleteVariantList(variantList.uuid).then(
                  () => {
                    history.push("/variant-lists/");
                  },
                  (error) => {
                    toast({
                      title: "Unable to delete variant list",
                      description: renderErrorDescription(error),
                      status: "error",
                      duration: 10000,
                      isClosable: true,
                    });
                  }
                );
              }}
            >
              Delete
            </ButtonWithConfirmation>
          )}
        </HStack>
      )}

      {variantList.access_permissions && (
        <Box sx={screenOnly}>
          <Heading as="h2" size="md" mb={2}>
            Sharing
          </Heading>
          <UnorderedList mb={4}>
            {variantList.access_permissions.map((accessPermission) => {
              return (
                <ListItem key={accessPermission.user} mb={2}>
                  {accessPermission.user}{" "}
                  <Tooltip
                    hasArrow
                    label={accessLevelDescriptions[accessPermission.level]}
                    placement="right"
                  >
                    <Badge>{accessPermission.level}</Badge>
                  </Tooltip>
                </ListItem>
              );
            })}
          </UnorderedList>
          <HStack mb={4}>
            <VariantListSharingButton
              size="sm"
              variantListStore={variantListStore}
            >
              Edit
            </VariantListSharingButton>
          </HStack>
          <VariantListReviewStatus variantListStore={variantListStore} />
        </Box>
      )}

      {variantList.status === "Ready" && (
        <VariantListChartsWithCalculations
          variantList={variantList}
          variants={
            selectedVariants
              ? variantList.variants.filter((variant) =>
                  selectedVariants.has(variant.id)
                )
              : variantList.variants
          }
        />
      )}

      <Box sx={screenOnly}>
        <HStack>
          <Heading as="h2" size="md" mb={2}>
            Variants
          </Heading>

          {userCanEdit && (
            <Tooltip hasArrow label="Add variants to variant list">
              <Button
                aria-label="Add variants to variant list"
                colorScheme="blue"
                disabled={
                  !(
                    variantList.status === "Ready" ||
                    variantList.status === "Error"
                  )
                }
                size="xs"
                onClick={() => {
                  setAddedVariants([]);
                  onOpenAddVariantsModal();
                }}
              >
                <AddIcon aria-hidden />
              </Button>
            </Tooltip>
          )}
        </HStack>

        <VariantListVariants
          annotationType={annotationType}
          selectedVariants={selectedVariants}
          selectionDisabled={loadingAnnotation}
          variantList={variantList}
          variantNotes={variantNotes}
          userCanEdit={userCanEdit}
          userIsStaff={userIsStaff}
          onChangeAnnotationType={setAnnotationType}
          onChangeSelectedVariants={setSelectedVariants}
          onEditVariantNote={setVariantNote}
        />
      </Box>

      <Button sx={screenOnly} onClick={() => setShowMethods((show) => !show)}>
        {`${showMethods ? "Hide" : "View"} methods`}
      </Button>
      <Box
        sx={{
          display: showMethods ? "block" : "none",
          "@media print": {
            display: "block",
          },
        }}
      >
        <Heading as="h2" size="md" mt={4} mb={2}>
          Methods
        </Heading>
        <Methods variantList={variantList} />
      </Box>

      <Modal
        isOpen={isAddVariantsModalOpen}
        size="xl"
        onClose={onCloseAddingVariantModal}
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Add variants</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Alert status="warning" alignItems="flex-start" mb={2}>
              <AlertIcon />
              <AlertDescription>
                Adding variants will update the clinical significance column for
                all variants in this variant list using the latest ClinVar data.
                <br />
                <br />
                If you would like to save the current clinical significance
                data, download the variant list before adding variants.
              </AlertDescription>
            </Alert>
            <VariantsInput
              id="added-variants"
              value={addedVariants}
              onChange={setAddedVariants}
            />
          </ModalBody>
          <ModalFooter>
            <Button
              mr={3}
              disabled={addingVariants}
              onClick={onCloseAddingVariantModal}
            >
              Cancel
            </Button>
            <Button
              disabled={addingVariants}
              onClick={() => {
                setAddingVariants(true);
                addVariantsToVariantList(
                  variantList.uuid,
                  addedVariants.map((variant) => variant.id)
                )
                  .then(
                    () => {
                      refreshVariantList();
                    },
                    (error) => {
                      toast({
                        title: "Unable to add variants",
                        description: renderErrorDescription(error),
                        status: "error",
                        duration: 10000,
                        isClosable: true,
                      });
                    }
                  )
                  .finally(() => {
                    setAddingVariants(false);
                  });
              }}
            >
              Add
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

const VariantListPageContainer = (props: { uuid: string }) => {
  const { uuid } = props;

  const variantListStoreRef = useRef<Store<VariantList> | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    let refreshInterval: number | undefined = undefined;
    let refreshCanceled = false;

    const refreshVariantList = () => {
      get(`/variant-lists/${uuid}/`).then(
        (variantList) => {
          if (refreshCanceled) {
            return;
          }

          variantListStoreRef.current?.set(variantList);

          if (
            !(
              variantList.status === "Queued" ||
              variantList.status === "Processing"
            )
          ) {
            window.clearInterval(refreshInterval);
          }
        },
        (error) => {
          window.clearInterval(refreshInterval);
          setError(error);
        }
      );
    };

    setIsLoading(true);
    get(`/variant-lists/${uuid}/`)
      .then((variantList) => {
        variantListStoreRef.current = atom(variantList);

        if (
          variantList.status === "Queued" ||
          variantList.status === "Processing"
        ) {
          refreshInterval = window.setInterval(refreshVariantList, 15000);
        }
      }, setError)
      .finally(() => {
        setIsLoading(false);
      });

    return () => {
      window.clearInterval(refreshInterval);
      refreshCanceled = true;
    };
  }, [uuid, refreshKey]);

  if (isLoading) {
    return (
      <>
        <DocumentTitle title="Variant list" />
        <Center>
          <Spinner size="lg" />
        </Center>
      </>
    );
  }

  if (error) {
    return (
      <>
        <DocumentTitle title="Variant list" />

        <Box mb={2}>
          <Breadcrumb>
            <BreadcrumbItem>
              <BreadcrumbLink as={RRLink} to="/">
                Home
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbItem>
              <BreadcrumbLink as={RRLink} to="/variant-lists/">
                Variant Lists
              </BreadcrumbLink>
            </BreadcrumbItem>
          </Breadcrumb>
        </Box>
        <Heading as="h1" mb={4}>
          Error
        </Heading>
        <Alert status="error">
          <AlertIcon />
          <AlertTitle>Unable to load variant list</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      </>
    );
  }

  if (variantListStoreRef.current) {
    const variantListStore = variantListStoreRef.current;
    const variantList = variantListStore.get();
    return (
      <>
        <DocumentTitle title={variantList.label} />

        <Box mb={2} sx={screenOnly}>
          <Breadcrumb>
            <BreadcrumbItem>
              <BreadcrumbLink as={RRLink} to="/">
                Home
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbItem>
              <BreadcrumbLink as={RRLink} to="/variant-lists/">
                Variant Lists
              </BreadcrumbLink>
            </BreadcrumbItem>

            <BreadcrumbItem isCurrentPage>
              <span>{variantList.label}</span>
            </BreadcrumbItem>
          </Breadcrumb>
        </Box>
        <VariantListPage
          variantListStore={variantListStore}
          refreshVariantList={() => setRefreshKey((k) => k + 1)}
        />
      </>
    );
  }

  return null;
};

export default VariantListPageContainer;
