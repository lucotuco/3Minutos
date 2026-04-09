import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useUser } from "@/context/UserContext";
import { useColors } from "@/hooks/useColors";
import { api } from "@/services/api";

const TONES = [
  { value: "neutro" as const, label: "Neutro", desc: "Objetivo e informativo" },
  { value: "cercano" as const, label: "Cercano", desc: "Amigable y conversacional" },
  { value: "especialista" as const, label: "Especialista", desc: "Tecnico y detallado" },
  { value: "breve" as const, label: "Breve", desc: "Conciso y directo" },
];

const ITEM_HEIGHT = 44;
const VISIBLE_ROWS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ROWS;
const PICKER_SIDE_PADDING = (PICKER_HEIGHT - ITEM_HEIGHT) / 2;

const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, "0"));

type WheelColumnProps = {
  data: string[];
  value: string;
  onChange: (value: string) => void;
  colors: ReturnType<typeof useColors>;
};

function WheelColumn({ data, value, onChange, colors }: WheelColumnProps) {
  const scrollRef = useRef<ScrollView>(null);
  const lastSentRef = useRef(value);

  const selectedIndex = useMemo(
    () => Math.max(0, data.findIndex((item) => item === value)),
    [data, value]
  );

  useEffect(() => {
    const offset = selectedIndex * ITEM_HEIGHT;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: offset, animated: false });
    });
  }, [selectedIndex]);

  const commitIndex = async (index: number) => {
    const safeIndex = Math.max(0, Math.min(index, data.length - 1));
    const nextValue = data[safeIndex];

    scrollRef.current?.scrollTo({
      y: safeIndex * ITEM_HEIGHT,
      animated: true,
    });

    if (nextValue !== lastSentRef.current) {
      lastSentRef.current = nextValue;
      onChange(nextValue);
      try {
        await Haptics.selectionAsync();
      } catch {}
    }
  };

  const handleMomentumEnd = async (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = e.nativeEvent.contentOffset.y;
    const index = Math.round(offsetY / ITEM_HEIGHT);
    await commitIndex(index);
  };

  return (
    <View style={baseStyles.wheelColumn}>
      <ScrollView
        ref={scrollRef}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        bounces={false}
        snapToInterval={ITEM_HEIGHT}
        snapToAlignment="center"
        decelerationRate="fast"
        onMomentumScrollEnd={handleMomentumEnd}
        contentContainerStyle={{
          paddingVertical: PICKER_SIDE_PADDING,
        }}
      >
        {data.map((item) => {
          const selected = item === value;
          return (
            <View key={item} style={[baseStyles.wheelItem, { height: ITEM_HEIGHT }]}>
              <Text
                style={[
                  baseStyles.wheelText,
                  {
                    color: selected ? colors.foreground : colors.mutedForeground,
                    opacity: selected ? 1 : 0.45,
                    fontFamily: selected ? "Inter_700Bold" : "Inter_400Regular",
                  },
                ]}
              >
                {item}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default function OnboardingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { setUserId, clearUserId } = useUser();

  const [name, setName] = useState("");
  const [topics, setTopics] = useState<[string, string, string]>(["", "", ""]);
  const [tone, setTone] = useState<"neutro" | "cercano" | "especialista" | "breve">("neutro");
  const [selectedHour, setSelectedHour] = useState("08");
  const [selectedMinute, setSelectedMinute] = useState("00");
  const [draftHour, setDraftHour] = useState("08");
  const [draftMinute, setDraftMinute] = useState("00");
  const [timeModalVisible, setTimeModalVisible] = useState(false);
  const [isActive] = useState(true);
  const [loading, setLoading] = useState(false);

  const deliveryTime = `${selectedHour}:${selectedMinute}`;

  const updateTopic = (index: number, value: string) => {
    const next: [string, string, string] = [...topics] as [string, string, string];
    next[index] = value;
    setTopics(next);
  };

  const validate = () => {
    if (!name.trim()) return "Ingresa tu nombre";
    if (topics.some((t) => !t.trim())) return "Completa los 3 topicos";
    return null;
  };

  const openTimeModal = () => {
    setDraftHour(selectedHour);
    setDraftMinute(selectedMinute);
    setTimeModalVisible(true);
  };

  const closeTimeModal = () => {
    setTimeModalVisible(false);
  };

  const confirmTimeSelection = async () => {
    setSelectedHour(draftHour);
    setSelectedMinute(draftMinute);
    setTimeModalVisible(false);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
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
      await clearUserId();

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
    <>
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
              style={[
                s.input,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.foreground,
                },
              ]}
              placeholder="Como te llamamos?"
              placeholderTextColor={colors.mutedForeground}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />

            <Text style={[s.label, { color: colors.mutedForeground }]}>Tus 3 topicos de interes</Text>
            <Text style={[s.hint, { color: colors.mutedForeground }]}>
              Ej: tecnologia, economia, ciencia, cultura, deportes...
            </Text>

            {([0, 1, 2] as const).map((i) => (
              <TextInput
                key={i}
                style={[
                  s.input,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    color: colors.foreground,
                  },
                ]}
                placeholder={`Topico ${i + 1}`}
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
                        backgroundColor: selected ? `${colors.primary}15` : colors.card,
                      },
                    ]}
                    onPress={() => setTone(t.value)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        s.toneLabel,
                        { color: selected ? colors.primary : colors.foreground },
                      ]}
                    >
                      {t.label}
                    </Text>
                    <Text style={[s.toneDesc, { color: colors.mutedForeground }]}>{t.desc}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={s.section}>
            <Text style={[s.sectionTitle, { color: colors.foreground }]}>Horario de entrega</Text>

            <TouchableOpacity
              activeOpacity={0.75}
              onPress={openTimeModal}
              style={[
                s.timeRowButton,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={s.timeRowLeft}>
                <View style={[s.timeIconWrap, { backgroundColor: colors.secondary }]}>
                  <Feather name="clock" size={16} color={colors.mutedForeground} />
                </View>
                <View>
                  <Text style={[s.timeRowTitle, { color: colors.foreground }]}>Hora de entrega</Text>
                  <Text style={[s.timeRowSubtitle, { color: colors.mutedForeground }]}>
                    Toca para cambiarla
                  </Text>
                </View>
              </View>

              <View style={s.timeRowRight}>
                <Text style={[s.timeRowValue, { color: colors.foreground }]}>{deliveryTime}</Text>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </View>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[s.submitBtn, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.submitText}>Comenzar</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={timeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeTimeModal}
      >
        <View style={s.modalRoot}>
          <Pressable style={s.modalBackdrop} onPress={closeTimeModal} />

          <View
            style={[
              s.modalSheet,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                paddingBottom: Math.max(insets.bottom, 16),
              },
            ]}
          >
            <View style={[s.modalHeader, { borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={closeTimeModal} hitSlop={10}>
                <Text style={[s.modalCancel, { color: colors.mutedForeground }]}>Cancelar</Text>
              </TouchableOpacity>

              <Text style={[s.modalTitle, { color: colors.foreground }]}>Horario de entrega</Text>

              <TouchableOpacity onPress={confirmTimeSelection} hitSlop={10}>
                <Text style={[s.modalDone, { color: colors.primary }]}>Listo</Text>
              </TouchableOpacity>
            </View>

            <View style={[s.timePreview, { backgroundColor: colors.secondary, alignSelf: "center" }]}>
              <Feather name="clock" size={14} color={colors.mutedForeground} />
              <Text style={[s.timePreviewText, { color: colors.foreground }]}>
                {draftHour}:{draftMinute}
              </Text>
            </View>

            <View
              style={[
                s.wheelCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <View
                pointerEvents="none"
                style={[
                  s.wheelSelectionOverlay,
                  {
                    top: Math.round((PICKER_HEIGHT - ITEM_HEIGHT) / 2),
                    height: ITEM_HEIGHT,
                    backgroundColor: `${colors.primary}12`,
                    borderColor: `${colors.primary}35`,
                  },
                ]}
              />

              <View style={s.wheelRow}>
                <WheelColumn
                  data={HOURS}
                  value={draftHour}
                  onChange={setDraftHour}
                  colors={colors}
                />

                <Text style={[s.wheelSeparator, { color: colors.foreground }]}>:</Text>

                <WheelColumn
                  data={MINUTES}
                  value={draftMinute}
                  onChange={setDraftMinute}
                  colors={colors}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const baseStyles = StyleSheet.create({
  wheelColumn: {
    flex: 1,
    height: PICKER_HEIGHT,
  },
  wheelItem: {
    alignItems: "center",
    justifyContent: "center",
  },
  wheelText: {
    fontSize: 24,
    lineHeight: 24,
    textAlign: "center",
    includeFontPadding: false,
    letterSpacing: 0.3,
  },
});

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
    timePreview: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginBottom: 12,
    },
    timePreviewText: {
      fontSize: 16,
      fontFamily: "Inter_700Bold",
      letterSpacing: 0.4,
    },
    timeRowButton: {
      borderWidth: 1,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 14,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    timeRowLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1,
    },
    timeIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
    },
    timeRowTitle: {
      fontSize: 15,
      fontFamily: "Inter_600SemiBold",
    },
    timeRowSubtitle: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      marginTop: 2,
    },
    timeRowRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    timeRowValue: {
      fontSize: 16,
      fontFamily: "Inter_700Bold",
      letterSpacing: 0.3,
    },
    wheelCard: {
      borderWidth: 1,
      borderRadius: 20,
      paddingHorizontal: 10,
      position: "relative",
      overflow: "hidden",
    },
    wheelRow: {
      flexDirection: "row",
      alignItems: "center",
      height: PICKER_HEIGHT,
    },
    wheelSeparator: {
      fontSize: 28,
      fontFamily: "Inter_700Bold",
      paddingHorizontal: 10,
      opacity: 0.9,
    },
    wheelSelectionOverlay: {
      position: "absolute",
      left: 10,
      right: 10,
      borderRadius: 14,
      borderWidth: 1,
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
    modalRoot: {
      flex: 1,
      justifyContent: "flex-end",
    },
    modalBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.35)",
    },
    modalSheet: {
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderTopWidth: 1,
      paddingTop: 10,
      paddingHorizontal: 16,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottomWidth: 1,
      paddingBottom: 12,
      marginBottom: 14,
    },
    modalTitle: {
      fontSize: 16,
      fontFamily: "Inter_700Bold",
    },
    modalCancel: {
      fontSize: 15,
      fontFamily: "Inter_500Medium",
    },
    modalDone: {
      fontSize: 15,
      fontFamily: "Inter_700Bold",
    },
  });