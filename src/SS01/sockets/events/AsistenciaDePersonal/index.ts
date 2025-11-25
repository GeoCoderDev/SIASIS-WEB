// // src/socket/events/attendanceEvents.ts
// import { Server, Socket } from "socket.io";

// import { SocketUserData } from "../../../interfaces/UserData";
// import { SocketHandler } from "../../../utils/SocketsUnitario";
// import { TomaAsistenciaPersonalSS01Events } from "./backend/TomaAsistenciaPersonalSS01Events";

// /**
//  * Registers attendance-related events
//  * @param io Socket.IO Server
//  * @param socket Client socket
//  */
// const importarEventosSocketTomaAsistenciaPersonal = (
//   io: Server,
//   socket: Socket,
//   nombreSala: string,
//   emitError: (socket: Socket, code: string, message: string) => void
// ) => {
//   // Get user information
//   const { Nombre_Usuario, Rol } = socket.data.user as SocketUserData;

//   TomaAsistenciaPersonalSS01Events.socketConnection = socket;

//   new TomaAsistenciaPersonalSS01Events.SALUDAME_SOCKET_HANDLER(() => {
//     new TomaAsistenciaPersonalSS01Events.RESPUESTA_SALUDO_EMITTER({
//       saludo: `Hello ${Nombre_Usuario} with ROLE ${Rol}`,
//     }).execute();
//   }).hand();
// };
