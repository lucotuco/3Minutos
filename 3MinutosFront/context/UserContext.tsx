import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

type UserContextValue = {
  userId: string | null;
  isLoading: boolean;
  setUserId: (id: string) => Promise<void>;
  clearUserId: () => Promise<void>;
};

const STORAGE_KEY = "user:id";

const UserContext = createContext<UserContextValue>({
  userId: null,
  isLoading: true,
  // Default no-ops to keep consumers safe even before provider mounts
  setUserId: async () => {},
  clearUserId: async () => {},
});

type Props = { children: ReactNode };

export function UserProvider({ children }: Props) {
  const [userId, setUserIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load the stored user id once on mount
  useEffect(() => {
    const load = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          setUserIdState(stored);
        }
      } catch (err) {
        console.warn("Unable to load stored user id", err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const setUserId = useCallback(async (id: string) => {
    setUserIdState(id);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, id);
    } catch (err) {
      console.warn("Failed to persist user id", err);
    }
  }, []);

  const clearUserId = useCallback(async () => {
    setUserIdState(null);
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.warn("Failed to clear stored user id", err);
    }
  }, []);

  const value = useMemo(
    () => ({ userId, isLoading, setUserId, clearUserId }),
    [userId, isLoading, setUserId, clearUserId]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  return useContext(UserContext);
}
