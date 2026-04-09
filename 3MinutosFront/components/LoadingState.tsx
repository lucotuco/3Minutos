import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { useColors } from "@/hooks/useColors";

type BarWidth = number | `${number}%`;

function SkeletonBar({ width, height = 14 }: { width: BarWidth; height?: number }) {
  const colors = useColors();
  const anim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  return (
    <Animated.View
      style={[
        styles.bar,
        { width, height, backgroundColor: colors.muted, opacity: anim, borderRadius: 6 },
      ]}
    />
  );
}

function SkeletonCard() {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <SkeletonBar width={80} height={20} />
      <SkeletonBar width="90%" height={18} />
      <SkeletonBar width="70%" height={18} />
      <SkeletonBar width="100%" />
      <SkeletonBar width="100%" />
      <SkeletonBar width="80%" />
    </View>
  );
}

export function LoadingState() {
  return (
    <View style={styles.container}>
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    gap: 12,
  },
  bar: {},
});
