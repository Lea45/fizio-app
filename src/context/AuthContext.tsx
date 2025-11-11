import React, { createContext, useContext, useState } from "react";



type User = {
  role: "client" | "admin";
  phone?: string;
  name?: string;
  id?: string;
};

interface AuthContextType {
  user: User | null;
  loginClient: (clientData: Omit<User, "role">) => void;
  loginAdmin: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {

  const [user, setUser] = useState<User | null>(null);

  const loginClient = (clientData: Omit<User, "role">) =>
    setUser({ role: "client", ...clientData });
  const loginAdmin = () => setUser({ role: "admin" });
  const logout = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, loginClient, loginAdmin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth mora biti unutar AuthProvider-a");
  return context;
}
