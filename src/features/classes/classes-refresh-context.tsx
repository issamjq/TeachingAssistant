"use client";

import { createContext, useCallback, useContext, useState } from "react";

interface ClassesRefreshValue {
  version: number;
  bump: () => void;
}

const ClassesRefreshContext = createContext<ClassesRefreshValue | null>(null);

export function ClassesRefreshProvider({ children }: { children: React.ReactNode }) {
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);
  return (
    <ClassesRefreshContext.Provider value={{ version, bump }}>
      {children}
    </ClassesRefreshContext.Provider>
  );
}

export function useClassesRefresh(): ClassesRefreshValue {
  const ctx = useContext(ClassesRefreshContext);
  if (!ctx) throw new Error("useClassesRefresh must be used within ClassesRefreshProvider");
  return ctx;
}
