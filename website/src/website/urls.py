from django.urls import path

from website.views.app_config import get_app_config
from website.views.auth import signin, signout, whoami
from website.views.frontend import FrontendView
from website.views.system_status_views import system_status_view
from website.views.user_views import UsersList, UserDetail
from website.views.variant_list_views import (
    VariantListsView,
    VariantListView,
    VariantListAnnotationView,
    VariantListSharedAnnotationView,
    VariantListProcessView,
    VariantListVariantsView,
    PublicVariantListsView,
    PublicVariantListView,
)
from website.views.dashboard_list_views import (
    DashboardListsView,
    DashboardListView,
    DashboardListsLoadView,
)
from website.views.variant_list_access_views import (
    VariantListAccessList,
    VariantListAccessDetail,
)

from website.views.dominant_dashboard_list_views import (
    DominantDashboardListsLoadView,
    DominantDashboardListView,
)

html = FrontendView.as_view()


ui_views = [
    ("", "home"),
    ("variant-lists/", "variant-lists"),
    ("variant-lists/<uuid:variant_list_id>/", "variant-list"),
    ("variant-lists/new/", "new-variant-list"),
    ("dashboard/", "dashboard"),
    ("dashboard/<str:gene_id>/", "dashboard-list"),
    ("dashboard-incidence/<str:gene_id>/", "dominant-dashboard-list"),
    ("public-lists/", "public-lists"),
    ("status/", "status"),
    ("users/", "users"),
    ("about/", "about"),
    ("faq/", "faq"),
]


urlpatterns = [
    *(path(p, html, name=name) for p, name in ui_views),
    path("api/config/", get_app_config, name="app_config"),
    path("api/auth/signin/", signin, name="signin"),
    path("api/auth/signout/", signout, name="signout"),
    path("api/auth/whoami/", whoami, name="whoami"),
    path("api/status/", system_status_view, name="system_status"),
    path("api/users/", UsersList.as_view(), name="users"),
    path("api/users/<int:id>/", UserDetail.as_view(), name="user"),
    path("api/variant-lists/", VariantListsView.as_view(), name="variant-lists"),
    path(
        "api/variant-lists/<uuid:uuid>/", VariantListView.as_view(), name="variant-list"
    ),
    path(
        "api/variant-lists/<uuid:uuid>/annotation/",
        VariantListAnnotationView.as_view(),
        name="variant-list-annotation",
    ),
    path(
        "api/dashboard-lists/load",
        DashboardListsLoadView.as_view(),
        name="load-dashboard-lists",
    ),
    path(
        "api/dashboard-lists/",
        DashboardListsView.as_view(),
        name="dashboard-lists",
    ),
    path(
        "api/dashboard-lists/<str:gene_id>/",
        DashboardListView.as_view(),
        name="dashboard-list-detail;",
    ),
    path(
        "api/dashboard-incidence/<str:gene_id>/",
        DominantDashboardListView.as_view(),
        name="dominant-list-detail",
    ),
    path(
        "api/dominant-dashboard-lists/load",
        DominantDashboardListsLoadView.as_view(),
        name="load-dominant-dashboard-lists",
    ),
    path(
        "api/variant-lists/<uuid:uuid>/shared-annotation/",
        VariantListSharedAnnotationView.as_view(),
        name="variant-list-shared-annotation",
    ),
    path(
        "api/variant-lists/<uuid:uuid>/process/",
        VariantListProcessView.as_view(),
        name="variant-list-process",
    ),
    path(
        "api/variant-lists/<uuid:uuid>/variants/",
        VariantListVariantsView.as_view(),
        name="variant-list-variants",
    ),
    path(
        "api/variant-list-access/",
        VariantListAccessList.as_view(),
        name="variant-list-access-list",
    ),
    path(
        "api/variant-list-access/<uuid:uuid>/",
        VariantListAccessDetail.as_view(),
        name="variant-list-access-detail",
    ),
    path(
        "api/public-variant-lists/",
        PublicVariantListsView.as_view(),
        name="public-variant-lists",
    ),
    path(
        "api/public-variant-lists/<uuid:uuid>/",
        PublicVariantListView.as_view(),
        name="public-variant-list-detail",
    ),
]


handler400 = "rest_framework.exceptions.bad_request"  # pylint: disable=invalid-name
handler500 = "rest_framework.exceptions.server_error"  # pylint: disable=invalid-name
