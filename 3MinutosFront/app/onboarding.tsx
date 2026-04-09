import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";
import { api } from "@/services/api";
import { useUser } from "@/context/UserContext";

const TONES = [
  { value: "neutro" as const, label: "Neutro", desc: "Objetivo e informativo" },
  { value: "cercano" as const, label: "Cercano", desc: "Amigable y conversacional" },
  { value: "especialista" as const, label: "Especialista", desc: "Técnico y detallado" },
  { value: "breve" as const, label: "Breve", desc: "Conciso y directo" },
];

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const h = i.toString().padStart(2, "0");
  return `${h}:00`;
});

export default function OnboardingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { setUserId } = useUser();

  const [name, setName] = useState("");
  const [topics, setTopics] = useState<[string, string, string]>(["", "", ""]);
  const [tone, setTone] = useState<"neutro" | "cercano" | "especialista" | "breve">("neutro");
  const [deliveryTime, setDeliveryTime] = useState("08:00");
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"info" | "tone" | "schedule">("info");

  const updateTopic = (index: number, value: string) => {
    const next: [string, string, string] = [...topics] as [string, string, string];
    next[index] = value;
    setTopics(next);
  };

  const validate = () => {
    if (!name.trim()) return "Ingresa tu nombre";
    if (topics.some((t) => !t.trim())) return "Completa los 3 tópicos";
    return null;
  };

  const handleSubmit = async () => {
    const error = validate();
    if (error) {
      Alert.alert("Datos incompletos", error);
      return;
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    try {
      const result = await api.createPreferences({
        name: name.trim(),
        topics: [topics[0].trim(), topics[1].trim(), topics[2].trim()],
        tone,
        deliveryTime,
        isActive,
      });
      await setUserId(result.id);
      router.replace("/(tabs)");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      Alert.alert("Error al guardar", msg);
    } finally {
      setLoading(false);
    }
  };

  const s = makeStyles(colors);

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          s.scroll,
          { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={s.header}>
          <View style={[s.logoCircle, { backgroundColor: colors.primary }]}>
            <Feather name="clock" size={28} color="#fff" />
          </View>
          <Text style={[s.appName, { color: colors.foreground }]}>3 Minutos</Text>
          <Text style={[s.subtitle, { color: colors.mutedForeground }]}>
            Tu digest de noticias personalizado
          </Text>
        </View>

        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: colors.foreground }]}>Tu perfil</Text>

          <Text style={[s.label, { color: colors.mutedForeground }]}>Nombre</Text>
          <TextInput
            style={[s.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            placeholder="¿Cómo te llamamos?"
            placeholderTextColor={colors.mutedForeground}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />

          <Text style={[s.label, { color: colors.mutedForeground }]}>
            Tus 3 tópicos de interés
          </Text>
          <Text style={[s.hint, { color: colors.mutedForeground }]}>
            Ej: tecnología, economía, ciencia, cultura, deportes...
          </Text>
          {([0, 1, 2] as const).map((i) => (
            <TextInput
              key={i}
              style={[s.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              placeholder={`Tópico ${i + 1}`}
              placeholderTextColor={colors.mutedForeground}
              value={topics[i]}
              onChangeText={(v) => updateTopic(i, v)}
              autoCapitalize="none"
            />
          ))}
        </View>

        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: colors.foreground }]}>Tono de lectura</Text>
          <View style={s.toneGrid}>
            {TONES.map((t) => {
              const selected = tone === t.value;
              return (
                <TouchableOpacity
                  key={t.value}
                  style={[
                    s.toneCard,
                    {
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected ? colors.primary + "15" : colors.card,
                    },
                  ]}
                  onPress={() => setTone(t.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.toneLabel, { color: selected ? colors.primary : colors.foreground }]}>
                    {t.label}
                  </Text>
                  <Text style={[s.toneDesc, { color: colors.mutedForeground }]}>
                    {t.desc}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: colors.foreground }]}>Horario de entrega</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.hoursRow}
          >
            {HOURS.map((h) => {
              const selected = deliveryTime === h;
              return (
                <TouchableOpacity
                  key={h}
                  style={[
                    s.hourChip,
                    {
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected ? colors.primary : colors.card,
                    },
                  ]}
                  onPress={() => setDeliveryTime(h)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.hourText, { color: selected ? "#fff" : colors.foreground }]}>
                    {h}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <TouchableOpacity
          style={[s.submitBtn, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.submitText}>Comenzar</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    root: { flex: 1 },
    scroll: { paddingHorizontal: 24 },
    header: { alignItems: "center", marginBottom: 32, gap: 8 },
    logoCircle: {
      width: 64,
      height: 64,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    appName: {
      fontSize: 28,
      fontFamily: "Inter_700Bold",
    },
    subtitle: {
      fontSize: 15,
      fontFamily: "Inter_400Regular",
      textAlign: "center",
    },
    section: { marginBottom: 28 },
    sectionTitle: {
      fontSize: 18,
      fontFamily: "Inter_700Bold",
      marginBottom: 14,
    },
    label: {
      fontSize: 13,
      fontFamily: "Inter_500Medium",
      marginBottom: 6,
      marginTop: 12,
    },
    hint: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      marginBottom: 8,
      marginTop: -4,
    },
    input: {
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 13,
      fontSize: 15,
      fontFamily: "Inter_400Regular",
      marginBottom: 10,
    },
    toneGrid: {
      gap: 10,
    },
    toneCard: {
      borderWidth: 1.5,
      borderRadius: 12,
      padding: 14,
      gap: 2,
    },
    toneLabel: {
      fontSize: 15,
      fontFamily: "Inter_600SemiBold",
    },
    toneDesc: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
    },
    hoursRow: {
      gap: 8,
      paddingRight: 8,
    },
    hourChip: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 20,
      borderWidth: 1,
    },
    hourText: {
      fontSize: 14,
      fontFamily: "Inter_500Medium",
    },
    submitBtn: {
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: "center",
      marginTop: 8,
    },
    submitText: {
      color: "#fff",
      fontSize: 17,
      fontFamily: "Inter_700Bold",
    },
  });
