import { ActoresSistema } from "@/interfaces/shared/ActoresSistema"
import { RelacionesEstudianteResponsable } from "@/interfaces/shared/RelacionesEstudianteResponsable"


export const StudentGuardianRelationshipTexts : {
    RelativeTo:Record<ActoresSistema.Estudiante| ActoresSistema.Responsable,Record<RelacionesEstudianteResponsable, string>>
} ={
    RelativeTo:{
        [ActoresSistema.Estudiante]:{
            [RelacionesEstudianteResponsable.Padre_de_Familia]: "Son/Daughter",
            [RelacionesEstudianteResponsable.Apoderado]: "In charge"
        },
        [ActoresSistema.Responsable]:{
            [RelacionesEstudianteResponsable.Padre_de_Familia]:"Parent",
            [RelacionesEstudianteResponsable.Apoderado]: "Tutor"
        }
    }
    
}