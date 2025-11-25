"use client";
import { useState } from "react";
import ModalContainer, { ModalContainerProps } from "./ModalContainer";
import BotonConIcono from "../buttons/BotonConIcono";
import Loader from "../shared/loaders/Loader";
import { SiasisAPIS } from "@/interfaces/shared/SiasisComponents";
import useRequestAPIFeatures from "@/hooks/useRequestSiasisAPIFeatures";
import {
  ApiResponseBase,
  ErrorResponseAPIBase,
} from "@/interfaces/shared/apis/types";
import {
  ValidationErrorTypes,
  RequestErrorTypes,
} from "@/interfaces/shared/errors";
import ErrorMessage from "../shared/errors/ErrorMessage";
import { RolesSistema } from "@/interfaces/shared/RolesSistema";
import PasswordInput from "../inputs/PasswordInput";

interface CambioContrasenaModalProps
  extends Pick<ModalContainerProps, "eliminateModal"> {
  siasisAPI: SiasisAPIS;
  onSuccess?: () => void;
  Rol: RolesSistema;
}

const CambioContrasenaModal = ({
  eliminateModal,
  onSuccess,
  siasisAPI,
  Rol,
}: CambioContrasenaModalProps) => {
  // States for password fields
  const [contraseñaActual, setContraseñaActual] = useState<string>("");
  const [nuevaContraseña, setNuevaContraseña] = useState<string>("");

  // State to validate fields
  const [isValid, setIsValid] = useState<boolean>(false);

  // API request hooks
  const {
    error,
    setError,
    fetchSiasisAPI,
    isSomethingLoading,
    setIsSomethingLoading,
  } = useRequestAPIFeatures(siasisAPI);

  // Password validation
  const validateForm = (actual: string, nueva: string) => {
    // Clear previous errors
    setError(null);

    // Check that they are not empty
    if (!actual || !nueva) {
      return false;
    }

    // Check that the new password has at least 6 characters
    if (nueva.length < 6) {
      return false;
    }

    // Check that they are different
    if (actual === nueva) {
      setError({
        message: "The new password cannot be the same as the current one",
        success: false,
        errorType: ValidationErrorTypes.INVALID_FORMAT,
      });
      return false;
    }

    return true;
  };

  // Handle changes in the current password field
  const handleContraseñaActualChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.value;
    setContraseñaActual(value);
    setIsValid(validateForm(value, nuevaContraseña));
  };

  // Handle changes in the new password field
  const handleNuevaContraseñaChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.value;
    setNuevaContraseña(value);
    setIsValid(validateForm(contraseñaActual, value));
  };

  // Function to send the password change request
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!isValid) {
      setError({
        message: "Please complete all fields correctly",
        success: false,
        errorType: ValidationErrorTypes.REQUIRED_FIELDS,
      });
      return;
    }

    try {
      setIsSomethingLoading(true);
      setError(null);

      const fetchCancelable = await fetchSiasisAPI({
        endpoint: "/api/mis-datos/mi-contrasena",
        method: "PUT",
        JSONBody: true,
        body: JSON.stringify({ contraseñaActual, nuevaContraseña }),
        queryParams: { Rol },
      });

      if (!fetchCancelable) throw new Error("Request error");

      const res = await fetchCancelable.fetch();
      const responseJson = (await res.json()) as ApiResponseBase;

      if (!responseJson.success) {
        setIsSomethingLoading(false);
        return setError(responseJson as ErrorResponseAPIBase);
      }

      // Call success callback if it exists
      onSuccess?.();

      // Close the modal
      eliminateModal();
    } catch (err) {
      console.error("Error changing password:", err);
      setError({
        message: "Error processing request",
        success: false,
        errorType: RequestErrorTypes.REQUEST_FAILED,
      });
    } finally {
      setIsSomethingLoading(false);
    }
  };

  // Function to prevent modal closing during operation
  const handleClose = () => {
    if (isSomethingLoading) {
      return; // Do nothing if loading
    }
    eliminateModal();
  };

  return (
    <ModalContainer eliminateModal={handleClose}>
      <div className="flex flex-col items-center w-full max-w-md mx-auto transition-all duration-300 ease-in-out gap-2 px-2">
        {/* Lock image */}
        <img
          src="/images/svg/Candado.svg"
          alt="Lock"
          className="w-[8rem] aspect-square mb-4 sxs-only:w-16 xs-only:w-20 sm:w-24 md:w-28"
        />

        <form
          onSubmit={handleSubmit}
          className="w-full flex flex-col items-center"
        >
          <div className="w-full space-y-3">
            {/* Current password */}
            <PasswordInput
              id="contraseñaActual"
              value={contraseñaActual}
              onChange={handleContraseñaActualChange}
              label="Current Password:"
              required
              maxLength={20}
              inputClassName="w-full sm:w-[105%]"
            />

            {/* New password */}
            <PasswordInput
              id="nuevaContraseña"
              value={nuevaContraseña}
              onChange={handleNuevaContraseñaChange}
              label="New Password"
              required
              minLength={6}
              maxLength={20}
              helperText="The password must be at least 8 characters long"
              inputClassName="w-full sm:w-[105%]"
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="max-w-[18rem] mt-3">
              <ErrorMessage
                className=""
                error={error}
                setError={setError}
                closable={true}
              />
            </div>
          )}

          {/* Submit button */}
          <BotonConIcono
            IconTSX={<></>}
            isSomethingLoading={isSomethingLoading}
            titleDisabled={`${
              isSomethingLoading
                ? "Processing Request..."
                : !isValid
                ? "Please complete the fields correctly"
                : "Cannot use button now"
            }`}
            LoaderTSX={<Loader className="w-[1.3rem] p-[0.25rem] bg-negro" />}
            texto={isSomethingLoading ? "Changing..." : "Change Password"}
            typeButton="submit"
            className={`w-max font-semibold px-6 gap-3 py-2 mt-4 rounded-md text-center text-base ${
              isSomethingLoading || !isValid
                ? "bg-gris-intermedio text-gris-oscuro cursor-not-allowed"
                : "bg-amarillo-ediciones text-negro hover:grayscale-[0.2] transition-colors"
            }`}
            disabled={isSomethingLoading || !isValid}
          />
        </form>
      </div>
    </ModalContainer>
  );
};

export default CambioContrasenaModal;