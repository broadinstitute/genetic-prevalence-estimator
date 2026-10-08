import { ChakraProvider } from "@chakra-ui/react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";

import DashboardGeneResources from "./DashboardGeneResources";

const GENE = {
  gene_id: "ENSG000001234",
  gene_symbol: "TEST1",
  inheritance_type: "AR",
  estimated_genetic_prevalence: 0.0001,
  estimated_de_novo_incidence: 0.00002,
  representative_variant_list: {
    uuid: "curated-list",
    label: "Reviewed TEST1 variants",
    total_genetic_prevalence: 0.0002,
    supporting_documents: [
      { title: "Evidence review", url: "https://example.org/review" },
      { title: "Additional evidence", url: "https://example.org/additional" },
    ],
  },
};

const renderResources = (gene = GENE) => {
  return render(
    <ChakraProvider>
      <DashboardGeneResources gene={gene} />
    </ChakraProvider>
  );
};

describe("DashboardGeneResources", () => {
  it("opens labeled row destinations in new tabs without navigating the dashboard", () => {
    renderResources();
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Explore resources for TEST1" })
    );

    const dialog = screen.getByRole("dialog", { name: "TEST1 resources" });
    const links = within(dialog).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/dashboard/ENSG000001234",
      "/dashboard-incidence/ENSG000001234",
      "/variant-lists/curated-list",
      "https://example.org/review",
      "https://example.org/additional",
    ]);
    links.forEach((link) => {
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    });
    expect(within(dialog).getByText("2.000 per 100,000")).toBeTruthy();
    fireEvent.click(links[0]);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("keeps all three entries visible as plain text when unavailable", () => {
    render(
      <ChakraProvider>
        <DashboardGeneResources
          gene={{
            ...GENE,
            inheritance_type: "AD",
            estimated_de_novo_incidence: -1.337,
            representative_variant_list: null,
          }}
        />
      </ChakraProvider>
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Explore resources for TEST1" })
    );
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryAllByRole("link")).toHaveLength(0);
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(3);
    expect(
      within(dialog).getByText("Preliminary genetic prevalence")
    ).toBeTruthy();
    expect(
      within(dialog).getByText("Genetic incidence of de novo variation")
    ).toBeTruthy();
    expect(
      within(dialog).getByText(
        "Representative variant list and curated estimate"
      )
    ).toBeTruthy();
    expect(
      within(dialog).getByText(
        "Not applicable for autosomal dominant inheritance."
      )
    ).toBeTruthy();
    expect(within(dialog).getByText("Estimate unavailable.")).toBeTruthy();
    expect(
      within(dialog).getByText("No curated representative list available.")
    ).toBeTruthy();
  });

  it.each([null, undefined])(
    "shows unavailable text for missing estimates (%s)",
    (estimate) => {
      render(
        <ChakraProvider>
          <DashboardGeneResources
            gene={{
              ...GENE,
              estimated_genetic_prevalence: estimate,
              estimated_de_novo_incidence: estimate,
              representative_variant_list: null,
            }}
          />
        </ChakraProvider>
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Explore resources for TEST1" })
      );
      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getAllByText("Estimate unavailable.")).toHaveLength(
        2
      );
      expect(within(dialog).getAllByRole("listitem")).toHaveLength(3);
      expect(within(dialog).queryAllByRole("link")).toHaveLength(0);
    }
  );

  it("keeps zero-valued estimates linked and omits absent supporting documents", () => {
    renderResources({
      ...GENE,
      estimated_genetic_prevalence: 0,
      estimated_de_novo_incidence: 0,
      representative_variant_list: {
        ...GENE.representative_variant_list,
        supporting_documents: [],
      },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Explore resources for TEST1" })
    );
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getAllByRole("link")).toHaveLength(3);
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(3);
    expect(within(dialog).getByText("0.000 per 100,000")).toBeTruthy();
    expect(within(dialog).queryByText("Estimate unavailable.")).toBeNull();
  });

  it("closes with Escape and restores focus to the gene symbol", async () => {
    renderResources();
    const trigger = screen.getByRole("button", {
      name: "Explore resources for TEST1",
    });
    trigger.focus();
    fireEvent.click(trigger);
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Close" })[0]).toBe(
        document.activeElement
      );
    });
    fireEvent.keyDown(screen.getByRole("dialog"), {
      key: "Escape",
      code: "Escape",
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
