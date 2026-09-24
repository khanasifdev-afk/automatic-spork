import React from 'react';
import { Outlet } from 'react-router-dom';
import { AppHeader } from './AppHeader';

export const AppLayout: React.FC = () => {
  return (
    <div className="app-layout">
      <AppHeader />
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
};
