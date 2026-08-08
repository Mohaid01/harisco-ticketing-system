import { Eye, EyeOff } from 'lucide-react';
import React from 'react';

interface PasswordToggleProps {
  visible: boolean;
  onMouseDown: () => void;
  onMouseUp: () => void;
}

export const PasswordToggle: React.FC<PasswordToggleProps> = ({ visible, onMouseDown, onMouseUp }) => (
  <button
    type="button"
    onMouseDown={onMouseDown}
    onMouseUp={onMouseUp}
    onMouseLeave={onMouseUp}
    className="password-toggle"
    aria-label={visible ? 'Hide password' : 'Show password'}
  >
    {visible ? <EyeOff size={16} /> : <Eye size={16} />}
  </button>
);
