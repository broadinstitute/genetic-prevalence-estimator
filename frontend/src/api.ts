import qs from "qs";

import { ApiResponseError } from "./errors";

const getCookie = (name: string): string | null => {
  if (!document.cookie || document.cookie === "") {
    return null;
  }

  const cookies = document.cookie.split(";");
  for (let i = 0; i < cookies.length; i += 1) {
    const cookie = cookies[i].trim();
    if (cookie.startsWith(`${name}=`)) {
      const cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
      return cookieValue;
    }
  }

  return null;
};

const request = (path: string, options: RequestInit): Promise<any> => {
  return fetch(`/api${path}`, options).then((response) => {
    const isOk = response.ok;

    if (options.method === "POST" && response.status === 201) {
      const location = response.headers.get("Location");
      if (location) {
        return get(location.replace(/^\/api/, ""));
      }
    }

    // Handle no content
    if (response.status === 204) {
      return;
    }

    return response.json().then(
      (data) => {
        if (isOk) {
          return data;
        }

        let error;

        // Get error details from serializer response.
        if (
          response.status === 400 &&
          (options.method === "POST" || options.method === "PATCH")
        ) {
          error = new ApiResponseError("Bad request");
          if (Array.isArray(data)) {
            error.validationErrors = {
              nonFieldErrors: data,
              fieldErrors: {},
            };
          } else {
            const { non_field_errors: nonFieldErrors, ...fieldErrors } = data;
            error.validationErrors = {
              nonFieldErrors: nonFieldErrors || [],
              fieldErrors: fieldErrors || {},
            };
          }
        } else {
          error = new ApiResponseError(data.detail || "Unknown error");
        }

        throw error;
      },
      () => {
        throw new Error("Unable to parse response");
      }
    );
  });
};

export const get = (
  path: string,
  params: { [key: string]: any } = {}
): Promise<any> => {
  const query = qs.stringify(params);
  const requestPath = query ? `${path}?${query}` : path;
  return request(requestPath, {});
};

export const patch = (path: string, data: any): Promise<any> => {
  const headers: { [key: string]: string } = {
    "Content-Type": "application/json",
  };
  const csrfToken = getCookie("csrftoken");
  if (csrfToken) {
    headers["X-CSRFToken"] = csrfToken;
  }
  return request(path, {
    body: JSON.stringify(data),
    headers,
    method: "PATCH",
  });
};

export const post = (path: string, data: any): Promise<any> => {
  const headers: { [key: string]: string } = {
    "Content-Type": "application/json",
  };
  const csrfToken = getCookie("csrftoken");
  if (csrfToken) {
    headers["X-CSRFToken"] = csrfToken;
  }

  return request(path, {
    body: JSON.stringify(data),
    headers,
    method: "POST",
  });
};

export const postFile = (path: string, formData: FormData): Promise<any> => {
  const headers: { [key: string]: string } = {};
  const csrfToken = getCookie("csrftoken");
  if (csrfToken) {
    headers["X-CSRFToken"] = csrfToken;
  }

  return request(path, {
    body: formData,
    headers,
    method: "POST",
  });
};

export const del = (path: string): Promise<any> => {
  const headers: { [key: string]: string } = {};
  const csrfToken = getCookie("csrftoken");
  if (csrfToken) {
    headers["X-CSRFToken"] = csrfToken;
  }
  return request(path, {
    headers,
    method: "DELETE",
  });
};
