import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    fallback?: React.ReactNode;
    containerClassName?: string;
}

export function OptimizedImage({
    src,
    alt,
    className,
    containerClassName,
    fallback,
    ...props
}: OptimizedImageProps) {
    const [isLoaded, setIsLoaded] = useState(false);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!src) return;

        setIsLoaded(false);
        setError(false);

        const img = new Image();
        img.src = src;
        img.onload = () => setIsLoaded(true);
        img.onerror = () => setError(true);
    }, [src]);

    if (error || !src) {
        return <>{fallback}</>;
    }

    return (
        <div className={cn("relative overflow-hidden shrink-0", containerClassName)}>
            <AnimatePresence mode="wait">
                {!isLoaded && (
                    <motion.div
                        key="loader"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 flex items-center justify-center bg-muted/20 backdrop-blur-sm"
                    >
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/50" />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* @ts-ignore - conflict between standard img and motion.img props */}
            <motion.img
                src={src}
                alt={alt}
                initial={{ opacity: 0 }}
                animate={{ opacity: isLoaded ? 1 : 0 }}
                transition={{ duration: 0.3 }}
                loading="lazy"
                decoding="async"
                className={cn(
                    "h-full w-full object-cover transition-transform duration-500",
                    !isLoaded && "scale-105 blur-sm",
                    isLoaded && "scale-100 blur-0",
                    className
                )}
                {...props}
            />
        </div>
    );
}
