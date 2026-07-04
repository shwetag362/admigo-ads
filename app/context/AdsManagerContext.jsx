// src/context/AdsManagerContext.js

'use client';

import React, { createContext, useContext, useState } from "react";

const AdsManagerContext = createContext();

export const AdsManagerProvider = ({ children }) => {
  const [selected, setSelected] = useState({
    campaign: null,
    adset: null,
    ad: null,
  });

  const setSelectedLevel = (level, data) => {
    setSelected(prev => ({
      ...prev,
      [level]: data,
      // campaign select → adset & ad clear
      ...(level === "campaign" ? { adset: null, ad: null } : {}),
      // adset select → ad clear
      ...(level === "adset" ? { ad: null } : {}),
    }));
  };

  const clearBelow = (level) => {
    setSelected(prev => ({
      campaign: level === "campaign" ? null : prev.campaign,
      adset: level === "ad" ? prev.adset : null,
      ad: null,
    }));
  };

  return (
    <AdsManagerContext.Provider value={{ selected, setSelectedLevel, clearBelow }}>
      {children}
    </AdsManagerContext.Provider>
  );
};

export const useAdsHierarchy = () => useContext(AdsManagerContext);