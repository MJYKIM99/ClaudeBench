import { useState, useMemo } from 'react';
import type { PermissionRequest } from '../types';
import './DecisionPanel.css';

interface DecisionPanelProps {
  request: PermissionRequest & { isProtectedPath?: boolean };
  onSubmit: (result: { behavior: 'allow' | 'deny'; updatedInput?: unknown }, remember?: boolean) => void;
}

interface AskUserQuestionInput {
  questions: Array<{
    question: string;
    header?: string;
    options: Array<{
      label: string;
      description?: string;
    }>;
    multiSelect?: boolean;
  }>;
}

// Helper to render tool-specific details
function renderToolDetails(toolName: string, input: Record<string, unknown>, isProtectedPath?: boolean) {
  switch (toolName) {
    case 'Bash':
      return (
        <div className="tool-details bash-details">
          <div className="tool-badge warning">Terminal Command</div>
          <div className="command-preview">
            <code>{String(input.command || '')}</code>
          </div>
          {Boolean(input.description) && (
            <p className="tool-description">{String(input.description)}</p>
          )}
          <p className="warning-text">
            This command will be executed in your terminal. Please review carefully.
          </p>
        </div>
      );

    case 'Write':
      return (
        <div className="tool-details write-details">
          <div className={`tool-badge ${isProtectedPath ? 'danger' : 'info'}`}>
            {isProtectedPath ? 'Protected Path' : 'File Write'}
          </div>
          <div className="file-path">
            <span className="path-label">Path:</span>
            <code>{String(input.file_path || '')}</code>
          </div>
          {isProtectedPath && (
            <p className="warning-text">
              This is a protected location. Proceed with caution.
            </p>
          )}
        </div>
      );

    case 'Edit':
      return (
        <div className="tool-details edit-details">
          <div className={`tool-badge ${isProtectedPath ? 'danger' : 'info'}`}>
            {isProtectedPath ? 'Protected Path' : 'File Edit'}
          </div>
          <div className="file-path">
            <span className="path-label">Path:</span>
            <code>{String(input.file_path || '')}</code>
          </div>
          {Boolean(input.old_string) && (
            <div className="edit-preview">
              <div className="edit-section remove">
                <span className="edit-label">Remove:</span>
                <pre>{String(input.old_string).slice(0, 200)}{String(input.old_string).length > 200 ? '...' : ''}</pre>
              </div>
              <div className="edit-section add">
                <span className="edit-label">Add:</span>
                <pre>{String(input.new_string || '').slice(0, 200)}{String(input.new_string || '').length > 200 ? '...' : ''}</pre>
              </div>
            </div>
          )}
          {isProtectedPath && (
            <p className="warning-text">
              This is a protected location. Proceed with caution.
            </p>
          )}
        </div>
      );

    case 'WebFetch':
      return (
        <div className="tool-details webfetch-details">
          <div className="tool-badge info">Network Request</div>
          <div className="file-path">
            <span className="path-label">URL:</span>
            <code>{String(input.url || '')}</code>
          </div>
        </div>
      );

    case 'NotebookEdit':
      return (
        <div className="tool-details notebook-details">
          <div className="tool-badge info">Notebook Edit</div>
          <div className="file-path">
            <span className="path-label">Path:</span>
            <code>{String(input.notebook_path || '')}</code>
          </div>
        </div>
      );

    default:
      return (
        <div className="tool-details generic-details">
          <div className="tool-badge">Tool: {toolName}</div>
          <pre className="tool-input">{JSON.stringify(input, null, 2)}</pre>
        </div>
      );
  }
}

