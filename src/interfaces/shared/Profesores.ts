import {
  ProfesorPrimariaGenerico,
  ProfesorSecundariaGenerico,
} from "./GenericUser";

export interface ProfesorPrimariaGenericoConCelular
  extends ProfesorPrimariaGenerico {
  Celular: string | null;
}

export interface ProfesorSecundariaGenericoConCelular
  extends ProfesorSecundariaGenerico {
  Celular: string | null;
}
