/** --- YAML
 * name: ImageComparisonSlider
 * description: Before/After horizontal image comparison slider with drag handle
 * --- */

'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ImageComparisonSliderProps extends React.HTMLAttributes<HTMLDivElement> {
  leftImage: string;
  rightImage: string;
  altLeft?: string;
  altRight?: string;
  initialPosition?: number;
}

export const ImageComparisonSlider = React.forwardRef<
  HTMLDivElement,
  ImageComparisonSliderProps
>(
  (
    {
      className,
      leftImage,
      rightImage,
      altLeft = 'Before',
      altRight = 'After',
      initialPosition = 50,
      ...props
    },
    ref,
  ) => {
    const [sliderPosition, setSliderPosition] = React.useState(initialPosition);
    const [isDragging, setIsDragging] = React.useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);

    const handleMove = (clientX: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      setSliderPosition(Math.max(0, Math.min(100, (x / rect.width) * 100)));
    };

    React.useEffect(() => {
      if (!isDragging) return;

      const onMouseMove = (e: MouseEvent) => handleMove(e.clientX);
      const onTouchMove = (e: TouchEvent) => handleMove(e.touches[0].clientX);
      const onEnd = () => {
        setIsDragging(false);
        document.body.style.cursor = '';
      };

      document.body.style.cursor = 'ew-resize';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('touchmove', onTouchMove);
      document.addEventListener('mouseup', onEnd);
      document.addEventListener('touchend', onEnd);

      return () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('mouseup', onEnd);
        document.removeEventListener('touchend', onEnd);
        document.body.style.cursor = '';
      };
    }, [isDragging]);  

    return (
      <div
        ref={containerRef}
        className={cn('relative w-full h-full overflow-hidden select-none group rounded-xl', className)}
        onMouseDown={() => setIsDragging(true)}
        onTouchStart={() => setIsDragging(true)}
        {...props}
      >
        {/* Right image (After — bottom layer) */}
        <img
          src={rightImage}
          alt={altRight}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          draggable={false}
        />

        {/* Left image (Before — top layer, clipped) */}
        <div
          className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none"
          style={{ clipPath: `polygon(0 0, ${sliderPosition}% 0, ${sliderPosition}% 100%, 0 100%)` }}
        >
          <img
            src={leftImage}
            alt={altLeft}
            className="w-full h-full object-cover"
            draggable={false}
          />
        </div>

        {/* Labels */}
        <span className="absolute top-3 left-3 rounded-full bg-background/70 backdrop-blur-sm px-2 py-0.5 text-[10px] font-medium pointer-events-none">
          {altLeft}
        </span>
        <span className="absolute top-3 right-3 rounded-full bg-background/70 backdrop-blur-sm px-2 py-0.5 text-[10px] font-medium pointer-events-none">
          {altRight}
        </span>

        {/* Divider + handle */}
        <div
          className="absolute top-0 h-full w-1 cursor-ew-resize"
          style={{ left: `calc(${sliderPosition}% - 2px)` }}
        >
          <div className="absolute inset-y-0 w-1 bg-background/50 backdrop-blur-sm" />
          <div
            className={cn(
              'absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-10 w-10 flex items-center justify-center rounded-full bg-background/60 text-foreground shadow-xl backdrop-blur-md',
              'transition-all duration-200',
              'group-hover:scale-105',
              isDragging && 'scale-110 shadow-2xl ring-2 ring-primary/30',
            )}
            role="slider"
            aria-valuenow={sliderPosition}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-orientation="horizontal"
            aria-label="Image comparison slider"
          >
            <ChevronLeft className="h-4 w-4 text-primary" />
            <ChevronRight className="h-4 w-4 text-primary" />
          </div>
        </div>
      </div>
    );
  },
);

ImageComparisonSlider.displayName = 'ImageComparisonSlider';
