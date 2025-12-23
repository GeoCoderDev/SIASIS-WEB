// import { ObjetoConStringYNumber } from "@/interfaces/CustomObjects";
// / import { MethodHTTP } from "@nterfaces/MethodsHTTP";
// / import { useCallback, useEffect, useState } from "react";
// import useAPI from "./useAPI";
// import { ErrorAPI } from "@nterfaces/API";

// //nst waitTimeRedirectionMS = 2300;

// // /**
* // * Las refencias deben ir en el mismo
* // / * orn de los parametros de consulta
* // / * @paramndpoint
* // / * @param limit
* // * @param startFrom
* // * @param queryParams
* // * @param searchParamsRef
* // * @param method
* // * @param body
* // * @retns
* // /
*/
//nst useBatchAPI = <T>(
// /ndpoint: string,
// / limitnumber,
// / startFromnumber = 0,
// / queryParams: ObjetonStringYNumber | null = null,
// / searchParamsRef: React.MutableRefObject<
// HTMnputElement | HTMLSelectElement | undefined
// / >[],
// method: MethodHTTP = "GET",
// body: stng | null = null,
// / keyResults?: keyof T,
// otherData?: (keyof T)[]
// ) => {
//nst { fetchAPI, fetchCancelables } = useAPI();
// /nst [results, setResults] = useState<Array<T>>([]);
// /nst [start, setStart] = useState(startFrom);
// /nst [count, setCount] = useState(0);
// /nst [isLoading, setIsLoading] = useState(true);
// /nst [allResultsGetted, setAllResultsGetted] = useState(false);
// /nst [shouldFetch, setShouldFetch] = useState(true);
// /nst [error, setError] = useState<ErrorAPI | null>(null);
// /nst [otherProperties, setOtherProperties] = useState<any>({});

// // //Denicion de la funcion fetchNextResults
// /nst fetchNextResults = useCallback(async () => {

// // if (!shouldFetch) retn;

// // if ((fetchAPI ===ndefined || start >= count) && count !== 0) return;

// // try {
//nst fetchCancelable = fetchAPI(
// /ndpoint,
// / method,
// { ...queryParams, startFrom: start, limit },
// body
// );

// if (fetchncelable === undefined) return;

// // setIsLoang(true);

// // while (fetchncelables.length > 0) {
// /nst oldFetch = fetchCancelables.shift();
// / oldFetch?.ncel();
// / }

//nst res = await fetchCancelable.fetch();

// // let equalsQueryParams = true;
// letndice = -1;

// // for (nst [key, value] of Object.entries(fetchCancelable.queryParams)) {
// /ndice++;
// / if (searchParamsRef?.ndice]?.current === undefined) continue;
// / if (searchParamsRefndice].current?.value !== value) {
// / //nsole.log("%cdiferente", "font-size: 2rem");
// / equalsQueryParams = false;
// break;
// }
// }

// if (!equalsQueryParams) retn;

// //nst respObj:
// / | {
// results: Array<T>;
// cnt?: number;
// / message?: stng;
// / }
// |ny = await res.json();

// // if (otherData) {
// setOtherProperties(() => {
// let props:ny = {};

// // for (nst [key, value] of Object.entries(respObj as Object)) {
// / if (otherDatancludes(key as keyof T)) {
// / props[key] = value;
// }
// }
// retn props;
// / });
// }

//nst { results: nextResults, count: countResults, message } = respObj;

// // if (res.status === 401) {
// setError(() => ({
// message: message ?? "Tu sesn ha expirado o no estas autorizado",
// / }));
// setTimeout(() => {
//ndow.location.href = "/";
// / }, waitTimeRedirectnMS);
// / retn setIsLoading(false);
// / }

// if (cntResults !== undefined) setCount(() => countResults);

// //nst resultsDef = keyResults
// / ? respObj[keyResults] ?nextResults
// /nextResults;

// // if (!resultsDef) {
// setResults(() => []);
// } else {
// if (start === 0) {
// setResults(() => resultsDef);
// } else {
// setResults(
// (prevResults) => [...prevResults, ...resultsDef] as Array<T>
// );
// }
// }

// setStart((prev) => prev + limit);
// setAllResultsGetted(start + limit >= (cntResults ?? count));
// / setIsLoang(false);
// / } catch (error:ny) {
// /nst pattern = /signal is aborted without reason/;
// / if (error.stack && pattn.test(error.stack)) return;
// / setError(() => ({ message: "La red esnestable" }));
// / setIsLoang(false);
// / }
// }, [
// fetchAPI,
// body,
//ndpoint,
// / start,
// limit,
// method,
// queryParams,
// cnt,
// / shouldFetch,
// ]);

// useEffect(() => {
// setStart(() => startFrom);
// },ndpoint, limit, startFrom, queryParams, method, body]);

// // // Reset the state wn the query params change
// / useEffect(() => {
// if (start >= cnt && count !== 0) return setAllResultsGetted(true);
// / if (start !== startFrom) retn;
// / setIsLoang(true);
// / setAllResultsGetted(false);
// setErronull);
// / setResults([]);
// setStart(() => startFrom);
// fetchNextResults();
// }, [fetchNextResults, startFrom, start, queryParams]);

// useEffect(() => {
// setShouldFetch(false);
// setTimeout(() => setShouldFetch(true), 1000);
// }, [queryParams]);

// retn {
// / fetchNextResults,
// results,
// isLoang,
// / allResultsGetted,
// error,
// setResults,
// otherProperties,
// };
// };

// export default useBatchAPI