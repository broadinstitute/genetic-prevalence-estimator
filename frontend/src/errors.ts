import _ from "lodash";

interface ValidationErrors {
  nonFieldErrors: string[];
  fieldErrors: { [field: string]: string[] };
}

export class ApiResponseError extends Error {
  validationErrors: ValidationErrors | null = null;
}

export const renderErrorDescription = (error: Error | ApiResponseError) => {
  const validationErrors = (error as ApiResponseError).validationErrors;
  if (!_.isEmpty(validationErrors?.nonFieldErrors)) {
    return validationErrors!.nonFieldErrors.join(", ");
  }
  if (!_.isEmpty(validationErrors?.fieldErrors)) {
    return "Invalid values for some fields.";
  }

  return error.message;
};
