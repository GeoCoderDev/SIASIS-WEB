import { RootState } from "@/global/store";
import { use } from "react";
import { useSelector } from "react-redux";

const useFechaReduxActual = () => {
  // ✅ Use useSelector to get date from Redux reactively
  const reduxDateTime = useSelector(
    (state: RootState) => state.others.fechaHoraActualReal.dateTime
  );

  // ✅ Helper function to get Redux date with error handling
  const getReduxDate = () => {
    if (!reduxDateTime) {
      return null;
    }

    try {
      const dateObj = new Date(reduxDateTime);
      if (isNaN(dateObj.getTime())) {
        console.error("❌ Invalid date from Redux:", reduxDateTime);
        return null;
      }

      return {
        currentDate: dateObj,
        currentHour: dateObj.getHours(),
        currentMinute: dateObj.getMinutes(),
        currentSecond: dateObj.getSeconds(),
        currentMonth: dateObj.getMonth() + 1,
        currentDay: dateObj.getDate(),
        currentYear: dateObj.getFullYear(),
        timestamp: dateObj.getTime(),
        isToday: true,
      };
    } catch (error) {
      console.error("❌ Error processing date from Redux:", error);
      return null;
    }
  };

  const reduxDate = getReduxDate();
  const currentHour = reduxDate?.currentHour || new Date().getHours();
  const currentMinute = reduxDate?.currentMinute || new Date().getMinutes();
  const currentSecond = reduxDate?.currentSecond || new Date().getSeconds();
  const currentMonth = reduxDate?.currentMonth || new Date().getMonth() + 1;
  const currentDay = reduxDate?.currentDay || new Date().getDate();
  const currentYear = reduxDate?.currentYear || new Date().getFullYear();
  const currentTimestamp = reduxDate?.timestamp || new Date().getTime();

  return {
    currentHour,
    currentMinute,
    currentSecond,
    currentDay,
    currentMonth,
    currentYear,
    currentTimestamp,
  };
};

export default useFechaReduxActual;