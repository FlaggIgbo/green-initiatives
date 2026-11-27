import { OptimizedImage } from "@/components/ui/optimized-image";

interface ProjectHeroProps {
  imageUrl?: string;
  title?: string;
}

export function ProjectHero({ imageUrl, title }: ProjectHeroProps) {
  return (
    <OptimizedImage
      src={imageUrl || ""}
      alt={title || "Project Image"}
      priority
      className="h-64 w-full object-cover rounded-lg"
    />
  );
}
