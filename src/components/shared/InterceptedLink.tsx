"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import NProgress from "nprogress"; // Make sure you have this imported correctly

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
  
  // Reset state when href changes
  useEffect(() => {
    setIsNavigating(false);
  }, [href]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();

    // If we're already navigating, do nothing
    if (isNavigating) return;

    if (predicate()) {
      negativeCallback();
    } else {
      // Start the loader
      NProgress.start();
      setIsNavigating(true);

      // Navigate immediately without setTimeout
      router.push(href);

      // Set a timeout to reset the state
      // but keep NProgress active (it will complete automatically)
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