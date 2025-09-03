import { useState, useCallback, useEffect } from 'react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from '@/components/ui/carousel';
import { WorkspacePreviewCard } from '@/components/features/workspace/WorkspacePreviewCard';
import { cn } from '@/lib/utils';
import type { WorkspacePreviewData } from '@/components/features/workspace/WorkspacePreviewCard';

interface CarouselLazyProps {
  workspaces: WorkspacePreviewData[];
}

export default function CarouselLazy({ workspaces }: CarouselLazyProps) {
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!carouselApi) return;

    const handleSelect = () => {
      setCurrent(carouselApi.selectedScrollSnap() + 1);
    };

    setCurrent(carouselApi.selectedScrollSnap() + 1);
    carouselApi.on('select', handleSelect);

    return () => {
      carouselApi.off('select', handleSelect);
    };
  }, [carouselApi]);

  const scrollTo = useCallback(
    (index: number) => {
      carouselApi?.scrollTo(index);
    },
    [carouselApi]
  );

  return (
    <div className="relative">
      <Carousel
        setApi={setCarouselApi}
        className="w-full"
        opts={{
          align: 'start',
          loop: false,
        }}
      >
        <CarouselContent>
          {workspaces.map((workspace) => (
            <CarouselItem key={workspace.id}>
              <WorkspacePreviewCard workspace={workspace} />
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="-left-12 hidden sm:flex" />
        <CarouselNext className="-right-12 hidden sm:flex" />
      </Carousel>
      {/* Clickable dots indicator */}
      <div className="flex justify-center mt-4 gap-2">
        {workspaces.map((_, index) => (
          <button
            key={index}
            onClick={() => scrollTo(index)}
            className={cn(
              'h-2 w-2 rounded-full transition-all',
              current === index + 1
                ? 'bg-primary w-6'
                : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
            )}
            aria-label={`Go to workspace ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
