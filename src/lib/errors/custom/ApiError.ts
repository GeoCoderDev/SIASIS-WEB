interface CustomApiErrorPayload {
  statusCode: number;
  statusText: string;
  metodoHttp: string;
  ruta: string;
}

export class CustomApiError extends Error {
  public name: string = "CustomApiError";
  constructor(message: string, public payload: CustomApiErrorPayload) {
    super(message);
  }
}
