import { validateAppDefinition } from './core/validate-app.js';
import { normalizeAppDefinition } from './core/normalize-app.js';
import { problemComparator } from './core/problem.js';
import { validateLayouts } from './layout/validate-layout.js';
import { validateHelp } from './help/validate-help.js';
import { validateGeoScene } from './geo/validate-geo.js';

// Composed validation: the closed core plus whichever optional companion layers
// the app actually carries. Use this (not the bare core validateAppDefinition)
// when you want the full diagnostic surface — e.g. the DSL compiler and the
// showcase. Core stays unaware of the companions; the wiring lives here.

export function validateApp(app) {
  const normalized = normalizeAppDefinition(app);
  const problems = [
    ...validateAppDefinition(normalized),
    ...validateLayouts(normalized),
    ...validateHelp(normalized),
    ...validateGeoScene(normalized),
  ];
  return problems.sort(problemComparator);
}
