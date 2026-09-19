import { validateAppDefinition } from './core/validate-app.js';
import { normalizeAppDefinition } from './core/normalize-app.js';
import { problemComparator } from './core/problem.js';
import { validateLayouts } from './layout/validate-layout.js';
import { validateHelp } from './help/validate-help.js';
import { validateGeoScene } from './geo/validate-geo.js';
import { validateCapabilities } from './registry/validate-capabilities.js';

// Composed validation: the closed core plus whichever optional companion layers
// the app actually carries. Use this (not the bare core validateAppDefinition)
// when you want the full diagnostic surface — e.g. the DSL compiler and the
// showcase. Core stays unaware of the companions; the wiring lives here.
//
// options.registries (optional): when supplied, the capability companion also
// checks the app against the registered renderer ids / adapter kinds / field
// types (see src/registry/validate-capabilities.js). Without it, validateApp
// is purely structural and never learns what is registered.

export function validateApp(app, options = {}) {
  const normalized = normalizeAppDefinition(app);
  const problems = [
    ...validateAppDefinition(normalized),
    ...validateLayouts(normalized),
    ...validateHelp(normalized),
    ...validateGeoScene(normalized),
  ];
  if (options && options.registries) {
    problems.push(...validateCapabilities(normalized, options.registries));
  }
  return problems.sort(problemComparator);
}
