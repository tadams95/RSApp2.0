import { useCallback, useEffect, useRef, useState } from "react";
import {
  Comment,
  CommentInput,
  addComment,
  deleteComment,
  subscribeToComments,
} from "../services/commentService";

interface UseCommentsResult {
  comments: Comment[];
  isLoading: boolean;
  error: Error | null;
  addNewComment: (content: string, parentCommentId?: string) => Promise<void>;
  removeComment: (commentId: string) => Promise<void>;
  isSubmitting: boolean;
}

/**
 * Hook for managing comments on a post with real-time updates
 */
export function useComments(postId: string): UseCommentsResult {
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!postId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const unsubscribe = subscribeToComments(
      postId,
      (newComments) => {
        setComments(newComments);
        setIsLoading(false);
      },
      (err) => {
        setError(err);
        setIsLoading(false);
      }
    );

    unsubscribeRef.current = unsubscribe;

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [postId]);

  const addNewComment = useCallback(
    async (content: string, parentCommentId?: string) => {
      if (!postId || !content.trim()) return;

      setIsSubmitting(true);
      try {
        const input: CommentInput = { content, parentCommentId };
        await addComment(postId, input);
        // Real-time listener will update the comments array
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [postId]
  );

  const removeComment = useCallback(async (commentId: string) => {
    try {
      await deleteComment(commentId);
      // Real-time listener will update the comments array
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  return {
    comments,
    isLoading,
    error,
    addNewComment,
    removeComment,
    isSubmitting,
  };
}
