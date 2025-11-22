/* eslint-disable @typescript-eslint/no-explicit-any */
import { Entornos_BasePaths_SS01 } from "@/Assets/ss01/Entornos";
import { ENTORNO } from "@/constants/ENTORNO";
import {
  setGlobalSocket,
  clearGlobalSocket,
  setConnectionStatus,
  setConnectionError,
} from "@/global/state/others/globalSocket";
import { AppDispatch, RootState } from "@/global/store";
import userStorage from "@/lib/utils/local/db/models/UserStorage";
import { TomaAsistenciaPersonalSIU01Events } from "@/SS01/sockets/events/AsistenciaDePersonal/frontend/TomaAsistenciaPersonalSIU01Events";
import { useEffect, useState, useCallback, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import io, { Socket } from "socket.io-client";

export const useSS01 = () => {
  const [token, setToken] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isReallyConnected, setIsReallyConnected] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const socketRef = useRef<typeof Socket | null>(null);
  const connectionAttemptRef = useRef<boolean>(false);

  const globalSocket = useSelector(
    (state: RootState) => state.others.globalSocket.socket
  );

  const isConnected = useSelector(
    (state: RootState) => state.others.globalSocket.isConnected
  );

  const dispatch = useDispatch<AppDispatch>();

  // Get token on initialization
  const getToken = useCallback(async () => {
    try {
      const currentToken = await userStorage.getAuthToken();
      setToken(currentToken);
    } catch (error) {
      console.error("Error getting token:", error);
      setToken(null);
    }
  }, []);

  useEffect(() => {
    if (!isInitialized) {
      getToken();
      setIsInitialized(true);
    }
  }, [getToken, isInitialized]);

  // Create Socket.IO connection
  const createSocketConnection = useCallback(() => {
    if (!token || connectionAttemptRef.current || globalSocket) {
      return;
    }

    connectionAttemptRef.current = true;
    console.log("🚀 [useSS01] Creating Socket.IO connection");

    try {
      const socketConnection = io(process.env.NEXT_PUBLIC_SS01_URL_BASE!, {
        path: Entornos_BasePaths_SS01[ENTORNO],
        auth: { token },
        transports: ["websocket", "polling"],
        autoConnect: true,
        forceNew: true,
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      // Configure event listeners
      socketConnection.on("connect", () => {
        console.log("✅ [useSS01] Connected to SS01 server");

        setTimeout(() => {
          if (socketConnection.connected) {
            setIsReallyConnected(true);
            dispatch(setConnectionStatus({ value: true }));
            // Automatically assign to events class
            TomaAsistenciaPersonalSIU01Events.socketConnection =
              socketConnection;
            setIsReady(true);
          }
        }, 200);
      });

      socketConnection.on("disconnect", (reason: any) => {
        console.log("❌ [useSS01] Disconnected:", reason);
        setIsReallyConnected(false);
        setIsReady(false);
        dispatch(setConnectionStatus({ value: false }));
        TomaAsistenciaPersonalSIU01Events.socketConnection = null;
      });

      socketConnection.on("connect_error", (error: any) => {
        console.error("💥 [useSS01] Connection error:", error);
        setIsReallyConnected(false);
        setIsReady(false);
        dispatch(setConnectionError({ value: error.message }));
        connectionAttemptRef.current = false;
        TomaAsistenciaPersonalSIU01Events.socketConnection = null;
      });

      socketConnection.on("reconnect", (attemptNumber: any) => {
        console.log("🔄 [useSS01] Reconnected. Attempt:", attemptNumber);

        setTimeout(() => {
          if (socketConnection.connected) {
            setIsReallyConnected(true);
            setIsReady(true);
            dispatch(setConnectionStatus({ value: true }));
            dispatch(setConnectionError({ value: null }));
            TomaAsistenciaPersonalSIU01Events.socketConnection =
              socketConnection;
          }
        }, 200);
      });

      socketRef.current = socketConnection;
      dispatch(setGlobalSocket({ value: socketConnection }));
    } catch (error) {
      console.error("❌ [useSS01] Error creating connection:", error);
      connectionAttemptRef.current = false;
      setIsReallyConnected(false);
      setIsReady(false);
    }
  }, [token, globalSocket, dispatch]);

  // Cleanup connection
  const cleanupConnection = useCallback(() => {
    if (socketRef.current) {
      console.log("🧹 [useSS01] Cleaning up connection");
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setIsReallyConnected(false);
    setIsReady(false);
    dispatch(clearGlobalSocket());
    connectionAttemptRef.current = false;
    TomaAsistenciaPersonalSIU01Events.socketConnection = null;
  }, [dispatch]);

  // Create connection when we have token
  useEffect(() => {
    if (token && !globalSocket && !connectionAttemptRef.current) {
      createSocketConnection();
    }
  }, [token, globalSocket, createSocketConnection]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupConnection();
    };
  }, [cleanupConnection]);

  // Simplified debug
  const getDebugInfo = useCallback(() => {
    const status = TomaAsistenciaPersonalSIU01Events.getConnectionStatus();

    return {
      // Hook states
      hookIsConnected: isConnected,
      hookIsReallyConnected: isReallyConnected,
      hookIsReady: isReady,

      // Global socket states
      globalSocketExists: !!globalSocket,
      globalSocketConnected: globalSocket?.connected,
      globalSocketId: globalSocket?.id,

      // Events class states
      classSocketExists: !!TomaAsistenciaPersonalSIU01Events.socketConnection,
      classSocketConnected:
        TomaAsistenciaPersonalSIU01Events.socketConnection?.connected,

      // Class status
      classStatus: status,
    };
  }, [globalSocket, isConnected, isReallyConnected, isReady]);

  // Helper functions
  const disconnect = useCallback(() => {
    cleanupConnection();
  }, [cleanupConnection]);

  const reconnect = useCallback(() => {
    cleanupConnection();
    setTimeout(() => {
      createSocketConnection();
    }, 100);
  }, [cleanupConnection, createSocketConnection]);

  return {
    // Main states
    globalSocket,
    isConnected,
    isReallyConnected,
    isReady,

    // Utilities
    getDebugInfo,
    disconnect,
    reconnect,

    // For backwards compatibility
    token: !!token,
  };
};
