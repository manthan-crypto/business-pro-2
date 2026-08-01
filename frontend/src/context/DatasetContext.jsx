import React, { createContext, useContext, useEffect, useState } from "react";
import api from "../lib/api";

const DatasetCtx = createContext(null);

export function DatasetProvider({ children }) {
  const [datasets, setDatasets] = useState([]);
  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/datasets");
      setDatasets(data);
      const a = data.find((d) => d.is_active) || data[0] || null;
      setActive(a);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const activate = async (id) => {
    await api.post(`/datasets/${id}/activate`);
    await refresh();
  };

  const remove = async (id) => {
    await api.delete(`/datasets/${id}`);
    await refresh();
  };

  return (
    <DatasetCtx.Provider value={{ datasets, active, loading, refresh, activate, remove }}>
      {children}
    </DatasetCtx.Provider>
  );
}

export const useDatasets = () => useContext(DatasetCtx);
