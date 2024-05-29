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

import { EditVariantListButton } from "./EditVariantList";
import Methods from "./Methods";
import {
  VariantListSharingButton,
  accessLevelDescriptions,
} from "./VariantListSharingSettings";
import VariantListMetadata from "./VariantListMetadata";
import VariantListStatus from "./VariantListStatus";
import VariantListVariants from "./VariantListVariants";
import VariantListReviewStatus from "./VariantListReviewStatus";
import {
  allVariantListCalculations,
  shouldCalculateContributionsBySource,
  VariantListCalculations,
} from "./VariantListCalculations/calculations";
import VariantListCharts from "./VariantListCalculations/VariantListCharts";
import { isStructuralVariantId } from "../identifiers";

const addVariantsToVariantList = (
  uuid: string,
  gnomadVersion: string,
  variants: string[]
): Promise<void> => {
  const shortVariants: string[] = [];
  const structuralVariants: string[] = [];
  variants.forEach((variantId) => {
    if (isStructuralVariantId(variantId, gnomadVersion)) {
      structuralVariants.push(variantId);
    } else {
      shortVariants.push(variantId);
    }
  });
  const postObject = {
    variants: shortVariants,
    structural_variants: structuralVariants,
  };

  return post(`/variant-lists/${uuid}/variants/`, postObject);
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
  variantCalculations: VariantListCalculations;
  includeHomozygotesInCalculations: boolean;
};

