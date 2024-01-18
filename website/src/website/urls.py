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
from website.views.variant_list_access_views import (
    VariantListAccessList,
    VariantListAccessDetail,
)

html = FrontendView.as_view()


ui_views = [
    ("", "home"),
    ("variant-lists/", "variant-lists"),
    ("variant-lists/<uuid:variant_list_id>/", "variant-list"),
    ("variant-lists/new/", "new-variant-list"),
    ("public-lists/", "public-lists"),
    ("status/", "status"),
    ("users/", "users"),
    ("about/", "about"),
    ("faq/", "faq"),
    ("robots.txt", "robots.txt"),
    ("googleb8fbeda804a3d854.html", "google-auth"),
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
