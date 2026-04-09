import * as Haptics from "expo-haptics";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useColors } from "@/hooks/useColors";
import { useUser } from "@/context/UserContext";
import { api } from "@/services/api";
import { DigestCard } from "@/components/DigestCard";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";

export default function DigestScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { userId } = useUser();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["digest", userId],
    queryFn: () => api.getDigest(userId!),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });

  const handleRefresh = useCallback(async () => {
    if (!userId) return;
    setRefreshing(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await api.refreshDigest(userId);
      await queryClient.invalidateQueries({ queryKey: ["digest", userId] });
    } catch {
    } finally {
      setRefreshing(false);
    }
  }, [userId, queryClient]);

  const s = makeStyles(colors);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 + 84 : insets.bottom + 84;

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: topPad + 16, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={s.headerLeft}>
          <Text style={[s.greeting, { color: colors.mutedForeground }]}>
            {data?.user?.name ? `Hola, ${data.user.name}` : "Tu digest"}
          </Text>
          <Text style={[s.headerTitle, { color: colors.foreground }]}>3 Minutos</Text>
        </View>
        <TouchableOpacity
          style={[s.refreshBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
          onPress={handleRefresh}
          disabled={refreshing}
          activeOpacity={0.7}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Feather name="refresh-cw" size={18} color={colors.primary} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: botPad }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {isLoading && <LoadingState />}

        {isError && (
          <ErrorState
            message={(error as Error)?.message}
            onRetry={() => refetch()}
          />
        )}

        {!isLoading && !isError && (!data?.digest?.items || data.digest.items.length === 0) && (
          <EmptyState
            icon="book-open"
            title="No hay noticias aún"
            description="Tu digest se está preparando. Vuelve más tarde o actualiza manualmente."
            actionLabel="Actualizar"
            onAction={handleRefresh}
          />
        )}

        {!isLoading && !isError && data?.digest?.items && data.digest.items.length > 0 && (
          <>
            {data.digest.tone ? (
              <View style={[s.toneTag, { backgroundColor: colors.secondary }]}>
                <Feather name="feather" size={12} color={colors.mutedForeground} />
                <Text style={[s.toneTxt, { color: colors.mutedForeground }]}>
                  Tono: {data.digest.tone}
                </Text>
              </View>
            ) : null}
            {data.digest.items.map((item, i) => (
              <DigestCard key={item.articleId ?? i} item={item} index={i} />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    root: { flex: 1 },
    header: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
    },
    headerLeft: { gap: 2 },
    greeting: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
    },
    headerTitle: {
      fontSize: 26,
      fontFamily: "Inter_700Bold",
    },
    refreshBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    scroll: {
      padding: 20,
      gap: 0,
    },
    toneTag: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      alignSelf: "flex-start",
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
      marginBottom: 16,
    },
    toneTxt: {
      fontSize: 12,
      fontFamily: "Inter_500Medium",
      textTransform: "capitalize",
    },
  });
