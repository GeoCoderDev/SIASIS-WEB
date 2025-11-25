import React, {
  Dispatch,
  InputHTMLAttributes,
  ReactElement,
  SelectHTMLAttributes,
  SetStateAction,
} from "react";
import SiasisSelect from "../inputs/SiasisSelect";
import SiasisInputText from "../inputs/SiasisInputText";

// Clear definition of the properties interface
interface DatoFormularioConEtiquetaProps<R> {
  // Basic properties
  etiqueta: string;
  savedValue?: string | number | null;
  modificatedValue?: string | number | null;
  nombreDato?: keyof R;
  isSomethingLoading: boolean;

  // Behavior properties
  modificable?: boolean;
  modoEdicion?: boolean;
  modificableConModal?: boolean;
  savedValueOculto?: boolean;
  fullWidth?: boolean;

  // Visual properties
  className?: string;
  skeletonClassName?: { className: string };
  IconTSX?: ReactElement;

  // Input type properties
  inputType?: "text" | "select" | "tel";
  selectValues?: Record<string, string>;

  // Control properties
  onChange?: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => void;
  setModalVisibility?: Dispatch<SetStateAction<boolean>>;

  // Native HTML properties
  inputAttributes?: InputHTMLAttributes<HTMLInputElement>;
  selectAttributes?: SelectHTMLAttributes<HTMLSelectElement>;
}

