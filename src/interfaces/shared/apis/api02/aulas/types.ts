import { T_Aulas } from "@prisma/client";
import {  SuccessResponseAPIBase } from "../../types";



export interface GetAulasSuccessResponse extends SuccessResponseAPIBase{
    data: T_Aulas[]
}

