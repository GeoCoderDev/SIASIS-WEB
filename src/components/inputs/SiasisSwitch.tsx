export interface SiasisSwitchProps<T> {
  handleSwitch: () => void;
  values: [T, T];
  texts?: [string, string];
  selectedValue: T;
  className?: string;
}

const SiasisSwitch = <T,>({
  handleSwitch,
  texts,
  selectedValue,
  className,
  values,
}: SiasisSwitchProps<T>) => {
  return (
    <div
      onClick={() => {
        if (texts === undefined) handleSwitch();
      }}
      className={` items-center rounded-[0.6rem] bg-gris-claro select-none p-[3px] ${
        texts ? "flex" : `relative block cursor-pointer rounded-[1000px] px-1.5`
      } ${className}`}
    >
      {texts ? (
        // VERSION CON TEXTO
        <>
          {texts.map((text, index) => {
            return (
              <div
                onClick={() => {
                  if (selectedValue !== values[index]) {
                    handleSwitch();
                  }
                }}
                key={index}
                className={`transition-all py-1 [transition-duration:0.35s] font-normal text-[0.9rem] flex-1 text-center border-2 ${
                  selectedValue === values[index]
                    ? "bg-white rounded-[0.6rem]"
                    : "bg-transparent text-gris-oscuro cursor-pointer"
                }`}
              >
                {text}
              </div>
            );
          })}
        </>
      ) : (
        // VERSION DE CIRCUNFERENCIA DESLIZANTE
        <div
          className={`relative top-1/2 translate-y-[-50%] transition-all [transition-duration:0.15s] [animation-duration:0.15s] fill-mode-forwards aspect-square h-[85%] bg-white rounded-full ${
            selectedValue === values[0]
              ? "[animation-name:slideFromLeft]"
              : "[animation-name:slideFromRight]"
          }`}
        ></div>
      )}
    </div>
  );
};

export default SiasisSwitch;
