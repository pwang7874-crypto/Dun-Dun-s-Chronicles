import React, { createContext, useContext } from 'react';

import type { AppServices } from './services';

const ServicesContext = createContext<AppServices | null>(null);

export const ServicesProvider = ({
  services,
  children,
}: React.PropsWithChildren<{ services: AppServices }>) => (
  <ServicesContext.Provider value={services}>
    {children}
  </ServicesContext.Provider>
);

export const useServices = (): AppServices => {
  const services = useContext(ServicesContext);
  if (!services) {
    throw new Error('ServicesProvider is missing');
  }
  return services;
};
