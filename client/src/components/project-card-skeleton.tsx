import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ProjectCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <Skeleton className="h-48 w-full" />
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1 mr-4">
            <Skeleton className="h-6 w-3/4" />
            <div className="flex items-center mt-1">
              <Skeleton className="h-4 w-4 mr-1" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-6 w-16" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </CardContent>
      <CardFooter className="flex flex-col space-y-4">
        <Skeleton className="h-4 w-full" />
        <div className="flex justify-between w-full">
          <Skeleton className="h-3 w-1/4" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </CardFooter>
    </Card>
  );
}
