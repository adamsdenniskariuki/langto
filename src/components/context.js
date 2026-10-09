import { createContext } from 'preact';
import { useContext } from 'preact/hooks';

// The currently loaded course ({ lang, levels, lessonIndex, phraseIndex, order }).
export const CourseContext = createContext(null);
export const useCourse = () => useContext(CourseContext);
