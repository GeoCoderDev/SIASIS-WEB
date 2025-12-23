export const detectarTipoDispositivo = (): "mobile" | "laptop" => {
  const userAgent = navigator.userAgent.toLowerCase();
  const isMobile =
    /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
      userAgent
    );

  // // Tambn verificar por touch screen
  const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;

  // // Verificar tamaño dentalla como indicador adicional
  const isSmallScreen = window.innerWidth <= 768;

  return isMobile || (hasTouch && isSmallScreen) ? "mobile" : "laptop";
};
