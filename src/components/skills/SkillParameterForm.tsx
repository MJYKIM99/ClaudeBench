import { useCallback, useMemo } from 'react';

import type { ParameterValidationError, SkillParameter, SkillParameterValues } from '../../types';

import './SkillParameterForm.css';

interface SkillParameterFormProps {
  parameters: SkillParameter[];
  values: SkillParameterValues;
  onChange: (values: SkillParameterValues) => void;
  errors?: ParameterValidationError[];
}

interface FieldProps {
  param: SkillParameter;
  value: string | number | boolean | string[] | undefined;
  error?: string;
  onChange: (name: string, value: string | number | boolean | string[]) => void;
}

function StringField({ param, value, error, onChange }: FieldProps) {
  return (
    <input
      id={`param-${param.name}`}
      type="text"
      className={`param-input ${error ? 'error' : ''}`}
      value={(value as string) ?? param.default ?? ''}
      placeholder={param.placeholder}
      onChange={(e) => onChange(param.name, e.target.value)}
    />
  );
}

function NumberField({ param, value, error, onChange }: FieldProps) {
  return (
    <input
      id={`param-${param.name}`}
      type="number"
      className={`param-input ${error ? 'error' : ''}`}
      value={(value as number) ?? param.default ?? ''}
      min={param.min}
      max={param.max}
      step={param.step ?? 1}
      placeholder={param.placeholder}
      onChange={(e) => onChange(param.name, e.target.valueAsNumber)}
    />
  );
}

function BooleanField({ param, value, onChange }: FieldProps) {
  return (
    <label className="param-toggle">
      <input
        id={`param-${param.name}`}
        type="checkbox"
        checked={(value as boolean) ?? param.default ?? false}
        onChange={(e) => onChange(param.name, e.target.checked)}
      />
      <span className="toggle-slider" />
    </label>
  );
}

function SelectField({ param, value, error, onChange }: FieldProps) {
  return (
    <select
      id={`param-${param.name}`}
      className={`param-select ${error ? 'error' : ''}`}
      value={(value as string) ?? param.default ?? ''}
      onChange={(e) => onChange(param.name, e.target.value)}
    >
      <option value="">Select...</option>
      {param.options?.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function MultiSelectField({ param, value, onChange }: FieldProps) {
  const selectedValues = useMemo(() => {
    return (value as string[]) ?? (param.default as string[]) ?? [];
  }, [value, param.default]);

  const handleChange = useCallback(
    (optValue: string, checked: boolean) => {
      const newValues = checked
        ? [...selectedValues, optValue]
        : selectedValues.filter((v) => v !== optValue);
      onChange(param.name, newValues);
    },
    [selectedValues, onChange, param.name]
  );

  return (
    <div className="param-multiselect">
      {param.options?.map((opt) => (
        <label key={opt.value} className="multiselect-option">
          <input
            type="checkbox"
            checked={selectedValues.includes(opt.value)}
            onChange={(e) => handleChange(opt.value, e.target.checked)}
          />
          <span>{opt.label}</span>
        </label>
      ))}
    </div>
  );
}

function TextField({ param, value, error, onChange }: FieldProps) {
  return (
    <textarea
      id={`param-${param.name}`}
      className={`param-textarea ${error ? 'error' : ''}`}
      value={(value as string) ?? param.default ?? ''}
      placeholder={param.placeholder}
      rows={param.rows ?? 3}
      onChange={(e) => onChange(param.name, e.target.value)}
    />
  );
}

function FileField({ param, value, error, onChange }: FieldProps) {
  return (
    <input
      id={`param-${param.name}`}
      type="text"
      className={`param-input ${error ? 'error' : ''}`}
      value={(value as string) ?? param.default ?? ''}
      placeholder={param.placeholder ?? 'Enter file path...'}
      onChange={(e) => onChange(param.name, e.target.value)}
    />
  );
}

export function SkillParameterForm({
  parameters,
  values,
  onChange,
  errors = [],
}: SkillParameterFormProps) {
  const errorMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const err of errors) {
      map[err.name] = err.message;
    }
    return map;
  }, [errors]);

  const handleChange = useCallback(
    (name: string, value: string | number | boolean | string[]) => {
      onChange({ ...values, [name]: value });
    },
    [values, onChange]
  );

  const renderField = (param: SkillParameter) => {
    const value = values[param.name];
    const error = errorMap[param.name];
    const fieldProps: FieldProps = { param, value, error, onChange: handleChange };

    switch (param.type) {
      case 'string':
        return <StringField {...fieldProps} />;
      case 'number':
        return <NumberField {...fieldProps} />;
      case 'boolean':
        return <BooleanField {...fieldProps} />;
      case 'select':
        return <SelectField {...fieldProps} />;
      case 'multiselect':
        return <MultiSelectField {...fieldProps} />;
      case 'file':
        return <FileField {...fieldProps} />;
      case 'text':
        return <TextField {...fieldProps} />;
      default:
        return <StringField {...fieldProps} />;
    }
  };

  return (
    <div className="skill-parameter-form">
      {parameters.map((param) => (
        <div key={param.name} className="param-field">
          <label htmlFor={`param-${param.name}`} className="param-label">
            {param.label}
            {param.required && <span className="param-required">*</span>}
          </label>
          {param.description && <p className="param-description">{param.description}</p>}
          {renderField(param)}
          {errorMap[param.name] && <p className="param-error">{errorMap[param.name]}</p>}
        </div>
      ))}
    </div>
  );
}
