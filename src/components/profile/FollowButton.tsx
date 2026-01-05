import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
} from "react-native";
import { useSelector } from "react-redux";
import { usePostHog } from "../../analytics/PostHogProvider";
import { GlobalStyles } from "../../constants/styles";
import {
  followUser,
  isFollowing,
  unfollowUser,
} from "../../services/followService";
import { selectLocalId } from "../../store/redux/userSlice";

interface FollowButtonProps {
  targetUserId: string;
  onFollowChange?: (isFollowing: boolean) => void;
}

export default function FollowButton({
  targetUserId,
  onFollowChange,
}: FollowButtonProps) {
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const currentUserId = useSelector(selectLocalId);
  const { track } = usePostHog();

  // Don't render if viewing own profile
  if (currentUserId === targetUserId) {
    return null;
  }

  // Check initial follow status
  useEffect(() => {
    async function checkFollowStatus() {
      try {
        const status = await isFollowing(targetUserId);
        setFollowing(status);
      } catch (error) {
        console.error("Error checking follow status:", error);
      } finally {
        setLoading(false);
      }
    }

    if (currentUserId) {
      checkFollowStatus();
    } else {
      setLoading(false);
    }
  }, [targetUserId, currentUserId]);

  const handlePress = async () => {
    if (!currentUserId || updating) return;

    // Optimistic update
    const previousState = following;
    setFollowing(!following);
    setUpdating(true);

    try {
      if (following) {
        await unfollowUser(targetUserId);
        await track("user_unfollowed", {
          unfollowed_user_id: targetUserId,
        });
      } else {
        await followUser(targetUserId);
        await track("user_followed", {
          followed_user_id: targetUserId,
        });
      }
      onFollowChange?.(!previousState);
    } catch (error) {
      // Rollback on error
      setFollowing(previousState);
      console.error("Error updating follow status:", error);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <TouchableOpacity style={[styles.button, styles.loadingButton]} disabled>
        <ActivityIndicator size="small" color="#fff" />
      </TouchableOpacity>
    );
  }

  // Not logged in
  if (!currentUserId) {
    return null;
  }

  return (
    <TouchableOpacity
      style={[
        styles.button,
        following ? styles.followingButton : styles.followButton,
      ]}
      onPress={handlePress}
      disabled={updating}
      activeOpacity={0.7}
    >
      {updating ? (
        <ActivityIndicator size="small" color={following ? "#fff" : "#000"} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            following ? styles.followingText : styles.followText,
          ]}
        >
          {following ? "Following" : "Follow"}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    minWidth: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  followButton: {
    backgroundColor: GlobalStyles.colors.redVivid5,
  },
  followingButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: GlobalStyles.colors.grey5,
  },
  loadingButton: {
    backgroundColor: GlobalStyles.colors.grey7,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  followText: {
    color: "#fff",
  },
  followingText: {
    color: "#fff",
  },
});
