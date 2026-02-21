import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface Person {
  id: string;
  name: string;
  phone: string;
  deviceId: string;
}

interface ReachStore {
  person: Person | null;
  deviceId: string;
  hasRegistered: boolean;
  setPerson: (person: Person) => void;
  setDeviceId: (id: string) => void;
  setHasRegistered: (val: boolean) => void;
  reset: () => void;
}

const useReachStore = create<ReachStore>()(
  persist(
    (set) => ({
      person: null,
      deviceId: "",
      hasRegistered: false,
      setPerson: (person: Person) => set({ person, hasRegistered: true }),
      setDeviceId: (id: string) => set({ deviceId: id }),
      setHasRegistered: (val: boolean) => set({ hasRegistered: val }),
      reset: () => set({ person: null, hasRegistered: false }),
    }),
    {
      name: "reach-storage",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export default useReachStore;
