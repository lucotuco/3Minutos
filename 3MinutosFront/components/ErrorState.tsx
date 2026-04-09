import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  const colors = useColors();
  return (
    <View style={styles.container}>
      <Feather name="wifi-off" size={40} color={colors.mutedForeground} />
      <Text style={[styles.title, { color: colors.foreground }]}>
        Algo salió mal
      </Text>
      <Text style={[styles.message, { color: colors.mutedForeground }]}>
        {message ?? "No se pudo conectar con el servidor. Verifica tu conexión."}
      </Text>
      {onRetry && (
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={onRetry}
          activeOpacity={0.8}
        >
          <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>
            Reintentar
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
  },
  message: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  button: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  buttonText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
