import React, { useEffect, useState } from 'react';
import { motion, useSpring, useMotionValue } from 'motion/react';

export default function CursorGlow() {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
      if (!isVisible) setIsVisible(true);
    };

    const handleMouseLeave = () => setIsVisible(false);
    const handleMouseEnter = () => setIsVisible(true);

    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseenter', handleMouseEnter);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseenter', handleMouseEnter);
    };
  }, [mouseX, mouseY, isVisible]);

  return (
    <motion.div
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        x: mouseX,
        y: mouseY,
        translateX: '-50%',
        translateY: '-50%',
        mixBlendMode: 'screen',
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: isVisible ? 1 : 0 }}
      className="pointer-events-none z-[100] hidden lg:block"
    >
      {/* Point Light Core - Smaller size */}
      <div className="w-[150px] h-[150px] bg-luxury-gold/20 rounded-full blur-[40px]" />
      
      {/* Intense Center Beam - Smaller size */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40px] h-[40px] bg-white/10 rounded-full blur-[15px]" />
      
      {/* Static Center Glow (Replaced pulse) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60px] h-[60px] bg-luxury-gold/15 rounded-full blur-[20px]" />
      
      {/* Outer Halo - More subtle */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] bg-luxury-gold/5 rounded-full blur-[50px]" />
    </motion.div>
  );
}
