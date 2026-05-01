import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface Person {
  id: string;
  name: string;
  phone: string;
  deviceId: string;
  slot: number;
  consentStatus?: 'confirmed' | 'pending' | 'declined' | 'none';
}

interface ReachStore {
  persons: [Person | null, Person | null, Person | null];
  deviceIds: [string, string, string];
  hasRegistered: boolean;
  setPerson: (person: Person, slot: 1 | 2 | 3) => void;
  removePerson: (slot: 1 | 2 | 3) => void;
  setDeviceId: (id: string, slot: 1 | 2 | 3) => void;
  setHasRegistered: (val: boolean) => void;
  reset: () => void;
}

const useReachStore = create<ReachStore>()(
  persist(
    (set) => ({
      persons: [null, null, null],
      deviceIds: ["", "", ""],
      hasRegistered: false,
      setPerson: (person, slot) =>
        set((state) => {
          const persons = [...state.persons] as [Person | null, Person | null, Person | null];
          persons[slot - 1] = person;
          return { persons, hasRegistered: true };
        }),
      removePerson: (slot) =>
        set((state) => {
          const persons = [...state.persons] as [Person | null, Person | null, Person | null];
          persons[slot - 1] = null;
          return { persons };
        }),
      setDeviceId: (id, slot) =>
        set((state) => {
          const deviceIds = [...state.deviceIds] as [string, string, string];
          deviceIds[slot - 1] = id;
          return { deviceIds };
        }),
      setHasRegistered: (val) => set({ hasRegistered: val }),
      reset: () => set({ persons: [null, null, null], hasRegistered: false }),
    }),
    {
      name: "reach-storage-v2",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export default useReachStore;
