export type AnalyticsPageCategory =
  | "about"
  | "dashboard"
  | "dashboard_gene_detail"
  | "faq"
  | "home"
  | "incidence_gene_detail"
  | "new_variant_list"
  | "not_found"
  | "public_lists"
  | "system_status"
  | "users"
  | "variant_list_detail"
  | "variant_lists";

interface AnalyticsPage {
  category: AnalyticsPageCategory;
  path: string;
}

type GoogleTagArguments = readonly unknown[];

declare global {
  interface Window {
    dataLayer?: GoogleTagArguments[];
  }
}

const GOOGLE_ANALYTICS_MEASUREMENT_ID = "G-07C90N4LCC";
const GOOGLE_ANALYTICS_SCRIPT_ID = "google-analytics-script";

let isAnalyticsInitialized = false;

const googleTag = (...args: GoogleTagArguments) => {
  window.dataLayer?.push(args);
};

export const getAnalyticsPage = (pathname: string): AnalyticsPage => {
  if (pathname === "/") {
    return { category: "home", path: "/" };
  }
  if (/^\/variant-lists\/new\/?$/.test(pathname)) {
    return { category: "new_variant_list", path: "/variant-lists/new/" };
  }
  if (/^\/variant-lists\/[^/]+\/?$/.test(pathname)) {
    return {
      category: "variant_list_detail",
      path: "/variant-lists/detail/",
    };
  }
  if (/^\/variant-lists\/?$/.test(pathname)) {
    return { category: "variant_lists", path: "/variant-lists/" };
  }
  if (/^\/dashboard-incidence\/[^/]+\/?$/.test(pathname)) {
    return {
      category: "incidence_gene_detail",
      path: "/dashboard-incidence/gene/",
    };
  }
  if (/^\/dashboard\/[^/]+\/?$/.test(pathname)) {
    return {
      category: "dashboard_gene_detail",
      path: "/dashboard/gene/",
    };
  }
  if (/^\/dashboard\/?$/.test(pathname)) {
    return { category: "dashboard", path: "/dashboard/" };
  }
  if (/^\/public-lists\/?$/.test(pathname)) {
    return { category: "public_lists", path: "/public-lists/" };
  }
  if (/^\/status\/?$/.test(pathname)) {
    return { category: "system_status", path: "/status/" };
  }
  if (/^\/users\/?$/.test(pathname)) {
    return { category: "users", path: "/users/" };
  }
  if (/^\/about\/?$/.test(pathname)) {
    return { category: "about", path: "/about/" };
  }
  if (/^\/faq\/?$/.test(pathname)) {
    return { category: "faq", path: "/faq/" };
  }

  return { category: "not_found", path: "/not-found/" };
};

export const initializeAnalytics = (): void => {
  if (isAnalyticsInitialized) {
    return;
  }

  window.dataLayer = window.dataLayer ?? [];

  const script = document.createElement("script");
  script.async = true;
  script.id = GOOGLE_ANALYTICS_SCRIPT_ID;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ANALYTICS_MEASUREMENT_ID}`;
  document.head.appendChild(script);

  googleTag("js", new Date());
  googleTag("config", GOOGLE_ANALYTICS_MEASUREMENT_ID, {
    send_page_view: false,
  });
  isAnalyticsInitialized = true;
};

export const trackPageView = (pathname: string): void => {
  if (!isAnalyticsInitialized) {
    return;
  }

  const page = getAnalyticsPage(pathname);
  googleTag("event", "page_view", {
    page_category: page.category,
    page_location: `${window.location.origin}${page.path}`,
    page_path: page.path,
    page_title: document.title,
  });
};
