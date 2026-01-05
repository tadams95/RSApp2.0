import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { GlobalStyles } from "../../constants/styles";
import { UserData } from "../../utils/auth";

interface ProfileStatsProps {
  profile: UserData | null;
  onFollowersPress?: () => void;
  onFollowingPress?: () => void;
}

interface StatItemProps {
  value: number;
  label: string;
  onPress?: () => void;
}

function StatItem({ value, label, onPress }: StatItemProps) {
  const content = (
    <View style={styles.statItem}>
      <Text style={styles.statValue}>{value.toLocaleString()}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

export default function ProfileStats({
  profile,
  onFollowersPress,
  onFollowingPress,
}: ProfileStatsProps) {
  const stats = profile?.stats || {
    eventsAttended: 0,
    postsCount: 0,
    followersCount: 0,
    followingCount: 0,
  };

  return (
    <View style={styles.container}>
      <StatItem value={stats.postsCount} label="Posts" />
      <View style={styles.divider} />
      <StatItem
        value={stats.followersCount}
        label="Followers"
        onPress={onFollowersPress}
      />
      <View style={styles.divider} />
      <StatItem
        value={stats.followingCount}
        label="Following"
        onPress={onFollowingPress}
      />
      <View style={styles.divider} />
      <StatItem value={stats.eventsAttended} label="Events" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: GlobalStyles.colors.grey8,
    backgroundColor: GlobalStyles.colors.grey9,
  },
  statItem: {
    alignItems: "center",
    paddingHorizontal: 12,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
  },
  statLabel: {
    fontSize: 12,
    color: GlobalStyles.colors.grey4,
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 30,
    backgroundColor: GlobalStyles.colors.grey7,
  },
});