export function DecisionPanel({ request, onSubmit }: DecisionPanelProps) {
  const isAskUserQuestion = request.toolName === 'AskUserQuestion';
  const input = request.input as AskUserQuestionInput | Record<string, unknown>;

  // For AskUserQuestion: track selected answers per question
  const [selections, setSelections] = useState<Record<number, Set<number>>>({});
  const [customInputs, setCustomInputs] = useState<Record<number, string>>({});
  // Track current question index for step-by-step flow (only used when multiple questions)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  // Remember choice checkbox for permission requests
  const [rememberChoice, setRememberChoice] = useState(false);

  const questions = useMemo(() => {
    if (isAskUserQuestion && 'questions' in input && Array.isArray(input.questions)) {
      return input.questions;
    }
    return [];
  }, [isAskUserQuestion, input]);

  // Check if all questions have answers
  const allQuestionsAnswered = useMemo(() => {
    return questions.every((_, idx) =>
      (selections[idx] && selections[idx].size > 0) || !!customInputs[idx]
    );
  }, [questions, selections, customInputs]);

  // Check if current question has an answer
  const currentHasAnswer = useMemo(() => {
    const idx = currentQuestionIndex;
    return (selections[idx] && selections[idx].size > 0) || !!customInputs[idx];
  }, [currentQuestionIndex, selections, customInputs]);

  const buildAnswersAndSubmit = () => {
    const answers: Record<string, { selectedOptions?: number[]; otherText?: string }> = {};

    questions.forEach((q, idx) => {
      const selected = selections[idx];
      const customInput = customInputs[idx];
      const key = q.header || `question_${idx}`;

      if (customInput) {
        answers[key] = { otherText: customInput };
      } else if (selected && selected.size > 0) {
        answers[key] = { selectedOptions: Array.from(selected) };
      }
    });

    const updatedInput = {
      ...(input as Record<string, unknown>),
      answers,
    };

    onSubmit({ behavior: 'allow', updatedInput });
  };

  const handleOptionClick = (questionIndex: number, optionIndex: number, multiSelect: boolean) => {
    setSelections((prev) => {
      const current = prev[questionIndex] || new Set<number>();
      const newSet = new Set(current);

      if (multiSelect) {
        if (newSet.has(optionIndex)) {
          newSet.delete(optionIndex);
        } else {
          newSet.add(optionIndex);
        }
      } else {
        newSet.clear();
        newSet.add(optionIndex);
      }

      return { ...prev, [questionIndex]: newSet };
    });
    // Clear custom input when selecting an option
    setCustomInputs((prev) => ({ ...prev, [questionIndex]: '' }));

    // For single-select: auto-advance or auto-submit after selection
    if (!multiSelect) {
      setTimeout(() => {
        if (questionIndex < questions.length - 1) {
          // Move to next question
          setCurrentQuestionIndex(questionIndex + 1);
        }
        // Note: For last question, user clicks Submit manually
      }, 250);
    }
  };

  const handleCustomInputChange = (questionIndex: number, value: string) => {
    setCustomInputs((prev) => ({ ...prev, [questionIndex]: value }));
    if (value) {
      setSelections((prev) => ({ ...prev, [questionIndex]: new Set() }));
    }
  };

  const handleSubmit = () => {
    if (isAskUserQuestion && questions.length > 0) {
      buildAnswersAndSubmit();
    } else {
      onSubmit({ behavior: 'allow', updatedInput: request.input });
    }
  };

  const handleDeny = () => {
    onSubmit({ behavior: 'deny' });
  };

  // Single question mode - simpler UI
  if (isAskUserQuestion && questions.length === 1) {
    const q = questions[0];
    return (
      <div className="decision-panel ask-user-question">
        <div className="decision-header">
          <span className="decision-icon">❓</span>
          <span className="decision-title">Claude needs your input</span>
        </div>

        <div className="questions-container">
          <div className="question-block">
            {q.header && <div className="question-header">{q.header}</div>}
            <div className="question-text">{q.question}</div>

            <div className="options-list">
              {q.options.map((opt: { label: string; description?: string }, optIdx: number) => {
                const isSelected = selections[0]?.has(optIdx) || false;
                return (
                  <button
                    key={optIdx}
                    className={`option-btn ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleOptionClick(0, optIdx, q.multiSelect || false)}
                  >
                    <span className="option-check">
                      {q.multiSelect ? (isSelected ? '☑' : '☐') : isSelected ? '◉' : '○'}
                    </span>
                    <div className="option-content">
                      <span className="option-label">{opt.label}</span>
                      {opt.description && <span className="option-desc">{opt.description}</span>}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="custom-input-wrapper">
              <input
                type="text"
                className="custom-input"
                placeholder="Or type your own answer..."
                value={customInputs[0] || ''}
                onChange={(e) => handleCustomInputChange(0, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && customInputs[0]) {
                    handleSubmit();
                  }
                }}
              />
            </div>
          </div>
        </div>

        <div className="decision-actions">
          <button className="btn-deny" onClick={handleDeny}>Skip</button>
          <button className="btn-allow" onClick={handleSubmit} disabled={!currentHasAnswer}>
            Submit
          </button>
        </div>
      </div>
    );
  }

  // Multiple questions mode - step-by-step UI
  if (isAskUserQuestion && questions.length > 1) {
    const currentQuestion = questions[currentQuestionIndex];
    const isLastQuestion = currentQuestionIndex === questions.length - 1;
    const isFirstQuestion = currentQuestionIndex === 0;

    return (
      <div className="decision-panel ask-user-question">
        <div className="decision-header">
          <span className="decision-icon">❓</span>
          <span className="decision-title">Claude needs your input</span>
          <span className="question-progress">
            {currentQuestionIndex + 1} / {questions.length}
          </span>
        </div>

        <div className="progress-dots">
          {questions.map((_, idx) => (
            <button
              key={idx}
              className={`progress-dot ${idx === currentQuestionIndex ? 'active' : ''} ${
                (selections[idx]?.size > 0 || customInputs[idx]) ? 'completed' : ''
              }`}
              onClick={() => setCurrentQuestionIndex(idx)}
              aria-label={`Go to question ${idx + 1}`}
            />
          ))}
        </div>

        <div className="questions-container">
          <div className="question-block" key={currentQuestionIndex}>
            {currentQuestion.header && (
              <div className="question-header">{currentQuestion.header}</div>
            )}
            <div className="question-text">{currentQuestion.question}</div>

            <div className="options-list">
              {currentQuestion.options.map((opt: { label: string; description?: string }, optIdx: number) => {
                const isSelected = selections[currentQuestionIndex]?.has(optIdx) || false;
                return (
                  <button
                    key={optIdx}
                    className={`option-btn ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleOptionClick(currentQuestionIndex, optIdx, currentQuestion.multiSelect || false)}
                  >
                    <span className="option-check">
                      {currentQuestion.multiSelect ? (isSelected ? '☑' : '☐') : isSelected ? '◉' : '○'}
                    </span>
                    <div className="option-content">
                      <span className="option-label">{opt.label}</span>
                      {opt.description && <span className="option-desc">{opt.description}</span>}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="custom-input-wrapper">
              <input
                type="text"
                className="custom-input"
                placeholder="Or type your own answer..."
                value={customInputs[currentQuestionIndex] || ''}
                onChange={(e) => handleCustomInputChange(currentQuestionIndex, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && customInputs[currentQuestionIndex]) {
                    if (isLastQuestion) {
                      handleSubmit();
                    } else {
                      setCurrentQuestionIndex(currentQuestionIndex + 1);
                    }
                  }
                }}
              />
            </div>
          </div>
        </div>

        <div className="decision-actions">
          <button className="btn-deny" onClick={handleDeny}>Skip</button>

          <div className="nav-buttons">
            {!isFirstQuestion && (
              <button
                className="btn-nav btn-prev"
                onClick={() => setCurrentQuestionIndex(currentQuestionIndex - 1)}
              >
                ← Back
              </button>
            )}

            {isLastQuestion ? (
              <button className="btn-allow" onClick={handleSubmit} disabled={!allQuestionsAnswered}>
                Submit
              </button>
            ) : (
              <button
                className="btn-nav btn-next"
                onClick={() => setCurrentQuestionIndex(currentQuestionIndex + 1)}
                disabled={!currentHasAnswer}
              >
                Next →
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Generic permission request (fallback)
  return (
    <div className="decision-panel permission-request">
      <div className="decision-header">
        <span className="decision-icon">{request.isProtectedPath ? '⚠️' : '🔐'}</span>
        <span className="decision-title">
          {request.isProtectedPath ? 'Protected Path Access' : 'Permission Required'}
        </span>
      </div>

      {renderToolDetails(request.toolName, input as Record<string, unknown>, request.isProtectedPath)}

      <div className="remember-choice">
        <label className="remember-label">
          <input
            type="checkbox"
            checked={rememberChoice}
            onChange={(e) => setRememberChoice(e.target.checked)}
          />
          <span>Remember my choice for this tool</span>
        </label>
      </div>

      <div className="decision-actions">
        <button className="btn-deny" onClick={() => onSubmit({ behavior: 'deny' }, rememberChoice)}>
          Deny
        </button>
        <button className="btn-allow" onClick={() => onSubmit({ behavior: 'allow', updatedInput: request.input }, rememberChoice)}>
          Allow
        </button>
      </div>
    </div>
  );
}
