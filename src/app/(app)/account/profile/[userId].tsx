import { useLocalSearchParams } from "expo-router";
import React from "react";
import { useSelector } from "react-redux";
import { UserProfileView } from "../../../../components/profile";
import { selectLocalId } from "../../../../store/redux/userSlice";

export default function AccountProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const currentUserId = useSelector(selectLocalId);

  // Determine if viewing own profile
  const isOwnProfile = userId === currentUserId;

  return <UserProfileView userId={userId} isOwnProfile={isOwnProfile} />;
}
