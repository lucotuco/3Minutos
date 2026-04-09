import React from "react";
import {
  FlatList,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";

import { useColors } from "@/hooks/useColors";
import { useUser } from "@/context/UserContext";
import { api, ShownArticle } from "@/services/api";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function ArticleRow({ item }: { item: ShownArticle }) {
  const colors = useColors();
  const s = rowStyles(colors);
  return (
    <View style={[s.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={s.topRow}>
        <View style={[s.badge, { backgroundColor: colors.secondary }]}>
          <Text style={[s.badgeTxt, { color: colors.mutedForeground }]}>{item.topic}</Text>
        </View>
        <Text style={[s.date, { color: colors.mutedForeground }]}>
          {formatDate(item.shownAt)}
        </Text>
      </View>
      <Text style={[s.tone, { color: colors.mutedForeground }]}>
        <Feather name="feather" size={11} /> {item.tone}
      </Text>
      {item.articleUrl ? (
        <TouchableOpacity
          onPress={() => {
            if (!item.articleUrl) return;
            Linking.openURL(item.articleUrl);
          }}
          activeOpacity={0.7}
          style={s.link}
        >
          <Feather name="external-link" size={13} color={colors.primary} />
          <Text style={[s.linkTxt, { color: colors.primary }]} numberOfLines={1}>
            {item.articleUrl}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const rowStyles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    row: {
      borderRadius: 12,
      borderWidth: 1,
      padding: 14,
      marginBottom: 12,
      gap: 6,
    },
    topRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    badge: {
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderRadius: 20,
    },
    badgeTxt: {
      fontSize: 11,
      fontFamily: "Inter_600SemiBold",
      textTransform: "capitalize",
    },
    date: {
      fontSize: 11,
      fontFamily: "Inter_400Regular",
    },
    tone: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      textTransform: "capitalize",
    },
    link: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      marginTop: 2,
    },
    linkTxt: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      flex: 1,
    },
  });

export default function HistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { userId } = useUser();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["shown-articles", userId],
    queryFn: () => api.getShownArticles(userId!),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });

  const s = makeStyles(colors);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 + 84 : insets.bottom + 84;

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: topPad + 16, borderBottomColor: colors.border }]}>
        <Text style={[s.title, { color: colors.foreground }]}>Historial</Text>
        {data && data.length > 0 && (
          <Text style={[s.count, { color: colors.mutedForeground }]}>
            {data.length} artículos
          </Text>
        )}
      </View>

      {isLoading && (
        <View style={{ padding: 20 }}>
          <LoadingState />
        </View>
      )}

      {isError && (
        <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />
      )}

      {!isLoading && !isError && (
        <FlatList
          data={data ?? []}
          keyExtractor={(item, i) => item.articleId ?? `${i}`}
          renderItem={({ item }) => <ArticleRow item={item} />}
          contentContainerStyle={[s.list, { paddingBottom: botPad }]}
          scrollEnabled={!!data && data.length > 0}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon="clock"
              title="Sin historial"
              description="Las noticias que leas aparecerán aquí."
            />
          }
        />
      )}
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    root: { flex: 1 },
    header: {
      paddingHorizontal: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
    },
    title: {
      fontSize: 26,
      fontFamily: "Inter_700Bold",
    },
    count: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
    },
    list: {
      padding: 20,
    },
  });
