import React, { type ChangeEvent } from 'react';

interface CVNumberInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

const CVNumberInput: React.FC<CVNumberInputProps> = ({ label, value, onChange, min = 0, max = 999 }) => (
  <div className="cv-input-group">
    <label className="cv-input-label-default">{label}</label>
    <input
      type="number"
      min={min}
      max={max}
      value={value}
      onChange={(e: ChangeEvent<HTMLInputElement>) => {
        const val = parseInt(e.target.value, 10);
        onChange(isNaN(val) ? 0 : val);
      }}
      className="cv-input"
    />
  </div>
);

export default CVNumberInput;
