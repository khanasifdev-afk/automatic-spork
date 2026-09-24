import React from 'react';
import { NavLink } from 'react-router-dom';
import { Video, Settings, Film } from 'lucide-react';

export const AppHeader: React.FC = () => {
  return (
    <header className="app-header">
      <div className="header-container">
        <NavLink to="/" className="brand" aria-label="YouTube Stock Video Generator Home">
          <div className="brand-icon">
            <Film size={18} />
          </div>
          <span>Stock Video Generator</span>
        </NavLink>

        <nav className="nav-menu" aria-label="Main Navigation">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <Video size={16} />
            <span>Workspace</span>
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <Settings size={16} />
            <span>Settings</span>
          </NavLink>
        </nav>
      </div>
    </header>
  );
};