const useVariantListAnnotation = (variantList: VariantList) => {
  const [annotation, setAnnotation] = useState<VariantListAnnotation>({
    selectedVariants: new Set<VariantId>([]),
    variantNotes: {},
    variantCalculations: {
      prevalence: {},
      prevalenceBayesian: {},
      carrierFrequency: {},
      carrierFrequencySimplified: {},
      carrierFrequencyRawNumbers: {},
      clinvarOnlyCarrierFrequency: null,
      clinvarOnlyCarrierFrequencySimplified: null,
      clinvarOnlyCarrierFrequencyRawNumbers: null,
      plofOnlyCarrierFrequency: null,
      plofOnlyCarrierFrequencySimplified: null,
      plofOnlyCarrierFrequencyRawNumbers: null,
    },
    includeHomozygotesInCalculations: true,
  });
  const getCurrentAnnotation = useCurrentValue(annotation);
  const [loading, setLoading] = useState(true);

  const calculationsHaveNeverBeenSavedToDatabase = (annotation: {
    variant_calculations: VariantListCalculations;
  }) => {
    const expectedKeys = [
      "prevalence",
      "prevalenceBayesian",
      "carrierFrequency",
      "carrierFrequencySimplified",
      "carrierFrequencyRawNumbers",
      "plofOnlyCarrierFrequency",
      "plofOnlyCarrierFrequencySimplified",
      "plofOnlyCarrierFrequencyRawNumbers",
      "clinvarOnlyCarrierFrequency",
      "clinvarOnlyCarrierFrequencyRawNumbers",
      "clinvarOnlyCarrierFrequencySimplified",
    ];

    const isAnyCalcMissingFromDatabase = !expectedKeys.every((key) =>
      annotation.variant_calculations.hasOwnProperty(key)
    );
    return isAnyCalcMissingFromDatabase;
  };

  useEffect(() => {
    if (variantList.status !== "Ready") {
      // only start loading annotations if the variant list has been processed
      return;
    }

    setLoading(true);
    get(`/variant-lists/${variantList.uuid}/shared-annotation/`)
      .then(
        (annotation: {
          selected_variants: Set<string>;
          variant_notes: Record<VariantId, string>;
          variant_calculations: VariantListCalculations;
          include_homozygotes_in_calculations: boolean;
        }) => {
          const selectedVariants = new Set(annotation.selected_variants);

          // An update to the appliation moved to the model of calculating storing
          //   the calculated values in the database, to allow for viewing
          //   of these values in other views (i.e. the dashboard), since previously
          //   calculation always happened on the users machine.
          // Since this happened when there were already users, we check here
          //   if the results of the calculations were never saved to the database
          //   if so, we calculate and save on first load of these older lists
          const variantCalculations = calculationsHaveNeverBeenSavedToDatabase(
            annotation
          )
            ? allVariantListCalculations(
                selectedVariants
                  ? variantList.variants.filter((variant) =>
                      selectedVariants.has(variant.id)
                    )
                  : variantList.variants,
                variantList,
                annotation.include_homozygotes_in_calculations
              )
            : annotation.variant_calculations;

          if (calculationsHaveNeverBeenSavedToDatabase(annotation)) {
            // Hacky -- on first creation of a variant list, useMemo recieves an update
            //   to the variantList dependency too late, and has to wait one more cycle
            //   to actually use the data to process the list, on the first cycle there
            //   will be no selected variants, so don't bother saving at that time to
            //   avoid an unneccessary network request
            if (selectedVariants.size !== 0) {
              saveVariantCalculations(variantCalculations);
            }
          }

          setAnnotation({
            selectedVariants: selectedVariants,
            variantNotes: annotation.variant_notes,
            variantCalculations: variantCalculations,
            includeHomozygotesInCalculations:
              annotation.include_homozygotes_in_calculations,
          });
        }
      )
      .finally(() => {
        setLoading(false);
      })
      .catch((error) => {
        toast({
          title: "Unable to retrieve variant list annotations",
          description: renderErrorDescription(error),
          status: "error",
          duration: 10_000,
          isClosable: true,
        });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantList.uuid, variantList.status]);

  const toast = useToast();

  const saveVariantCalculations = (
    variantCalculations: VariantListCalculations
  ) => {
    patch(`/variant-lists/${variantList.uuid}/shared-annotation/`, {
      variant_calculations: variantCalculations,
    })
      .then(() => {
        toast({
          title: "Saved variant calculations",
          status: "success",
          duration: 1_000,
          isClosable: true,
        });
      })
      .catch((error) => {
        toast({
          title: "Unable to save variant calculations",
          description: renderErrorDescription(error),
          status: "error",
          duration: 10_000,
          isClosable: true,
        });
      });
  };

  const saveSelectedVariants = useMemo(
    () =>
      debounce(() => {
        // This useMemo function recieves an update to the dependency of variantList
        //   after any useEffect does, here we manually avoid running calculations on
        //   an unprocessed variant lists as calculations need frequency data
        if (variantList.status !== "Ready") {
          return;
        }

        const annotation = getCurrentAnnotation();

        // Hacky -- once the variantList updates and triggers a re-run of this function
        //   per a useEffect calling this, the annotations will not have been saved ever
        //   so we mimic the old behavior by setting all variants as selected
        if (annotation.selectedVariants.size === 0) {
          annotation.selectedVariants = new Set([
            ...variantList.variants.map((variant) => variant.id),
            ...(variantList.structural_variants ?? []).map(
              (structural_variant) => structural_variant.id
            ),
          ]);
        }

        const selectedVariants = annotation.selectedVariants
          ? variantList.variants.filter((variant) =>
              annotation.selectedVariants.has(variant.id)
            )
          : variantList.variants;

        const selectedStructuralVariants = variantList.structural_variants
          ? annotation.selectedVariants
            ? variantList.structural_variants.filter((structural_variant) =>
                annotation.selectedVariants.has(structural_variant.id)
              )
            : variantList.structural_variants
          : [];

        const variantCalculations = allVariantListCalculations(
          selectedVariants.concat(selectedStructuralVariants),
          variantList,
          annotation.includeHomozygotesInCalculations
        );
        setAnnotation((annotation) => ({ ...annotation, variantCalculations }));

        patch(`/variant-lists/${variantList.uuid}/shared-annotation/`, {
          selected_variants: Array.from(annotation.selectedVariants),
          variant_calculations: variantCalculations,
          include_homozygotes_in_calculations:
            annotation.includeHomozygotesInCalculations,
        })
          .then(() => {
            toast({
              title: "Saved selected variants",
              status: "success",
              duration: 1_000,
              isClosable: true,
            });
          })
          .catch((error) => {
            toast({
              title: "Unable to save selected variants",
              description: renderErrorDescription(error),
              status: "error",
              duration: 10_000,
              isClosable: true,
            });
          });
      }, 2_000),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [variantList.uuid, variantList.status, variantList.variants]
  );

  const setSelectedVariants = useCallback(
    (selectedVariants: VariantListAnnotation["selectedVariants"]) => {
      setAnnotation((annotation) => ({ ...annotation, selectedVariants }));
      saveSelectedVariants();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [variantList]
  );

  const setIncludeHomozygotesInCalculations = useCallback(
    (includeHomozygotesInCalculations: boolean) => {
      setAnnotation((annotation) => ({
        ...annotation,
        includeHomozygotesInCalculations,
      }));
      saveSelectedVariants();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [variantList]
  );

  const saveVariantNotes = useCallback(
    (variantNotes) => {
      patch(`/variant-lists/${variantList.uuid}/shared-annotation/`, {
        variant_notes: variantNotes,
      })
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
    [variantList.uuid]
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
    variantCalculations: annotation.variantCalculations,
    includeHomozygotesInCalculations:
      annotation.includeHomozygotesInCalculations,
    setIncludeHomozygotesInCalculations,
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
    variantCalculations,
    includeHomozygotesInCalculations,
    setIncludeHomozygotesInCalculations,
  } = useVariantListAnnotation(variantList);

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

      {variantList.status === "Ready" && loadingAnnotation === false && (
        <VariantListCharts
          genetic_ancestry_groups={variantList.metadata!.populations!}
          hasOptionToShowContributionsBySource={shouldCalculateContributionsBySource(
            variantList
          )}
          calculations={variantCalculations}
          includeHomozygotesOptions={
            variantList.variants.some(
              (variant) =>
                variant.flags && variant.flags.includes("has_homozygotes")
            )
              ? {
                  includeHomozygotesInCalculations,
                  setIncludeHomozygotesInCalculations,
                }
              : undefined
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
          selectedVariants={selectedVariants}
          selectionDisabled={loadingAnnotation}
          variantList={variantList}
          variantNotes={variantNotes}
          userCanEdit={userCanEdit}
          userIsStaff={userIsStaff}
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
              gnomadVersion={variantList.metadata.gnomad_version}
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
                  variantList.metadata.gnomad_version,
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
