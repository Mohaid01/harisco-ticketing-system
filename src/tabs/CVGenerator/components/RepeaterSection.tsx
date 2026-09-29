import React from 'react';

import { motion } from 'framer-motion';

import { Plus, Trash2 } from 'lucide-react';

import CVInput from './CVInput';

interface RepeaterRowData {
  [key: string]: string;
}

interface RepeaterSectionProps {
  title: string;
  rows: RepeaterRowData[];
  setRows: (rows: RepeaterRowData[]) => void;
  maxEntries: number;
  minEntries?: number;
  fields: string[];
  labels: Record<string, string>;
  hasSelect?: Record<string, string[]>;
  hasDate?: string[];
  gridCols?: Record<string, string>;
  infoText?: string;
}

const defaultGridCols: Record<string, string> = {
  degree: 'md:col-span-5',
  sessionFrom: 'md:col-span-2',
  sessionTo: 'md:col-span-2',
  institution: 'md:col-span-4',
  name: 'md:col-span-3',
  year: 'md:col-span-1',
  body: 'md:col-span-4',
  description: 'md:col-span-5',
  company: 'md:col-span-3',
  from: 'md:col-span-1',
  to: 'md:col-span-1',
  position: 'md:col-span-2',
  language: 'md:col-span-3',
  level: 'md:col-span-2',
  mobile: 'md:col-span-2',
};

const RepeaterSection: React.FC<RepeaterSectionProps> = ({
  title,
  rows,
  setRows,
  maxEntries,
  minEntries = 0,
  fields,
  labels,
  hasSelect = {},
  hasDate = [],
  gridCols = {},
  infoText,
}) => {
  const addRow = () => {
    if (rows.length >= maxEntries) return;
    const newRow: RepeaterRowData = {};
    fields.forEach((f) => {
      newRow[f] = '';
    });
    setRows([...rows, newRow]);
  };

  const removeRow = (index: number) => {
    if (rows.length <= (minEntries ?? 0)) return;
    setRows(rows.filter((_, i) => i !== index));
  };

  const updateRow = (index: number, field: string, value: string) => {
    setRows(rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const mergedGridCols = { ...defaultGridCols, ...gridCols };

  return (
    <div className="cv-repeater-section">
      <div className="cv-repeater-header">
        <h3 className="cv-repeater-title">{title}</h3>
        {infoText && <p className="cv-repeater-info">{infoText}</p>}
        <span className="cv-repeater-counter">
          {rows.length}/{maxEntries}
        </span>
      </div>

      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.3 }}
        className="cv-repeater-body"
      >
        {rows.length === 0 && (
          <p className="cv-empty-text">No entries added yet. Click the button below to add one.</p>
        )}

        {rows.map((row, index) => (
          <div key={index} className="cv-repeater-row">
            <div className="cv-repeater-row-header">
              <span className="cv-repeater-entry-label">Entry {index + 1}</span>
              <button
                type="button"
                onClick={() => removeRow(index)}
                disabled={rows.length <= (minEntries ?? 0)}
                className="cv-btn cv-btn-danger"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="cv-repeater-grid">
              {fields.map((field) => {
                const colSpan = mergedGridCols[field] || 'md:col-span-3';
                const selectOptions = hasSelect[field];
                const isDate = hasDate.includes(field);

                return (
                  <div key={field} className={colSpan}>
                    {selectOptions ? (
                      <div className="cv-input-group">
                        <label className="cv-input-label-sub">{labels[field]}</label>
                        <select
                          data-row={index}
                          data-field={field}
                          value={row[field] || ''}
                          onChange={(e) => updateRow(index, field, e.target.value)}
                          className="cv-input cv-select"
                        >
                          <option value="" className="bg-slate-900 text-white">
                            Select
                          </option>
                          {selectOptions.map((opt) => (
                            <option key={opt} value={opt} className="bg-slate-900 text-white">
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : isDate ? (
                      <div className="cv-input-group">
                        <label className="cv-input-label-sub">{labels[field]}</label>
                        <input
                          data-row={index}
                          data-field={field}
                          type="date"
                          value={row[field] || ''}
                          onChange={(e) => updateRow(index, field, e.target.value)}
                          className="cv-input"
                        />
                      </div>
                    ) : (
                      <CVInput
                        label={labels[field]}
                        value={row[field] || ''}
                        onChange={(e) => updateRow(index, field, e.target.value)}
                        placeholder=""
                        name={field}
                        dataRow={index}
                        compact
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addRow}
          disabled={rows.length >= maxEntries}
          className="cv-btn cv-btn-secondary gap-2"
        >
          <Plus className="w-4 h-4" />
          <span className="cv-btn-text">Add Entry</span>
        </button>
      </motion.div>
    </div>
  );
};

export default RepeaterSection;
