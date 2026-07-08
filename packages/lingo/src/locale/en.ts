import {
  DURATION_UNIT_SECONDS,
  MONTHS,
  SUBUNIT,
  TIME_CORE_PATTERN,
  TIME_PATTERN,
  UNIT_WORDS,
  WEEKDAY_NAMES,
  WEEKDAYS,
} from '../date/vocab'
import { enCore } from './en-core'
import type { LocalePack } from './types'

export const en: LocalePack = {
  ...enCore,
  date: {
    durationUnitSeconds: DURATION_UNIT_SECONDS,
    months: MONTHS,
    subunit: SUBUNIT,
    timeCorePattern: TIME_CORE_PATTERN,
    timePattern: TIME_PATTERN,
    unitWords: UNIT_WORDS,
    weekdayNames: WEEKDAY_NAMES,
    weekdays: WEEKDAYS,
  },
}

export default en
