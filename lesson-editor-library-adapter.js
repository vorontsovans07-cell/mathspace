/* Adapter scaffold for private lesson_templates. Does not override current app functions. */
(function(g){'use strict';const c=g.MathSpaceLessonEditorCore;if(!c)throw Error('Підключіть lesson-editor-core.js раніше.');
g.MathSpaceLibraryLessonAdapter=Object.freeze({
 mode:'library',
 fromTemplate(template){return c.normalizeLesson({...template,content:template?.content||[]});},
 validate(lesson){return c.validateLesson(lesson);},
 render(lesson){return c.renderEditorShell(lesson,'library');},
 toTemplate(lesson){const l=c.validateLesson(lesson);return {title:l.title.trim(),description:l.description,content:l.content,presentation_path:l.presentation_path,presentation_name:l.presentation_name,notes_path:l.notes_path,notes_name:l.notes_name,time_limit_minutes:l.time_limit_minutes};}
 // Integrate persistence with existing lesson_templates schema and Storage bucket.
});
})(window);
