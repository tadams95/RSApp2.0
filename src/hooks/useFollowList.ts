import { useInfiniteQuery } from "@tanstack/react-query";
import { QueryDocumentSnapshot } from "firebase/firestore";
import { queryKeys } from "../config/reactQuery";
import {
  getFollowersWithProfiles,
  getFollowingWithProfiles,
} from "../services/followService";
import { UserSearchResult } from "../services/userSearchService";

const PAGE_SIZE = 20;

export function useFollowList(
  userId: string,
  type: "followers" | "following",
) {
  const fetchFn =
    type === "followers" ? getFollowersWithProfiles : getFollowingWithProfiles;
  const queryKey =
    type === "followers"
      ? queryKeys.follows.followers(userId)
      : queryKeys.follows.following(userId);

  const infiniteQuery = useInfiniteQuery({
    queryKey,
    queryFn: async ({
      pageParam,
    }: {
      pageParam: QueryDocumentSnapshot | undefined;
    }) => {
      return fetchFn(userId, PAGE_SIZE, pageParam);
    },
    initialPageParam: undefined as QueryDocumentSnapshot | undefined,
    getNextPageParam: (lastPage) => lastPage.lastDoc ?? undefined,
    staleTime: 1000 * 60 * 2, // 2 min
    enabled: !!userId,
  });

  const users: UserSearchResult[] =
    infiniteQuery.data?.pages.flatMap((p) => p.users) ?? [];

  return {
    users,
    isLoading: infiniteQuery.isLoading,
    error: infiniteQuery.error,
    fetchNextPage: infiniteQuery.fetchNextPage,
    hasNextPage: infiniteQuery.hasNextPage,
    isFetchingNextPage: infiniteQuery.isFetchingNextPage,
    refetch: infiniteQuery.refetch,
  };
}
