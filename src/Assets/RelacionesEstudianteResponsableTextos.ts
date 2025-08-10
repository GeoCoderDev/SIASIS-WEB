import { ActoresSistema } from "@/interfaces/shared/ActoresSistema"
import { RelacionesEstudianteResponsable } from "@/interfaces/shared/RelacionesEstudianteResponsable"


export const RelacionesEstudianteResponsableTextos : {
    RespectoA:Record<ActoresSistema.Estudiante| ActoresSistema.Responsable,Record<RelacionesEstudianteResponsable, string>>
} ={
    RespectoA:{
        [ActoresSistema.Estudiante]:{
            [RelacionesEstudianteResponsable.Padre_de_Familia]: "Hijo(a)",
            [RelacionesEstudianteResponsable.Apoderado]: "A cargo"
        },
        [ActoresSistema.Responsable]:{
            [RelacionesEstudianteResponsable.Padre_de_Familia]:"Padre de Familia",
            [RelacionesEstudianteResponsable.Apoderado]: "Tutor(a)"
        }
    }
    
}    
