import type { Select } from './select.js'
import type { FormulaApplication } from './formula.js'
import type { RuleApplication, DeductiveRule } from './rule.js'
import type { RuleRecursion } from '../syntax.js'
import type { Negation } from './negation.js'
import type { Join } from './join.js'
export * from '../api.js'

export type Constraint = Select | FormulaApplication | RuleApplication

export type Conjunct =
  | Select
  | FormulaApplication
  | Join
  | Negation
  | RuleApplication
  | RuleRecursion

export type { Join }
