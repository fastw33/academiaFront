"use client";

import { ClipboardCheck, Plus, Trash2 } from "lucide-react";

export type QuizQuestion = {
  id: string;
  prompt: string;
  options: string[];
  correctOptionIndex: number;
};

export type LessonQuiz = {
  passingScore: number;
  questions: QuizQuestion[];
};

type QuizEditorProps = {
  lessonTitle: string;
  quiz: LessonQuiz | null;
  onChange: (quiz: LessonQuiz | null) => void;
};

function emptyQuestion(): QuizQuestion {
  return {
    id: crypto.randomUUID(),
    prompt: "",
    options: ["", "", "", ""],
    correctOptionIndex: 0,
  };
}

export function createEmptyQuiz(): LessonQuiz {
  return {
    passingScore: 90,
    questions: Array.from({ length: 5 }, emptyQuestion),
  };
}

export default function QuizEditor({ lessonTitle, quiz, onChange }: QuizEditorProps) {
  if (!quiz) {
    return (
      <div className="quiz-editor quiz-editor-empty">
        <ClipboardCheck size={22} />
        <div>
          <strong>Evaluación de la lección</strong>
          <span>Crea cinco preguntas de opción múltiple para validar el aprendizaje.</span>
        </div>
        <button className="button secondary" type="button" onClick={() => onChange(createEmptyQuiz())}>
          <Plus size={17} /> Crear evaluación
        </button>
      </div>
    );
  }
  const activeQuiz = quiz;

  function updateQuestion(questionId: string, update: Partial<QuizQuestion>) {
    onChange({
      ...activeQuiz,
      questions: activeQuiz.questions.map((question) => (
        question.id === questionId ? { ...question, ...update } : question
      )),
    });
  }

  function updateOption(questionId: string, optionIndex: number, value: string) {
    const question = activeQuiz.questions.find((item) => item.id === questionId);
    if (!question) return;
    const options = [...question.options];
    options[optionIndex] = value;
    updateQuestion(questionId, { options });
  }

  function removeQuestion(questionId: string) {
    if (activeQuiz.questions.length <= 5) return;
    onChange({ ...activeQuiz, questions: activeQuiz.questions.filter((question) => question.id !== questionId) });
  }

  return (
    <section className="quiz-editor" aria-label={`Evaluación de ${lessonTitle}`}>
      <div className="quiz-editor-header">
        <div>
          <span className="eyebrow">Evaluación obligatoria</span>
          <h3>{activeQuiz.questions.length} preguntas · aprobación {activeQuiz.passingScore}%</h3>
        </div>
        <button className="text-button danger" type="button" onClick={() => onChange(null)}>
          <Trash2 size={16} /> Quitar evaluación
        </button>
      </div>

      <div className="quiz-question-list">
        {activeQuiz.questions.map((question, questionIndex) => (
          <fieldset className="quiz-question-editor" key={question.id}>
            <legend>Pregunta {questionIndex + 1}</legend>
            <div className="field">
              <label htmlFor={`question-${question.id}`}>Enunciado</label>
              <input
                id={`question-${question.id}`}
                value={question.prompt}
                onChange={(event) => updateQuestion(question.id, { prompt: event.target.value })}
                placeholder="Escribe la pregunta sobre esta lección"
                required
              />
            </div>
            <div className="quiz-option-editor-list">
              {question.options.map((option, optionIndex) => {
                const optionId = `correct-${question.id}-${optionIndex}`;
                return (
                  <div className="quiz-option-editor" key={optionId}>
                    <input
                      id={optionId}
                      name={`correct-${question.id}`}
                      type="radio"
                      checked={question.correctOptionIndex === optionIndex}
                      onChange={() => updateQuestion(question.id, { correctOptionIndex: optionIndex })}
                    />
                    <label htmlFor={optionId} title="Marcar como respuesta correcta">
                      {String.fromCharCode(65 + optionIndex)}
                    </label>
                    <input
                      aria-label={`Opción ${String.fromCharCode(65 + optionIndex)} de la pregunta ${questionIndex + 1}`}
                      value={option}
                      onChange={(event) => updateOption(question.id, optionIndex, event.target.value)}
                      placeholder={`Opción ${String.fromCharCode(65 + optionIndex)}`}
                      required
                    />
                  </div>
                );
              })}
            </div>
            {activeQuiz.questions.length > 5 ? (
              <button className="text-button danger quiz-question-remove" type="button" onClick={() => removeQuestion(question.id)}>
                <Trash2 size={15} /> Eliminar pregunta
              </button>
            ) : null}
          </fieldset>
        ))}
      </div>

      {activeQuiz.questions.length < 6 ? (
        <button
          className="button ghost quiz-add-question"
          type="button"
          onClick={() => onChange({ ...activeQuiz, questions: [...activeQuiz.questions, emptyQuestion()] })}
        >
          <Plus size={17} /> Añadir sexta pregunta
        </button>
      ) : null}
    </section>
  );
}
