"use client";
import { useState, useRef, useEffect } from "react";
import ModalContainer, { ModalContainerProps } from "./ModalContainer";
import { RolesSistema } from "@/interfaces/shared/RolesSistema";
import BotonConIcono from "../buttons/BotonConIcono";
import Loader from "../shared/loaders/Loader";
import { SiasisAPIS } from "../../interfaces/shared/SiasisComponents";
import useRequestAPIFeatures from "@/hooks/useRequestSiasisAPIFeatures";
import {
  ApiResponseBase,
  ErrorResponseAPIBase,
} from "@/interfaces/shared/apis/types";
import { CambiarFotoPerfilSuccessResponse } from "@/interfaces/shared/apis/shared/mis-datos/mi-foto-perfil/types";
import {
  ValidationErrorTypes,
  FileErrorTypes,
  RequestErrorTypes,
} from "@/interfaces/shared/errors";
import ErrorMessage from "../shared/errors/ErrorMessage";

interface CambiarFotoModalProps
  extends Pick<ModalContainerProps, "eliminateModal"> {
  initialSource?: string | null;
  updateFoto: (googleDriveFotoId: string) => void;
  Rol: RolesSistema;
  siasisAPI: SiasisAPIS;
  onSuccess?: () => void;
}

const CambiarFotoModal = ({
  eliminateModal,
  initialSource,
  updateFoto,
  Rol,
  onSuccess,
  siasisAPI,
}: CambiarFotoModalProps) => {
  // State for image preview
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    initialSource || "/images/svg/No-Foto-Perfil.svg"
  );

  // State for the selected file
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Reference for the file input
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    error,
    setError,
    fetchSiasisAPI,
    isSomethingLoading: isUploading,
    setIsSomethingLoading: setIsUploading,
  } = useRequestAPIFeatures(siasisAPI);

  // Function to handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);

    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];

      // Check file type
      if (!file.type.includes("image/")) {
        setError({
          message: "The file must be an image",
          success: false,
          errorType: FileErrorTypes.INVALID_FILE_TYPE,
        });
        return;
      }

      // Check file size (5MB maximum)
      if (file.size > 5 * 1024 * 1024) {
        setError({
          message: "The image must not exceed 5MB",
          success: false,
          errorType: FileErrorTypes.FILE_TOO_LARGE,
        });
        return;
      }

      // Create URL for preview
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
      setSelectedFile(file);
    }
  };

  // Function to handle dropped files (drag & drop)
  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setError(null);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];

      // Check file type
      if (!file.type.includes("image/")) {
        setError({
          message: "The file must be an image",
          success: false,
          errorType: FileErrorTypes.INVALID_FILE_TYPE,
        });
        return;
      }

      // Check file size (5MB maximum)
      if (file.size > 5 * 1024 * 1024) {
        setError({
          message: "The image must not exceed 5MB",
          success: false,
          errorType: FileErrorTypes.FILE_TOO_LARGE,
        });
        return;
      }

      // Create URL for preview
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
      setSelectedFile(file);
    }
  };

  // Function to open the file selector
  const handleSelectClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Function to send the photo to the server
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!selectedFile) {
      setError({
        message: "You must select an image first",
        success: false,
        errorType: ValidationErrorTypes.REQUIRED_FIELDS,
      });
      return;
    }

    try {
      setIsUploading(true);
      setError(null);

      // Create FormData directly from the form
      const formData = new FormData(e.currentTarget);

      // Ensure that the selected file is included
      formData.set("foto", selectedFile);

      const fetchCancelable = await fetchSiasisAPI({
        endpoint: "/api/mis-datos/mi-foto-perfil",
        method: "PUT",
        JSONBody: false,
        body: formData,
        queryParams: { Rol },
      });

      if (!fetchCancelable) throw new Error("Request error");

      const res = await fetchCancelable.fetch();

      const responseJson = (await res.json()) as ApiResponseBase;

      if (!responseJson.success) {
        setIsUploading(false);
        return setError(responseJson as ErrorResponseAPIBase);
      }

      const {
        data: { fileId },
      } = responseJson as CambiarFotoPerfilSuccessResponse;
      updateFoto(fileId);

      onSuccess?.();

      // Close the modal
      eliminateModal();
    } catch (err) {
      console.error("Error changing profile photo:", err);
      setError({
        message: "Error processing request",
        success: false,
        errorType: RequestErrorTypes.REQUEST_FAILED,
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (
        previewUrl &&
        previewUrl !== initialSource &&
        previewUrl !== "/images/svg/No-Foto-Perfil.svg"
      ) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl, initialSource]);

  return (
    <ModalContainer
      eliminateModal={() => {
        if (!isUploading) eliminateModal();
      }}
    >
      <div className="flex flex-col items-center w-full max-w-md mx-auto">
        <form
          onSubmit={handleSubmit}
          className="w-full flex flex-col items-center"
          encType="multipart/form-data"
        >
          {/* Image preview */}
          <div className="mb-6 flex flex-wrap gap-6 items-center">
            <p className="mb-3 text-negro">Preview:</p>
            <div className="w-32 h-32 rounded-full overflow-hidden border-2 border-gris-claro bg-white">
              <img
                className="w-full h-full object-cover"
                src={previewUrl || "/images/svg/No-Foto-Perfil.svg"}
                alt="Preview"
              />
            </div>
          </div>

          {/* Drag and drop area */}
          <div
            className="max-w-[20rem] w-full border-2 border-dashed border-violeta-principal rounded-lg px-6 py-2 text-[0.9rem] cursor-pointer 
                      flex flex-col items-center justify-center bg-[#f9f9ff] hover:bg-[#f5f5ff] transition-colors"
            onClick={handleSelectClick}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
          >
            <p className="text-violeta-principal font-normal text-center">
              Drag and drop the photo here or click to select one
            </p>
            <input
              type="file"
              name="foto"
              id="foto"
              className="hidden"
              accept="image/*"
              onChange={handleFileSelect}
              ref={fileInputRef}
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="mt-4 w-full max-w-[20rem]">
              <ErrorMessage error={error} closable={true} />
            </div>
          )}

          {/* Form submission button */}
          <BotonConIcono
            IconTSX={<></>}
            isSomethingLoading={isUploading}
            titleDisabled="The image is uploading"
            LoaderTSX={<Loader className="w-[1.3rem] p-[0.25rem] bg-negro" />}
            texto={isUploading ? "Uploading" : "Change Photo"}
            typeButton="submit"
            className={`w-max gap-3 py-2 px-4 rounded-lg text-negro font-semibold mt-6 ${
              isUploading || !selectedFile
                ? "bg-gris-intermedio text-gris-oscuro cursor-not-allowed"
                : "bg-amarillo-ediciones text-negro hover:grayscale-[0.2] transition-colors"
            }`}
            disabled={isUploading || !selectedFile}
          />
        </form>
      </div>
    </ModalContainer>
  );
};

export default CambiarFotoModal;