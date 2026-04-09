import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";

import { DigestItem } from "@/services/api";
import { useColors } from "@/hooks/useColors";

interface DigestCardProps {
  item: DigestItem;
  index: number;
}

export function DigestCard({ item, index }: DigestCardProps) {
  const colors = useColors();

  const openUrl = async () => {
    if (!item.url) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(item.url);
  };

  const topicColors = [
    { bg: "#E8F4FD", text: "#1a6fa8" },
    { bg: "#FDF0E8", text: "#a8521a" },
    { bg: "#EDF8F0", text: "#1a8a3a" },
  ];
  const topicColor = topicColors[index % topicColors.length];

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.topRow}>
        <View style={[styles.topicBadge, { backgroundColor: topicColor.bg }]}>
          <Text style={[styles.topicText, { color: topicColor.text }]}>
            {item.topic}
          </Text>
        </View>
        <View style={styles.metaRight}>
          {item.region ? (
            <Text style={[styles.metaSmall, { color: colors.mutedForeground }]}>
              {item.region}
            </Text>
          ) : null}
          {item.section ? (
            <Text style={[styles.metaSmall, { color: colors.mutedForeground }]}>
              {" · "}{item.section}
            </Text>
          ) : null}
        </View>
      </View>

      <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={3}>
        {item.title}
      </Text>

      <Text style={[styles.summary, { color: colors.mutedForeground }]}>
        {item.summary}
      </Text>

      {item.url ? (
        <TouchableOpacity
          style={[styles.linkButton, { borderColor: colors.primary }]}
          onPress={openUrl}
          activeOpacity={0.7}
        >
          <Feather name="external-link" size={14} color={colors.primary} />
          <Text style={[styles.linkText, { color: colors.primary }]}>
            Leer artículo original
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
    gap: 12,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topicBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  topicText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "capitalize",
  },
  metaRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  metaSmall: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    lineHeight: 26,
  },
  summary: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
  },
  linkButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginTop: 4,
  },
  linkText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
});
