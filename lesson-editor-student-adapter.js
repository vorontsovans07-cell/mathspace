/* Adapter scaffold for lessons assigned to students. Does not override current app functions. */
(function(g){'use strict';const c=g.MathSpaceLessonEditorCore;if(!c)throw Error('Підключіть lesson-editor-core.js раніше.');
g.MathSpaceStudentLessonAdapter=Object.freeze({
 mode:'student',
 fromDatabase(lesson,questions,keys){const map=Object.fromEntries((keys||[]).map(k=>[k.question_id,k.correct]));return c.normalizeLesson({...lesson,content:(questions||[]).map(q=>({qtype:q.qtype,prompt:q.prompt,options:q.options,correct:map[q.id]??null,points:q.points,explanation:q.explanation,image_path:q.image_path}))});},
 validate(lesson){return c.validateLesson(lesson);},
 render(lesson){return c.renderEditorShell(lesson,'student');}
 // Integrate save using the existing save_question RPC and current app permission model.
});
})(window);