const DatoFormularioConEtiqueta = <R,>({
  // Organized destructuring by categories
  // Basic properties
  etiqueta,
  savedValue,
  modificatedValue,
  nombreDato,
  isSomethingLoading,

  // Behavior properties
  modificable = false,
  modoEdicion = false,
  modificableConModal = false,
  savedValueOculto = false,
  fullWidth = false,

  // Visual properties
  className = "",
  skeletonClassName,
  IconTSX,

  // Input type properties
  inputType = "text",
  selectValues,

  // Control properties
  onChange,
  setModalVisibility,

  // Native HTML properties
  inputAttributes,
  selectAttributes,
}: DatoFormularioConEtiquetaProps<R>) => {
  // Common classes for responsive sizes
  const textoResponsivo =
    "sxs-only:text-[0.77rem] xs-only:text-[0.81rem] sm-only:text-[0.86rem] md-only:text-[0.9rem] lg-only:text-[0.95rem] xl-only:text-[0.99rem]";

  // Classes for "Not registered" text (15% smaller but noticeable)
  const textoNoRegistrado =
    "sxs-only:text-[0.65rem] xs-only:text-[0.69rem] sm-only:text-[0.73rem] md-only:text-[0.77rem] lg-only:text-[0.8rem] xl-only:text-[0.85rem] text-gray-500 italic font-medium";

  // Function to render the modal button (to avoid duplication)
  const renderBotonModal = () => (
    <div
      className="cursor-pointer flex items-center justify-center bg-amarillo-ediciones rounded-[50%] aspect-square 
        sxs-only:w-[1.49rem] xs-only:w-[1.58rem] sm-only:w-[1.68rem] md-only:w-[1.78rem] lg-only:w-[1.88rem] xl-only:w-[1.98rem]
        transition-all hover:bg-yellow-400 ml-1"
      onClick={() => setModalVisibility?.(true)}
    >
      {IconTSX}
    </div>
  );

  // Determine if the edit field should be shown
  const mostrarInputEdicion =
    modificable && modoEdicion && onChange && modificatedValue !== undefined;

  // Determine if the skeleton should be shown
  // We show the skeleton if:
  // 1. It is not savedValueOculto (because in that case we don't want to show anything related to the value)
  // 2. The savedValue is not defined (undefined or null)
  // 3. Something is loading (isSomethingLoading)
  const mostrarSkeleton =
    !savedValueOculto && savedValue === undefined && isSomethingLoading;

  return (
    <label
      className={`flex ${
        savedValueOculto && savedValue !== undefined
          ? "flex-row items-center"
          : "flex-col"
      } gap-[0.2rem] 
        sxs-only:text-[0.68rem] xs-only:text-[0.68rem] sm-only:text-[0.72rem] md-only:text-[0.77rem] lg-only:text-[0.9rem] xl-only:text-[0.86rem]
        font-normal -text-gray-600
        ${fullWidth ? "min-w-full" : ""}`}
    >
      {/* Field label */}
      {etiqueta}:
      {/* Edit button (when the value is hidden but defined) */}
      {savedValueOculto &&
        savedValue !== undefined &&
        modificableConModal &&
        renderBotonModal()}
      {/* Value or input container */}
      <div
        className={`min-h-[1.5rem] 
          sxs-only:min-h-[1.26rem] xs-only:min-h-[1.35rem] sm-only:min-h-[1.44rem] md-only:min-h-[1.53rem] lg-only:min-h-[1.62rem] xl-only:min-h-[1.71rem]
          ${textoResponsivo}
          font-normal text-black
          ${
            mostrarSkeleton ||
            (savedValueOculto && savedValue === undefined && isSomethingLoading)
              ? `skeleton sxs-only:min-w-[4.5rem] xs-only:min-w-[5rem] sm-only:min-w-[5.4rem] md-only:min-w-[5.9rem] lg-only:min-w-[6.3rem] xl-only:min-w-[6.8rem] ${skeletonClassName?.className}`
              : ""
          }`}
      >
        {/* Case 1: Show edit input */}
        {mostrarInputEdicion && (
          <>
            {inputType === "text" ? (
              <SiasisInputText
                inputAttributes={inputAttributes}
                value={modificatedValue ?? ""}
                name={nombreDato as string}
                onChange={onChange}
                className={className ?? textoResponsivo}
                placeholder={`Enter ${etiqueta.toLowerCase()}`}
              />
            ) : inputType === "select" ? (
              <SiasisSelect
                selectAttributes={selectAttributes}
                value={modificatedValue ?? ""}
                name={nombreDato as string}
                onChange={onChange}
                className={className ?? textoResponsivo}
                placeholder={`Select ${etiqueta.toLowerCase()}`}
              >
                <option value="" disabled>
                  Pending selection
                </option>
                {selectValues &&
                  Object.entries(selectValues).map(([value, text]) => (
                    <option key={value} value={value}>
                      {text}
                    </option>
                  ))}
              </SiasisSelect>
            ) : // : inputType === "tel" ? (
            //   <SiasisInputTel
            //     inputAttributes={inputAttributes}
            //     value={modificatedValue ?? ""}
            //     name={nombreDato as string}
            //     onChange={onChange}
            //     className={className ?? textoResponsivo}
            //     placeholder={`Enter ${etiqueta.toLowerCase()}`}
            //   />
            // )

            null}
          </>
        )}

        {/* Case 2: Show "Not registered" when savedValue is null */}
        {!mostrarInputEdicion && savedValue === null && !savedValueOculto && (
          <span
            className={`w-max max-w-full break-words
                ${
                  modificableConModal
                    ? "flex flex-wrap items-center gap-1.5"
                    : ""
                }  
                ${textoNoRegistrado}`}
          >
            Not registered
            {/* Modal edit button */}
            {modificableConModal && renderBotonModal()}
          </span>
        )}

        {/* Case 3: Show saved value (not in edit mode and not hidden) */}
        {!mostrarInputEdicion &&
          savedValue !== undefined &&
          savedValue !== null &&
          !savedValueOculto && (
            <span
              className={`w-max max-w-full break-words font-normal
                ${
                  modificableConModal
                    ? "flex flex-wrap items-center gap-1.5"
                    : ""
                }  
                ${className ?? textoResponsivo}`}
            >
              {/* Show value based on type */}
              {selectValues ? selectValues[savedValue as string] : savedValue}

              {/* Modal edit button */}
              {modificableConModal && renderBotonModal()}
            </span>
          )}
      </div>
    </label>
  );
};

export default DatoFormularioConEtiqueta;