import { RootState } from "@/global/store";
import { use } from "react";
import { useSelector } from "react-redux";

const useFechaReduxActual = () => {
  // ✅ Use useSelector to get date from Redux reactively
  const fechaHoraRedux = useSelector(
    (state: RootState) => state.others.fechaHoraActualReal.fechaHora
  );

  // ✅ Helper function to get Redux date with error handling
  const obtenerFechaRedux = () => {
    if (!fechaHoraRedux) {
      return null;
    }

    try {
      const fechaObj = new Date(fechaHoraRedux);
      if (isNaN(fechaObj.getTime())) {
        console.error("❌ Invalid date from Redux:", fechaHoraRedux);
        return null;
      }

      return {
        fechaActual: fechaObj,
        horaActual: fechaObj.getHours(),
        minutoActual: fechaObj.getMinutes(),
        segundoActual: fechaObj.getSeconds(),
        mesActual: fechaObj.getMonth() + 1,
        diaActual: fechaObj.getDate(),
        añoActual: fechaObj.getFullYear(),
        timestamp: fechaObj.getTime(),
        esHoy: true,
      };
    } catch (error) {
      console.error("❌ Error processing date from Redux:", error);
      return null;
    }
  };

  const fechaRedux = obtenerFechaRedux();
  const horaActual = fechaRedux?.horaActual || new Date().getHours();
  const minutoActual = fechaRedux?.minutoActual || new Date().getMinutes();
  const segundoActual = fechaRedux?.segundoActual || new Date().getSeconds();
  const mesActual = fechaRedux?.mesActual || new Date().getMonth() + 1;
  const diaActual = fechaRedux?.diaActual || new Date().getDate();
  const añoActual = fechaRedux?.añoActual || new Date().getFullYear();
  const timestampActual = fechaRedux?.timestamp || new Date().getTime();

  return {
    horaActual,
    minutoActual,
    segundoActual,
    diaActual,
    mesActual,
    añoActual,
    timestampActual,
  };
};

export default useFechaReduxActual;