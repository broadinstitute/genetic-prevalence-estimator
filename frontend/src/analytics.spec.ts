import {
  getAnalyticsPage,
  initializeAnalytics,
  trackPageView,
} from "./analytics";

describe("getAnalyticsPage", () => {
  it.each([
    ["/", "home", "/"],
    ["/dashboard/", "dashboard", "/dashboard/"],
    ["/dashboard/ENSG000001234/", "dashboard_gene_detail", "/dashboard/gene/"],
    [
      "/dashboard-incidence/ENSG000001234/",
      "incidence_gene_detail",
      "/dashboard-incidence/gene/",
    ],
    ["/variant-lists/", "variant_lists", "/variant-lists/"],
    [
      "/variant-lists/956d7047-7d64-4e9f-8263-4b4db90c5abd/",
      "variant_list_detail",
      "/variant-lists/detail/",
    ],
    ["/variant-lists/new/", "new_variant_list", "/variant-lists/new/"],
    ["/faq/", "faq", "/faq/"],
    ["/missing/", "not_found", "/not-found/"],
  ])("normalizes %s", (pathname, category, normalizedPath) => {
    expect(getAnalyticsPage(pathname)).toEqual({
      category,
      path: normalizedPath,
    });
  });
});

describe("analytics tracking", () => {
  it("loads Google Analytics and sends normalized page views", () => {
    initializeAnalytics();
    trackPageView("/variant-lists/956d7047-7d64-4e9f-8263-4b4db90c5abd/");

    const script = document.querySelector<HTMLScriptElement>(
      "#google-analytics-script"
    );
    expect(script?.src).toBe(
      "https://www.googletagmanager.com/gtag/js?id=G-07C90N4LCC"
    );
    expect(window.dataLayer?.[1]).toEqual([
      "config",
      "G-07C90N4LCC",
      { send_page_view: false },
    ]);
    expect(window.dataLayer?.[2]).toEqual([
      "event",
      "page_view",
      expect.objectContaining({
        page_category: "variant_list_detail",
        page_location: "http://localhost/variant-lists/detail/",
        page_path: "/variant-lists/detail/",
      }),
    ]);
  });
});
