import { RolesTextos } from "@/Assets/RolesTextos";
import { useDelegacionEventos } from "@/hooks/useDelegacionDeEventos";
import useRequestAPIFeatures from "@/hooks/useRequestSiasisAPIFeatures";
import { GenericUser } from "@/interfaces/shared/GenericUser";
import { Genero } from "@/interfaces/shared/Genero";
import { RolesSistema } from "@/interfaces/shared/RolesSistema";
import { SiasisAPIS } from "@/interfaces/shared/SiasisComponents";
import {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Loader from "../shared/loaders/Loader";
import { Search, Users, AlertCircle, ChevronDown, Clock } from "lucide-react";
import FotoPerfilClientSide from "../utils/photos/FotoPerfilClientSide";
import { UsuariosGenericosIDB } from "@/lib/utils/local/db/models/UsuariosGenericosIDB";
import { extraerTipoDeIdentificador } from "@/lib/helpers/extractors/extraerTipoDeIdentificador";
import { TiposIdentificadoresTextos } from "@/interfaces/shared/TiposIdentificadores";

interface SiasisUserSelectorProps {
  rolUsuariosABuscar?: RolesSistema;
  siasisAPI: SiasisAPIS;
  setUsuarioSeleccionado: Dispatch<SetStateAction<GenericUser | undefined>>;
  usuarioSeleccionado: GenericUser | undefined;
  ID_SELECTOR_USUARIO_GENERICO_HTML: string;
  disabled?: boolean;
}

const UsuarioGenericoEncontrado = ({
  usuarioGenerico,
  handleUsuarioSeleccionado,
}: {
  usuarioGenerico: GenericUser;
  handleUsuarioSeleccionado: (usuarioSeleccionado: GenericUser) => void;
}) => {

  const TipoIdentificacion = TiposIdentificadoresTextos[extraerTipoDeIdentificador(usuarioGenerico.Identificador_Nacional_Directivo??usuarioGenerico.ID_Usuario)];

  return (
    <li
      className="px-3 py-2.5 text-sm text-gray-700 select-none cursor-pointer transition-all duration-200 
                 hover:bg-blue-50 hover:text-blue-700 hover:border-l-4 hover:border-blue-500
                 border-b border-gray-100 last:border-b-0 group"
      onClick={() => {
        handleUsuarioSeleccionado(usuarioGenerico);
      }}
    >
      <div className="flex items-center space-x-2.5">
        <FotoPerfilClientSide
          Google_Drive_Foto_ID={usuarioGenerico.Google_Drive_Foto_ID}
          className="w-8 h-8 shadow-none"
        />

        <div className="flex-1 min-w-0">
          <div className="flex flex-col">
            <span className="font-medium text-gray-900 group-hover:text-blue-700 truncate text-sm">
              {usuarioGenerico.Nombres} {usuarioGenerico.Apellidos}
            </span>
            <span className="text-xs text-gray-500 group-hover:text-blue-500">
              {TipoIdentificacion}:{" "}
              {usuarioGenerico.Identificador_Nacional_Directivo ?? usuarioGenerico.ID_Usuario}
            </span>
          </div>
        </div>

        {/* Icono de selección */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
            <svg
              className="w-3 h-3 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>
      </div>
    </li>
  );
};

const LIMITE_USUARIOS_GENERICOS_A_TRAER = 5;
// Controla si se muestra feedback visual al usuario mientras escribe (iconos, mensajes, etc.)
const FEEDBACK_ESCRITURA = true;

const SiasisUserSelector = ({
  rolUsuariosABuscar,
  siasisAPI,
  ID_SELECTOR_USUARIO_GENERICO_HTML,
  setUsuarioSeleccionado,
  usuarioSeleccionado,
  disabled = false,
}: SiasisUserSelectorProps) => {
  const {
    error,
    isSomethingLoading,
    setError,
    cancelAllRequests,
    setIsSomethingLoading,
    setSuccessMessage,
  } = useRequestAPIFeatures(siasisAPI);

  const [usuariosGenericosObtenidos, setUsuariosGenericosObtenidos] = useState<
    GenericUser[]
  >([]);
  const [estaDesplegado, setEstaDesplegado] = useState(false);
  const [criterioDeBusqueda, setCriterioDeBusqueda] = useState<string>("");
  const [isTyping, setIsTyping] = useState(false);

  const { delegarEvento } = useDelegacionEventos();

  // Ref para el timeout del debounce
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const DEBOUNCE_DELAY = 500; // 500ms de delay

  // Instancia del modelo (se crea una sola vez)
  const [usuariosGenericosIDB] = useState(
    () =>
      new UsuariosGenericosIDB(
        siasisAPI,
        setIsSomethingLoading,
        setError,
        setSuccessMessage
      )
  );

  // Función segura para establecer usuarios obtenidos
  const setUsuariosSeguro = useCallback(
    (usuarios: GenericUser[] | undefined | null) => {
      setUsuariosGenericosObtenidos(Array.isArray(usuarios) ? usuarios : []);
    },
    []
  );

  // Función de búsqueda usando IndexedDB (equivalente al fetchUsuariosGenericos original)
  const buscarUsuariosGenericos = useCallback(async () => {
    try {
      if (
        criterioDeBusqueda.trim().length > 0 &&
        criterioDeBusqueda.trim().length < 2
      ) {
        setError({
          success: false,
          message: "El criterio de búsqueda debe tener al menos 2 caracteres",
        });
        setUsuariosSeguro([]);
        return;
      }

      const { resultados } = await usuariosGenericosIDB.buscarUsuarios(
        rolUsuariosABuscar!,
        criterioDeBusqueda.trim() || "",
        LIMITE_USUARIOS_GENERICOS_A_TRAER
      );

      setUsuariosSeguro(resultados);
    } catch (e) {
      setUsuariosSeguro([]);
      if (e instanceof Error) {
        setError({
          success: false,
          message: e.message,
        });
      } else {
        setError({
          success: false,
          message: "Error inesperado al buscar usuarios",
        });
      }
    }
  }, [
    criterioDeBusqueda,
    rolUsuariosABuscar,
    usuariosGenericosIDB,
    setError,
    setUsuariosSeguro,
  ]);

  useEffect(() => {
    if (!delegarEvento) return;

    delegarEvento(
      "mousedown",
      `#${ID_SELECTOR_USUARIO_GENERICO_HTML}, #${ID_SELECTOR_USUARIO_GENERICO_HTML} *, #${ID_SELECTOR_USUARIO_GENERICO_HTML}-buscador, #${ID_SELECTOR_USUARIO_GENERICO_HTML}-buscador *, #${ID_SELECTOR_USUARIO_GENERICO_HTML}-users-founded-list, #${ID_SELECTOR_USUARIO_GENERICO_HTML}-users-founded-list *`,
      () => {
        setEstaDesplegado(false);
      },
      true
    );
  }, [delegarEvento, ID_SELECTOR_USUARIO_GENERICO_HTML]);

  // Determinar si el componente está deshabilitado
  const estaDeshabilitado = disabled || !rolUsuariosABuscar;

  // DEBOUNCE LOGIC + BÚSQUEDA INICIAL: Buscar después de que el usuario deje de escribir
  // También busca los primeros 5 usuarios automáticamente al abrir el dropdown
  useEffect(() => {
    // Limpiar timeout anterior
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Si no está desplegado o está deshabilitado, limpiar y salir
    if (!estaDesplegado || estaDeshabilitado) {
      cancelAllRequests();
      setUsuariosSeguro([]);
      setIsTyping(false);
      return;
    }

    // Si el criterio está vacío, ejecutar búsqueda inicial inmediatamente
    // (muestra los primeros 5 usuarios sin filtros)
    if (criterioDeBusqueda.trim() === "") {
      setIsTyping(false);
      setError(null);
      buscarUsuariosGenericos();
      return;
    }

    // Si hay criterio de búsqueda, aplicar debounce
    if (FEEDBACK_ESCRITURA) {
      setIsTyping(true);
    }
    setError(null);

    // Configurar timeout para buscar después del delay
    debounceTimeoutRef.current = setTimeout(() => {
      if (FEEDBACK_ESCRITURA) {
        setIsTyping(false);
      }
      buscarUsuariosGenericos();
    }, DEBOUNCE_DELAY);

    // Cleanup function
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [
    rolUsuariosABuscar,
    criterioDeBusqueda,
    estaDesplegado,
    estaDeshabilitado,
  ]);

  // Cleanup al desmontar el componente
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  const handleUsuarioSeleccionado = useCallback(
    (usuarioSeleccionado: GenericUser) => {
      setUsuarioSeleccionado(usuarioSeleccionado);
      setEstaDesplegado(false);
      setCriterioDeBusqueda("");
    },
    [setUsuarioSeleccionado]
  );

  const DENOMINACION_USUARIOS = rolUsuariosABuscar
    ? RolesTextos[rolUsuariosABuscar]["desktop"][Genero.Masculino]
    : "Usuario";

  return (
    <div className="w-full">
      <label className="block text-xs font-semibold text-gray-700 mb-1">
        Seleccionar {DENOMINACION_USUARIOS}
      </label>

      <div className="relative w-full">
        {/* Selector principal */}
        <div
          className={`w-full px-3 py-2.5 border-2 rounded-lg cursor-pointer transition-all duration-200
                      bg-white min-h-[3rem] flex items-center justify-between shadow-sm
                      ${
                        estaDeshabilitado
                          ? "border-gray-200 bg-gray-50 cursor-not-allowed opacity-60"
                          : estaDesplegado
                          ? "border-blue-500 ring-2 ring-blue-100 shadow-md"
                          : "border-gray-200 hover:border-blue-300 hover:shadow-md"
                      }`}
          id={ID_SELECTOR_USUARIO_GENERICO_HTML}
          onClick={() => {
            if (!estaDeshabilitado) {
              setEstaDesplegado((state) => !state);
            }
          }}
        >
          <div className="flex-1 min-w-0">
            {!rolUsuariosABuscar ? (
              // Estado: No hay rol seleccionado
              <div className="flex items-center space-x-2.5">
                <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <div className="min-w-0">
                  <span className="text-sm font-medium text-amber-600 block truncate">
                    Selecciona un rol primero
                  </span>
                  <p className="text-xs text-amber-500 truncate">
                    Debes elegir un rol antes de seleccionar un usuario
                  </p>
                </div>
              </div>
            ) : usuarioSeleccionado ? (
              // Estado: Usuario seleccionado
              <div className="flex items-center space-x-2.5">
                <FotoPerfilClientSide
                  Google_Drive_Foto_ID={
                    usuarioSeleccionado.Google_Drive_Foto_ID
                  }
                  className="border-1 border-[rgba(0,0,0,0.2)] w-9 shadow-none flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-gray-900 block truncate">
                    {usuarioSeleccionado.Nombres}{" "}
                    {usuarioSeleccionado.Apellidos}
                  </span>
                  <span className="text-xs text-gray-500 block truncate">
                    {TiposIdentificadoresTextos[extraerTipoDeIdentificador(usuarioSeleccionado.ID_Usuario) ]}:{" "}
                    {usuarioSeleccionado.Identificador_Nacional_Directivo ??
                      usuarioSeleccionado.ID_Usuario}
                  </span>
                </div>
              </div>
            ) : (
              // Estado: Rol seleccionado pero sin usuario
              <div className="flex items-center space-x-2.5">
                <Users className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div className="min-w-0">
                  <span className="text-sm font-medium text-gray-600 block truncate">
                    Seleccionar {DENOMINACION_USUARIOS}
                  </span>
                  <p className="text-xs text-gray-400 truncate">
                    Busca y selecciona un usuario
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Icono de flecha */}
          <div className="flex-shrink-0 ml-2">
            <ChevronDown
              className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                estaDesplegado ? "rotate-180" : ""
              }`}
            />
          </div>
        </div>

        {/* Dropdown */}
        {estaDesplegado && rolUsuariosABuscar && (
          <div
            id={`${ID_SELECTOR_USUARIO_GENERICO_HTML}-dropdown`}
            className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl 
                       max-h-80 overflow-hidden"
          >
            {/* Buscador mejorado */}
            <div
              id={`${ID_SELECTOR_USUARIO_GENERICO_HTML}-buscador`}
              className="p-3 border-b border-gray-100 bg-gray-200  rounded-t-lg"
            >
              <div className="relative">
                {FEEDBACK_ESCRITURA && isTyping ? (
                  <Clock className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-blue-500" />
                ) : isSomethingLoading ? (
                  <div className="absolute left-2.5 top-1/2 transform -translate-y-1/2">
                    <Loader className="w-4 h-4 text-blue-500" />
                  </div>
                ) : (
                  <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                )}
                <input
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gris-oscuro rounded-md 
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                           placeholder-gray-400 transition-all duration-200 bg-white"
                  type="search"
                  placeholder={`Buscar ${DENOMINACION_USUARIOS.toLowerCase()}...`}
                  value={criterioDeBusqueda}
                  onChange={(e) => {
                    setCriterioDeBusqueda(e.target.value);
                  }}
                />
              </div>

              {FEEDBACK_ESCRITURA && isTyping && (
                <div className="mt-1 text-xs text-blue-600 flex items-center">
                  <Clock className="w-3 h-3 mr-1" />
                  Escribiendo...
                </div>
              )}
            </div>

            {/* Resultados */}
            <div
              id={`${ID_SELECTOR_USUARIO_GENERICO_HTML}-users-founded-list`}
              className="overflow-y-auto max-h-64"
            >
              {FEEDBACK_ESCRITURA && isTyping ? (
                // Estado: Usuario escribiendo (solo si FEEDBACK_ESCRITURA está activo)
                <div className="flex items-center justify-center py-6">
                  <Clock className="w-5 h-5 mr-2 text-blue-500" />
                  <span className="text-blue-600 text-sm">
                    Esperando que termines de escribir...
                  </span>
                </div>
              ) : !isSomethingLoading ? (
                <>
                  {(usuariosGenericosObtenidos?.length ?? 0) > 0 ? (
                    <ul>
                      {(usuariosGenericosObtenidos || []).map(
                        (usuarioGenerico) => (
                          <UsuarioGenericoEncontrado
                            handleUsuarioSeleccionado={
                              handleUsuarioSeleccionado
                            }
                            key={usuarioGenerico.ID_Usuario}
                            usuarioGenerico={usuarioGenerico}
                          />
                        )
                      )}
                    </ul>
                  ) : (
                    <div className="px-3 py-6 text-center">
                      <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm font-medium">
                        No se encontraron usuarios
                      </p>
                      <p className="text-gray-400 text-xs mt-1">
                        Intenta con otro criterio de búsqueda
                      </p>
                    </div>
                  )}

                  {/* Mensaje informativo */}
                  {!error && (usuariosGenericosObtenidos?.length ?? 0) > 0 && (
                    <div className="px-3 py-2 text-center bg-blue-50 border-t border-blue-100">
                      <p className="text-blue-600 text-xs">
                        💡 Si no encuentras al{" "}
                        {DENOMINACION_USUARIOS.toLowerCase()}, especifica más tu
                        búsqueda
                      </p>
                    </div>
                  )}

                  {/* Error */}
                  {error && (
                    <div className="px-3 py-3 text-center bg-red-50 border-t border-red-100">
                      <AlertCircle className="w-4 h-4 text-red-500 mx-auto mb-1" />
                      <p className="text-red-600 text-sm font-medium">
                        {error.message}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                // Estado: API cargando
                <div className="flex items-center justify-center py-6">
                  <Loader className="w-5 h-5 mr-2" />
                  <span className="text-gray-500 text-sm">
                    Buscando usuarios...
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SiasisUserSelector;
