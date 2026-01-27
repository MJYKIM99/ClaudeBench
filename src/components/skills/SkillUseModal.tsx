import { useCallback, useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';

import type { ParameterValidationError, SkillInfo, SkillParameterValues } from '../../types';
import { Button } from '../ui';
import { SkillParameterForm } from './SkillParameterForm';
import { SkillPreview } from './SkillPreview';

import './SkillUseModal.css';

interface SkillUseModalProps {
  skill: SkillInfo;
  onClose: () => void;
  onUse: (expandedPrompt: string) => void;
}

export function SkillUseModal({ skill, onClose, onUse }: SkillUseModalProps) {
  const hasParameters = skill.parameters && skill.parameters.length > 0;
  const [values, setValues] = useState<SkillParameterValues>(() => {
    // Initialize with default values
    const defaults: SkillParameterValues = {};
    if (skill.parameters) {
      for (const param of skill.parameters) {
        if (param.default !== undefined) {
          defaults[param.name] = param.default;
        }
      }
    }
    return defaults;
  });
  const [errors, setErrors] = useState<ParameterValidationError[]>([]);
  const [showPreview, setShowPreview] = useState(true);

  // Validate parameters
  const validate = useCallback((): boolean => {
    if (!skill.parameters) return true;

    const newErrors: ParameterValidationError[] = [];

    for (const param of skill.parameters) {
      const value = values[param.name];

      // Required check
      if (param.required && (value === undefined || value === null || value === '')) {
        newErrors.push({ name: param.name, message: `${param.label} is required` });
        continue;
      }

      if (value === undefined || value === null || value === '') continue;

      // Type-specific validation
      if (param.type === 'number') {
        const numValue = Number(value);
        if (isNaN(numValue)) {
          newErrors.push({ name: param.name, message: `${param.label} must be a number` });
        } else {
          if (param.min !== undefined && numValue < param.min) {
            newErrors.push({
              name: param.name,
              message: `${param.label} must be at least ${param.min}`,
            });
          }
          if (param.max !== undefined && numValue > param.max) {
            newErrors.push({
              name: param.name,
              message: `${param.label} must be at most ${param.max}`,
            });
          }
        }
      }

      if (param.type === 'string' || param.type === 'text') {
        const strValue = String(value);
        if (param.minLength !== undefined && strValue.length < param.minLength) {
          newErrors.push({
            name: param.name,
            message: `${param.label} must be at least ${param.minLength} characters`,
          });
        }
        if (param.maxLength !== undefined && strValue.length > param.maxLength) {
          newErrors.push({
            name: param.name,
            message: `${param.label} must be at most ${param.maxLength} characters`,
          });
        }
        if (param.pattern) {
          try {
            const regex = new RegExp(param.pattern);
            if (!regex.test(strValue)) {
              newErrors.push({ name: param.name, message: `${param.label} format is invalid` });
            }
          } catch {
            // Invalid regex pattern, skip validation
          }
        }
      }
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  }, [skill.parameters, values]);

  // Expand template with current values
  const expandedPrompt = useMemo(() => {
    if (!skill.template) return `/${skill.name}`;

    let result = skill.template;
    for (const [key, value] of Object.entries(values)) {
      const placeholder = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      const stringValue = Array.isArray(value) ? value.join(', ') : String(value ?? '');
      result = result.replace(placeholder, stringValue);
    }
    return result;
  }, [skill.template, skill.name, values]);

  const handleSubmit = useCallback(() => {
    if (!validate()) return;
    onUse(expandedPrompt);
  }, [validate, expandedPrompt, onUse]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="skill-use-modal-overlay" onClick={onClose}>
      <div className="skill-use-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-section">
            <h3 className="modal-title">{skill.name}</h3>
            {skill.description && <p className="modal-description">{skill.description}</p>}
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          {hasParameters ? (
            <>
              <div className="modal-section">
                <h4 className="section-title">Parameters</h4>
                <SkillParameterForm
                  parameters={skill.parameters!}
                  values={values}
                  onChange={setValues}
                  errors={errors}
                />
              </div>

              {skill.template && (
                <div className="modal-section">
                  <div className="section-header">
                    <h4 className="section-title">Prompt Preview</h4>
                    <button className="toggle-preview" onClick={() => setShowPreview(!showPreview)}>
                      {showPreview ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  {showPreview && <SkillPreview template={skill.template} values={values} />}
                </div>
              )}
            </>
          ) : (
            <div className="no-params-message">
              <p>This skill has no configurable parameters.</p>
              <p className="hint">Click "Use Skill" to add it to your prompt.</p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit}>
            Use Skill
          </Button>
        </div>
      </div>
    </div>
  );
}
