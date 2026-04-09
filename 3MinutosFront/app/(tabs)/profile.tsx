import * as Haptics from "expo-haptics";
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
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useColors } from "@/hooks/useColors";
import { useUser } from "@/context/UserContext";
import { api, UserPreferences } from "@/services/api";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";

const TONES = [
  { value: "neutro" as const, label: "Neutro" },
  { value: "cercano" as const, label: "Cercano" },
  { value: "especialista" as const, label: "Especialista" },
  { value: "breve" as const, label: "Breve" },
];

const ITEM_HEIGHT = 44;
const VISIBLE_ROWS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ROWS;
const PICKER_SIDE_PADDING = (PICKER_HEIGHT - ITEM_HEIGHT) / 2;

const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, "0"));

function parseDeliveryTime(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) {
    return { hour: "08", minute: "00" };
  }
  return {
    hour: match[1],
    minute: match[2],
  };
}

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

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { userId, clearUserId } = useUser();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [topics, setTopics] = useState<[string, string, string]>(["", "", ""]);
  const [tone, setTone] = useState<UserPreferences["tone"]>("neutro");
  const [selectedHour, setSelectedHour] = useState("08");
  const [selectedMinute, setSelectedMinute] = useState("00");
  const [draftHour, setDraftHour] = useState("08");
  const [draftMinute, setDraftMinute] = useState("00");
  const [timeModalVisible, setTimeModalVisible] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const deliveryTime = useMemo(
    () => `${selectedHour}:${selectedMinute}`,
    [selectedHour, selectedMinute]
  );

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["preferences", userId],
    queryFn: () => api.getPreferences(userId!),
    enabled: !!userId,
  });

  useEffect(() => {
    if (data) {
      setName(data.name ?? "");
      const t = data.topics ?? ["", "", ""];
      setTopics([t[0] ?? "", t[1] ?? "", t[2] ?? ""] as [string, string, string]);
      setTone(data.tone ?? "neutro");
      const parsed = parseDeliveryTime(data.deliveryTime ?? "08:00");
      setSelectedHour(parsed.hour);
      setSelectedMinute(parsed.minute);
      setDraftHour(parsed.hour);
      setDraftMinute(parsed.minute);
      setIsActive(data.isActive ?? true);
      setIsDirty(false);
    }
  }, [data]);

  const markDirty = () => setIsDirty(true);

  const updateTopic = (index: number, value: string) => {
    const next: [string, string, string] = [...topics] as [string, string, string];
    next[index] = value;
    setTopics(next);
    markDirty();
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
    markDirty();
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  };

  const handleSave = async () => {
    if (!userId) return;
    if (!name.trim() || topics.some((t) => !t.trim())) {
      Alert.alert("Campos requeridos", "Nombre y los 3 topicos son obligatorios.");
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSaving(true);

    try {
      await api.updatePreferences(userId, {
        name: name.trim(),
        topics: [topics[0].trim(), topics[1].trim(), topics[2].trim()],
        tone,
        deliveryTime,
        isActive,
      });
      await queryClient.invalidateQueries({ queryKey: ["preferences", userId] });
      await queryClient.invalidateQueries({ queryKey: ["digest", userId] });
      setIsDirty(false);
      Alert.alert("Guardado", "Tus preferencias han sido actualizadas.");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      Alert.alert("Error", msg);
    } finally {
      setSaving(false);
    }
  };

  const confirmLogout = () => {
    Alert.alert("Cerrar sesion", "Se borrara tu usuario guardado localmente. Continuar?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Salir",
        style: "destructive",
        onPress: () => clearUserId(),
      },
    ]);
  };

  const s = makeStyles(colors);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 + 84 : insets.bottom + 84;

  return (
    <>
      <KeyboardAvoidingView
        style={[s.root, { backgroundColor: colors.background }]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={[s.header, { paddingTop: topPad + 16, borderBottomColor: colors.border }]}>
          <Text style={[s.title, { color: colors.foreground }]}>Perfil</Text>
          {isDirty && (
            <TouchableOpacity
              style={[s.saveBtn, { backgroundColor: colors.primary }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={s.saveTxt}>Guardar</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {isLoading && (
          <View style={{ padding: 20 }}>
            <LoadingState />
          </View>
        )}

        {isError && <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />}

        {!isLoading && !isError && (
          <ScrollView
            contentContainerStyle={[s.scroll, { paddingBottom: botPad }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={s.section}>
              <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>Nombre</Text>
              <TextInput
                style={[
                  s.input,
                  { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground },
                ]}
                value={name}
                onChangeText={(v) => {
                  setName(v);
                  markDirty();
                }}
                placeholder="Tu nombre"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="words"
              />
            </View>

            <View style={s.section}>
              <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>Topicos</Text>
              {([0, 1, 2] as const).map((i) => (
                <TextInput
                  key={i}
                  style={[
                    s.input,
                    { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground },
                  ]}
                  value={topics[i]}
                  onChangeText={(v) => updateTopic(i, v)}
                  placeholder={`Topico ${i + 1}`}
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="none"
                />
              ))}
            </View>

            <View style={s.section}>
              <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>Tono</Text>
              <View style={s.chips}>
                {TONES.map((t) => {
                  const selected = tone === t.value;
                  return (
                    <TouchableOpacity
                      key={t.value}
                      style={[
                        s.chip,
                        {
                          borderColor: selected ? colors.primary : colors.border,
                          backgroundColor: selected ? colors.primary : colors.card,
                        },
                      ]}
                      onPress={() => {
                        setTone(t.value);
                        markDirty();
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.chipText, { color: selected ? "#fff" : colors.foreground }]}>
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={s.section}>
              <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>Horario de entrega</Text>

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

            <View style={[s.section, s.activeRow]}>
              <View style={s.activeLeft}>
                <Text style={[s.activeTitle, { color: colors.foreground }]}>Suscripcion activa</Text>
                <Text style={[s.activeDesc, { color: colors.mutedForeground }]}>Recibir digest diario</Text>
              </View>
              <Switch
                value={isActive}
                onValueChange={(v) => {
                  setIsActive(v);
                  markDirty();
                }}
                trackColor={{ false: colors.muted, true: colors.primary }}
                thumbColor="#fff"
              />
            </View>

            <View
              style={[
                s.section,
                s.userIdRow,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Feather name="user" size={14} color={colors.mutedForeground} />
              <Text style={[s.userIdText, { color: colors.mutedForeground }]} numberOfLines={1}>
                ID: {userId}
              </Text>
            </View>

            <TouchableOpacity
              style={[s.logoutBtn, { borderColor: colors.destructive }]}
              onPress={confirmLogout}
              activeOpacity={0.7}
            >
              <Feather name="log-out" size={16} color={colors.destructive} />
              <Text style={[s.logoutText, { color: colors.destructive }]}>Cerrar sesion</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
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
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
    },
    title: {
      fontSize: 26,
      fontFamily: "Inter_700Bold",
    },
    saveBtn: {
      paddingHorizontal: 18,
      paddingVertical: 9,
      borderRadius: 10,
      minWidth: 80,
      alignItems: "center",
    },
    saveTxt: {
      color: "#fff",
      fontFamily: "Inter_600SemiBold",
      fontSize: 14,
    },
    scroll: { padding: 20, gap: 4 },
    section: { marginBottom: 24 },
    sectionLabel: {
      fontSize: 12,
      fontFamily: "Inter_500Medium",
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: 10,
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
    chips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    chip: {
      paddingHorizontal: 16,
      paddingVertical: 9,
      borderRadius: 20,
      borderWidth: 1.5,
    },
    chipText: {
      fontSize: 14,
      fontFamily: "Inter_500Medium",
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
    activeRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    activeLeft: { flex: 1, gap: 2 },
    activeTitle: {
      fontSize: 15,
      fontFamily: "Inter_500Medium",
    },
    activeDesc: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
    },
    userIdRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 10,
      borderWidth: 1,
    },
    userIdText: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      flex: 1,
    },
    logoutBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 16,
      paddingVertical: 14,
      justifyContent: "center",
      marginTop: 8,
    },
    logoutText: {
      fontSize: 15,
      fontFamily: "Inter_500Medium",
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
    modalRoot: {
  flex: 1,
  justifyContent: "flex-end",
},
  });