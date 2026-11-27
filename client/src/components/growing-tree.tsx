import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { waterTree } from "../features/auth/authSlice";
import { User } from "@shared/schema-mongo";
import { useToast } from "@/hooks/use-toast";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { AppDispatch } from "../app/store";

// Tree stages based on growth level (0-100)
const TREE_STAGES = [
  { threshold: 20, emoji: "🌱" },
  { threshold: 40, emoji: "🌿" },
  { threshold: 60, emoji: "🌳" },
  { threshold: 80, emoji: "🌲" },
  { threshold: 101, emoji: "🌸" },
];

interface GrowingTreeProps {
  user: User;
  isCompact?: boolean;
}

export function GrowingTree({ user, isCompact }: GrowingTreeProps) {
  const [treeEmoji, setTreeEmoji] = useState(TREE_STAGES[0].emoji);
  const { toast } = useToast();
  const { t } = useTranslation();
  const dispatch = useDispatch<AppDispatch>();

  const [isWatering, setIsWatering] = useState(false);

  useEffect(() => {
    const growth = user.treeGrowth || 0;
    const stage =
      TREE_STAGES.find((s) => growth < s.threshold) || TREE_STAGES[TREE_STAGES.length - 1];
    setTreeEmoji(stage.emoji);
  }, [user.treeGrowth]);

  // Don't show the tree for entity users
  if (user.role === "entity") {
    return null;
  }

  const handleWaterTree = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    try {
      setIsWatering(true);
      await dispatch(waterTree()).unwrap();
      toast({
        title: t.growingTree.treeWatered,
        description: t.growingTree.treeWateredDescription,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to water tree";
      toast({
        title: t.growingTree.unableToWater,
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsWatering(false);
    }
  };

  if (isCompact) {
    return (
      <div className="flex items-center gap-2 sm:gap-3 bg-primary/10 rounded-full px-2 sm:px-3 py-1 sm:py-1.5 backdrop-blur-sm border border-primary/20 max-w-[180px] sm:max-w-none">
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex justify-between items-center text-[8px] sm:text-[10px] font-bold uppercase tracking-wider text-primary/70 truncate">
            <span className="truncate">{t.growingTree.growthProgress}</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 mt-0.5">
            <div className="h-1 sm:h-1.5 bg-primary/20 rounded-full overflow-hidden flex-1">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${user.treeGrowth}%` }}
              />
            </div>
            <span className="text-[8px] sm:text-[10px] font-bold text-primary leading-none">
              {user.treeGrowth}%
            </span>
          </div>
        </div>
        <div className="h-6 sm:h-8 w-px bg-primary/20 mx-0.5 sm:mx-1" />
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <div className="text-right hidden xs:block">
            <p className="text-[8px] sm:text-[10px] font-bold uppercase tracking-wider text-primary/70 leading-none">
              Coins
            </p>
            <p className="text-xs sm:text-sm font-bold text-primary">{user.sunwaterCoins}</p>
          </div>
          <button
            className="h-6 w-6 sm:h-8 sm:w-8 flex items-center justify-center bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-[10px] sm:text-xs"
            onClick={handleWaterTree}
            // TODO: Decide if we should disable this button depending on how many sunwater coins the user has.
            disabled={isWatering || (user.sunwaterCoins || 0) < 10}
            title={
              (user.sunwaterCoins || 0) < 10
                ? interpolate(t.growingTree.needCoinsTooltip, { coins: user.sunwaterCoins || 0 })
                : t.growingTree.waterTooltip
            }
          >
            {isWatering ? "..." : "💧"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="text-8xl absolute -top-24 right-4 opacity-30">{treeEmoji}</div>
      <div className="bg-primary/5 rounded-lg p-4 backdrop-blur-sm border border-primary/10">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">{t.growingTree.growthProgress}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 bg-primary/20 rounded-full overflow-hidden flex-1">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${user.treeGrowth}%` }}
              />
            </div>
            <span className="text-sm font-bold text-primary">{user.treeGrowth}%</span>
          </div>
        </div>
        <div className="mt-4 flex justify-between items-center">
          <div>
            <p className="text-sm font-medium">{t.growingTree.sunwaterCoins}</p>
            <p className="text-2xl font-bold">{user.sunwaterCoins}</p>
          </div>
          <button
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleWaterTree}
            disabled={isWatering || (user.sunwaterCoins || 0) < 10}
            title={
              (user.sunwaterCoins || 0) < 10
                ? interpolate(t.growingTree.needCoinsTooltip, { coins: user.sunwaterCoins || 0 })
                : t.growingTree.waterTooltip
            }
          >
            {isWatering ? t.growingTree.watering : t.growingTree.waterTree}
          </button>
        </div>
      </div>
    </div>
  );
}
