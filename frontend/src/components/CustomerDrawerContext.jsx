import React, { createContext, useContext, useState } from "react";
import CustomerDrawer from "./CustomerDrawer";
import { useDatasets } from "../context/DatasetContext";

const Ctx = createContext(null);

export function CustomerDrawerProvider({ children }) {
  const [name, setName] = useState(null);
  const { datasets } = useDatasets();
  const scope = datasets && datasets.length > 1 ? "all" : "active";
  return (
    <Ctx.Provider value={{ open: setName, close: () => setName(null) }}>
      {children}
      <CustomerDrawer customer={name} scope={scope} onClose={() => setName(null)} />
    </Ctx.Provider>
  );
}

export const useCustomerDrawer = () => useContext(Ctx);

/** CustomerLink: renders a customer name as a clickable text button that opens the drawer. */
export function CustomerLink({ name, className = "", testid }) {
  const { open } = useCustomerDrawer() || { open: () => {} };
  if (!name) return null;
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); open(name); }}
      className={`text-left hover:text-[#002FA7] hover:underline decoration-2 underline-offset-2 transition-colors ${className}`}
      data-testid={testid || `open-customer-${name}`}
      title={`Open ${name} details`}
    >
      {name}
    </button>
  );
}
