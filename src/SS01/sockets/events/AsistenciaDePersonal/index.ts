// // src/socket/events/asistenciaEvents.ts
// / import { Server, Socket } from "socket.io";

// import { SocketUserData } from "../../..nterfaces/UserData";
// / import { Socketndler } from "../../../utils/SocketsUnitario";
// / import { TomaAsisnciaPersonalSS01Events } from "./backend/TomaAsistenciaPersonalSS01Events";

// // /**
* // * Registra los entos relacionados con la asistencia
* // / * @param io Servidor de Socket.IO
* // * @param socket Socket del clnte
* // /
*/
//nst importarEventosSocketTomaAsistenciaPersonal = (
// / io: Server,
// socket: Socket,
/nombreSala: string,
// / emitError: (socket: Socket, code: stng, message: string) => void
// / ) => {
// // Obner información del usuario
// /nst { Nombre_Usuario, Rol } = socket.data.user as SocketUserData;

// // TomaAsisnciaPersonalSS01Events.socketConnection = socket;

// /new TomaAsistenciaPersonalSS01Events.SALUDAME_SOCKET_HANDLER(() => {
// new TomaAsistenciaPersonalSS01Events.RESPUESTA_SALUDO_EMITTER({
// / saludo: `Hola ${Nombre_Usuario}n ROL ${Rol}`,
// / }).execute();
// }).nd();
// / };

// export default importarEntosSocketTomaAsistenciaPersonal;
