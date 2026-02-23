"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  images: string[];
  currentIndex: number;
  onNavigate?: (index: number) => void;
}

export function ImageLightbox({
  isOpen,
  onClose,
  images,
  currentIndex,
  onNavigate,
}: ImageLightboxProps) {
  const [isLoading, setIsLoading] = React.useState(true);
  const [prevIndex, setPrevIndex] = React.useState(currentIndex);

  if (currentIndex !== prevIndex) {
    setPrevIndex(currentIndex);
    setIsLoading(true);
  }

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case "ArrowLeft":
          if (currentIndex > 0) onNavigate?.(currentIndex - 1);
          break;
        case "ArrowRight":
          if (currentIndex < images.length - 1) onNavigate?.(currentIndex + 1);
          break;
        case "Escape":
          onClose();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, currentIndex, images.length, onNavigate, onClose]);

  const canGoPrevious = currentIndex > 0;
  const canGoNext = currentIndex < images.length - 1;

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        <Dialog.Content
          className="fixed inset-0 z-50 flex items-center justify-center outline-none cursor-pointer"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <Dialog.Title className="sr-only">Image Lightbox</Dialog.Title>
          <Dialog.Description className="sr-only">
            Viewing attachment {currentIndex + 1} of {images.length}
          </Dialog.Description>

          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 z-50 rounded-full bg-white/20 p-2 text-white hover:bg-white/30 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>

          {canGoPrevious && (
            <button
              type="button"
              onClick={() => onNavigate?.(currentIndex - 1)}
              className="absolute left-4 top-1/2 z-50 -translate-y-1/2 rounded-full bg-white/20 p-3 text-white hover:bg-white/30 transition-colors"
            >
              <ChevronLeft className="h-8 w-8" />
            </button>
          )}

          {canGoNext && (
            <button
              type="button"
              onClick={() => onNavigate?.(currentIndex + 1)}
              className="absolute right-4 top-1/2 z-50 -translate-y-1/2 rounded-full bg-white/20 p-3 text-white hover:bg-white/30 transition-colors"
            >
              <ChevronRight className="h-8 w-8" />
            </button>
          )}

          <div
            role="presentation"
            className="relative max-h-[85vh] max-w-[90vw] cursor-default"
          >
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/30 border-t-white" />
              </div>
            )}

            <img
              src={images[currentIndex]}
              alt={`Attachment ${currentIndex + 1} of ${images.length}`}
              className={cn(
                "max-h-[85vh] max-w-[90vw] object-contain transition-opacity duration-300",
                isLoading ? "opacity-0" : "opacity-100",
              )}
              onLoad={() => setIsLoading(false)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>

          <div className="absolute bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full bg-black/50 px-4 py-2 text-sm text-white">
            {currentIndex + 1} / {images.length}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
