import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import CommandPalette from '../common/CommandPalette';
import AddContextModal from '../common/AddContextModal';

export default function Layout() {
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isAddContextOpen, setIsAddContextOpen] = useState(false);

  useEffect(() => {
    const handleOpenPalette = () => setIsPaletteOpen(true);
    const handleOpenContextModal = () => setIsAddContextOpen(true);

    window.addEventListener('open-command-palette', handleOpenPalette);
    window.addEventListener('open-add-context-modal', handleOpenContextModal);

    return () => {
      window.removeEventListener('open-command-palette', handleOpenPalette);
      window.removeEventListener('open-add-context-modal', handleOpenContextModal);
    };
  }, []);

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-area">
        <Header />
        <main className="main-content">
          <Outlet />
        </main>
      </div>
      <CommandPalette isOpen={isPaletteOpen} onClose={() => setIsPaletteOpen(false)} />
      <AddContextModal
        isOpen={isAddContextOpen}
        onClose={() => setIsAddContextOpen(false)}
        onContextsUpdated={() => {
          window.dispatchEvent(new CustomEvent('contexts-refreshed'));
        }}
      />
    </div>
  );
}
