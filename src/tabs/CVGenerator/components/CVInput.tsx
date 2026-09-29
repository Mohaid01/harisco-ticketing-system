import React from 'react';

interface CVInputProps {
  label: string;
  name?: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  isTextArea?: boolean;
  subLabel?: boolean;
  compact?: boolean;
  min?: number | string;
  max?: number | string;
  dataRow?: number | string;
  className?: string;
}

const CVInput: React.FC<CVInputProps> = ({
  label,
  type = 'text',
  placeholder,
  name,
  required,
  value,
  onChange,
  isTextArea = false,
  subLabel = false,
  compact = false,
  min,
  max,
  dataRow,
  className = '',
}) => (
  <div className="cv-input-group">
    <label
      className={`cv-input-label ${
        compact
          ? 'cv-input-label-compact'
          : subLabel
            ? 'cv-input-label-sub'
            : 'cv-input-label-default'
      }`}
    >
      {label}
    </label>
    {isTextArea ? (
      <textarea
        data-row={dataRow}
        data-field={name}
        required={required}
        name={name}
        value={value}
        onChange={onChange}
        rows={4}
        placeholder={placeholder}
        className={`cv-input ${className}`}
      />
    ) : (
      <input
        data-row={dataRow}
        data-field={name}
        required={required}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        min={min}
        max={max}
        className={`cv-input ${className}`}
      />
    )}
  </div>
);

export default CVInput;
