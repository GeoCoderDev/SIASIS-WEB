import { GradosTextos } from "@/Assets/GradosTextos";
import { NivelEducativoTextos } from "@/Assets/NivelEducativoTextos";
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";
import { NOMBRE_ACTUAL_SISTEMA } from "@/constants/NOMBRE_SISTEMA";
import { NOMBRE_INSTITUCION_PARA_TARJETAS_QR } from "@/constants/NOMBRE_INSITITUCION";
import { EstudianteConAula } from "@/interfaces/shared/Estudiantes";

export const generarTarjetaQREstudiantil = (
  estudiante: EstudianteConAula,
  index: number
): string => {
  const nombreCorto = `${estudiante.Nombres.split(" ")[0]} ${
    estudiante.Apellidos.split(" ")[0]
  } ${estudiante.Apellidos.split(" ")[1]?.at(0) || ""}.`;

  const grado = GradosTextos[estudiante.aula!.Grado].abreviado;
  const nivel = NivelEducativoTextos[estudiante.aula!.Nivel as NivelEducativo];
  const año = new Date().getFullYear();

  return `
    <div class="student-card" style="
      width: 254px;
      height: 387px;
      background: white;
      border-radius: 15px;
      border: 4px solid #dd3625;
      display: flex;
      flex-direction: column;
      font-family: 'B612', Arial, sans-serif;
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      overflow: hidden;
    ">
      <div class="header-card" style="
        width: 100%;
        height: 51px;
        background: #dd3625;
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
        padding: 0 10px;
        flex-shrink: 0;
        box-sizing: border-box;
      ">
        <div style="
          display: flex; 
          flex-direction: column;
          justify-content: center;
          align-items: flex-start;
          height: 100%;
          margin: 0;
          padding: 0;
        ">
          <div style="margin-top: -12px;">
            <span style="
              color: #fff;
              font-family: 'B612', Arial, sans-serif;
              font-size: 11px;
              font-weight: 700;
              margin: 0;
              padding: 0;
              line-height: 12px;
              display: block;
            ">${NOMBRE_ACTUAL_SISTEMA}</span>
            <span style="
              color: #fff;
              font-family: 'B612', Arial, sans-serif;
              font-size: 11px;
              font-weight: 700;
              margin: 0;
              padding: 0;
              line-height: 12px;
              display: block;
            ">${NOMBRE_INSTITUCION_PARA_TARJETAS_QR}</span>
          </div>
        </div>
        
        <div style="
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 4px;
          background: #ffffff;
          border-radius: 50%;
          width: 34px;
          height: 34px;
          flex-shrink: 0;
        ">
          <div style="
            width: 26px;
            aspect-ratio: 1/1;
            border-radius: 50%;
            background: #f0f0f0;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 9px;
            color: #666;
            font-family: 'B612', Arial, sans-serif;
          ">
            <img src="/images/svg/Logo.svg" style="width: 26px; height: 26px; border-radius: 50%;" />
          </div>
        </div>
      </div>
      
      <div class="body-card" style="
        display: flex;
        flex-direction: column;
        padding: 14px 20px 20px 20px;
        align-items: center;
        flex: 1;
        box-sizing: border-box;
        gap: 12px;
        justify-content: space-between;
      ">
        <h1 style="
          color: #000;
          text-align: center;
          font-size: 18px;
          font-style: italic;
          font-weight: 400;
          line-height: 24px;
          margin: 0;
          padding: 0;
          font-family: 'B612', Arial, sans-serif;
        ">${nombreCorto}</h1>
        
        <div style="
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          aspect-ratio: 1/1;
          width: 150px;
          background: #ffffff;
          border-radius: 12px;
          border: 1px solid #e0e0e0;
          box-sizing: border-box;
          margin: 4px 0;
          box-shadow: 0px 0px 5px 4px rgba(0, 0, 0, 0.25);
        ">
          <div id="qr-container-${index}" style="
            width: 150px;
            aspect-ratio: 1/1;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
          "></div>
        </div>
        
        <h2 style="
          color: #000;
          text-align: center;
          font-size: 19px;
          font-weight: 400;
          margin: -10px 0 0 0;
          margin-top: -1.8rem;
          font-family: 'B612', Arial, sans-serif;
        ">${grado} - ${nivel}</h2>
        
        <div style="
          width: 67px;
          height: 22px;
          border-radius: 8px;
          border: 1.5px solid #000;
          background: rgba(255, 255, 255, 0.3);
          color: #000;
          font-family: 'B612', Arial, sans-serif;
          font-size: 12px;
          font-weight: 400;
          box-sizing: border-box;
          position: relative;
        ">
          <span style="margin-top: -1.2rem; position: absolute; top: 13px; left: 15px;">${año}</span>
        </div>
      </div>
    </div>
  `;
};
