import { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useTranslation } from "@/hooks/use-translation";
import {
  getComments,
  createComment,
  likeComment,
  deleteComment,
  updateComment,
  flagComment,
  reset,
} from "../features/comments/commentSlice";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Heart, MessageCircle, Flag, MoreHorizontal, Send, Trash2, Edit2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Comment, User } from "@shared/schema-mongo";
import type { RootState, AppDispatch } from "../app/store";

interface CommentsSectionProps {
  projectId: string;
}

export function CommentsSection({ projectId }: CommentsSectionProps) {
  const { t } = useTranslation();
  const { user } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch<AppDispatch>();
  const { toast } = useToast();
  const [newComment, setNewComment] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [flagDialogOpen, setFlagDialogOpen] = useState(false);
  const [flagCommentId, setFlagCommentId] = useState<string | null>(null);
  const [flagReason, setFlagReason] = useState<string>("");
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyingToName, setReplyingToName] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFlagging, setIsFlagging] = useState(false);

  const {
    comments,
    count,
    isLoading,
    isError: error,
  } = useSelector((state: RootState) => state.comment);

  useEffect(() => {
    if (projectId) {
      dispatch(getComments(projectId));
    }

    return () => {
      dispatch(reset());
    };
  }, [projectId, dispatch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await dispatch(
        createComment({ projectId, content: newComment.trim(), parentCommentId: replyingToId }),
      ).unwrap();
      setNewComment("");
      setReplyingToId(null);
      setReplyingToName(null);
      toast({ title: t.comments.commentAdded, description: t.comments.commentAddedDescription });
    } catch (err) {
      const message = err instanceof Error ? err.message : t.comments.failedToPost;
      toast({
        title: t.comments.failedToPost,
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (comment: Comment) => {
    setEditingId(comment.id);
    setEditContent(comment.content);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editContent.trim()) return;
    try {
      await dispatch(updateComment({ commentId: editingId, content: editContent.trim() })).unwrap();
      setEditingId(null);
      setEditContent("");
      toast({ title: t.comments.commentUpdated });
    } catch (_err) {
      toast({
        title: t.comments.failedToUpdate,
        description: t.comments.failedToUpdateDescription,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      await dispatch(deleteComment(commentId)).unwrap();
      toast({ title: t.comments.commentDeleted });
    } catch (_err) {
      toast({
        title: t.comments.failedToDelete,
        description: t.comments.failedToDeleteDescription,
        variant: "destructive",
      });
    }
  };

  const handleFlag = (commentId: string) => {
    setFlagCommentId(commentId);
    setFlagDialogOpen(true);
  };

  const handleReply = (comment: Comment) => {
    setReplyingToId(comment.id);
    setReplyingToName(comment.username);
    // Scroll to form or focus textarea
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelReply = () => {
    setReplyingToId(null);
    setReplyingToName(null);
  };

  const submitFlag = async () => {
    if (!flagCommentId || !flagReason || isFlagging) return;
    setIsFlagging(true);
    try {
      await dispatch(flagComment({ commentId: flagCommentId, reason: flagReason })).unwrap();
      setFlagDialogOpen(false);
      setFlagCommentId(null);
      setFlagReason("");
      toast({
        title: "Comment reported",
        description: "Thank you for helping keep our community safe.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : t.comments.failedToReport;
      toast({
        title: t.comments.failedToReport,
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsFlagging(false);
    }
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Failed to load comments. Please try again later.
      </div>
    );
  }

  // const comments = data?.comments || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-5 w-5" />
        <h3 className="text-lg font-semibold">Comments {count ? `(${count})` : ""}</h3>
      </div>

      {/* New comment form */}
      {user ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          {replyingToId && (
            <div className="flex items-center justify-between bg-muted/50 px-3 py-1.5 rounded-md border text-sm">
              <span className="text-muted-foreground">
                {t.comments.replyingTo.replace("{{name}}", replyingToName || "")}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={handleCancelReply}
              >
                {t.comments.cancelReply}
              </Button>
            </div>
          )}
          <Textarea
            id="comment-input"
            placeholder="Share your thoughts..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="min-h-[80px]"
            maxLength={2000}
          />
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">{newComment.length}/2000</span>
            <Button type="submit" size="sm" disabled={!newComment.trim() || isSubmitting}>
              <Send className="h-4 w-4 mr-2" />
              {isSubmitting
                ? t.comments.posting
                : replyingToId
                  ? t.comments.reply
                  : t.comments.postComment}
            </Button>
          </div>
        </form>
      ) : (
        <Card>
          <CardContent className="py-4 text-center text-muted-foreground">
            <a href="/auth" className="text-primary hover:underline">
              Sign in
            </a>{" "}
            to join the discussion
          </CardContent>
        </Card>
      )}

      {/* Comments list */}
      <div className="space-y-4">
        {comments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No comments yet. Be the first to share your thoughts!
          </div>
        ) : (
          (() => {
            const topLevelComments = comments.filter(
              (c) => !c.parentCommentId && c.status === "active",
            );
            const getReplies = (parentId: string) =>
              comments.filter((c) => c.parentCommentId === parentId && c.status === "active");

            return topLevelComments.map((comment) => (
              <div key={comment.id} className="space-y-3">
                <CommentCard
                  comment={comment}
                  user={user}
                  t={t}
                  editingId={editingId}
                  editContent={editContent}
                  setEditContent={setEditContent}
                  handleEdit={handleEdit}
                  handleSaveEdit={handleSaveEdit}
                  handleDelete={handleDelete}
                  handleFlag={handleFlag}
                  handleReply={handleReply}
                  dispatch={dispatch}
                  likeComment={likeComment}
                  setEditingId={setEditingId}
                  formatDate={formatDate}
                />

                {/* Replies */}
                {getReplies(comment.id).length > 0 && (
                  <div className="ml-8 space-y-3 border-l-2 pl-4">
                    {getReplies(comment.id).map((reply) => (
                      <CommentCard
                        key={reply.id}
                        comment={reply}
                        user={user}
                        t={t}
                        editingId={editingId}
                        editContent={editContent}
                        setEditContent={setEditContent}
                        handleEdit={handleEdit}
                        handleSaveEdit={handleSaveEdit}
                        handleDelete={handleDelete}
                        handleFlag={handleFlag}
                        handleReply={handleReply}
                        dispatch={dispatch}
                        likeComment={likeComment}
                        setEditingId={setEditingId}
                        formatDate={formatDate}
                        isReply
                      />
                    ))}
                  </div>
                )}
              </div>
            ));
          })()
        )}
      </div>

      {/* Flag dialog */}
      <Dialog open={flagDialogOpen} onOpenChange={setFlagDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.comments.reportComment}</DialogTitle>
            <DialogDescription>{t.comments.reportDescription}</DialogDescription>
          </DialogHeader>
          <Select value={flagReason} onValueChange={setFlagReason}>
            <SelectTrigger>
              <SelectValue placeholder={t.comments.selectReason} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="spam">{t.comments.spam}</SelectItem>
              <SelectItem value="harassment">{t.comments.harassment}</SelectItem>
              <SelectItem value="inappropriate">{t.comments.inappropriate}</SelectItem>
              <SelectItem value="misinformation">{t.comments.misinformation}</SelectItem>
              <SelectItem value="other">{t.comments.other}</SelectItem>
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFlagDialogOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button onClick={submitFlag} disabled={!flagReason || isFlagging}>
              {isFlagging ? t.comments.submitting : t.comments.submitReport}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface CommentCardProps {
  comment: Comment;
  user: User | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any;
  editingId: string | null;
  editContent: string;
  setEditContent: (val: string) => void;
  handleEdit: (c: Comment) => void;
  handleSaveEdit: () => void;
  handleDelete: (id: string) => void;
  handleFlag: (id: string) => void;
  handleReply: (c: Comment) => void;
  dispatch: AppDispatch;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  likeComment: any;
  setEditingId: (id: string | null) => void;
  formatDate: (d: Date | string) => string;
  isReply?: boolean;
}

function CommentCard({
  comment,
  user,
  t,
  editingId,
  editContent,
  setEditContent,
  handleEdit,
  handleSaveEdit,
  handleDelete,
  handleFlag,
  handleReply,
  dispatch,
  likeComment,
  setEditingId,
  formatDate,
  isReply = false,
}: CommentCardProps) {
  return (
    <Card className={`relative ${isReply ? "bg-muted/30" : ""}`}>
      <CardContent className="py-4">
        {/* Header */}
        <div className="flex justify-between items-start mb-2">
          <div>
            <span className="font-medium">{comment.username}</span>
            <span className="text-xs text-muted-foreground ml-2">
              {formatDate(comment.createdAt)}
              {comment.updatedAt && " (edited)"}
            </span>
          </div>

          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Comment options"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {(user.id === comment.userId || user.role === "admin") && (
                  <>
                    <DropdownMenuItem onClick={() => handleEdit(comment)}>
                      <Edit2 className="h-4 w-4 mr-2" />
                      {t.common.edit}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDelete(comment.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {t.common.delete}
                    </DropdownMenuItem>
                  </>
                )}
                {user.id !== comment.userId && (
                  <DropdownMenuItem onClick={() => handleFlag(comment.id)}>
                    <Flag className="h-4 w-4 mr-2" />
                    Report
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Content */}
        {editingId === comment.id ? (
          <div className="space-y-2">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="min-h-[60px]"
              maxLength={2000}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveEdit}>
                {t.common.save}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                {t.common.cancel}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-4 mt-3 pt-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={() => user && dispatch(likeComment(comment.id))}
            disabled={!user}
          >
            <Heart
              className={`h-4 w-4 mr-1 ${
                user && comment.likedBy?.includes(user.id) ? "fill-red-500 text-red-500" : ""
              }`}
            />
            {comment.likes || 0}
          </Button>

          {!isReply && user && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              onClick={() => handleReply(comment)}
            >
              <MessageCircle className="h-4 w-4 mr-1" />
              {t.comments.reply}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default CommentsSection;
