"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import NProgress from "nprogress"; // / Asegúrate dener esto importado correctamente

export interface InterceptedLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  predicate: () => boolean;
  negativeCallback: () => void;
}

const InterceptedLink = ({
  href,
  children,
  className,
  predicate,
  negativeCallback,
}: InterceptedLinkProps) => {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);
  
  // // Resetear el estado cndo cambia el href
  useEffect(() => {
    setIsNavigating(false);
  }, [href]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    
    // // Si ya estamonavegando, no hacer nada
    if (isNavigating) return;

    if (predicate()) {
      negativeCallback();
    } else {
      // //niciar el loader
      NProgress.start();
      setIsNavigating(true);
      
      // // Navegarnmediatamente sin setTimeout
      router.push(href);
      
      // // Establecern timeout para resetear el estado
      // // perontener el NProgress activo (se completará automáticamente)
      setTimeout(() => {
        setIsNavigating(false);
      }, 100);
    }
  };

  return (
    <button 
      onClick={handleClick} 
      className={className}
      disabled={isNavigating}
    >
      {children}
    </button>
  );
};

export default InterceptedLink;